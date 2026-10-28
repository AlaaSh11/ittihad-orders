import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  runTransaction 
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadPhotoDataUrl } from './storageHelper';

const ORDERS_KEY = 'ittihad_orders_backup';
const QUEUE_KEY = 'ittihad_offline_queue';
const COUNTER_KEY = 'ittihad_order_counter';
const STARTING_SERIAL = 1217;
const ORDERS_COLLECTION = 'orders';
const COUNTER_DOC = doc(db, 'metadata', 'orderCounter');

// ── Local failover & queue helpers ────────────────────────────────

function readLocalOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalOrders(orders) {
  try {
    const trimmed = orders.slice(-200);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('LocalStorage quota limit reached for backup:', e);
  }
}

function readOfflineQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('LocalStorage error writing offline queue:', e);
  }
}

export function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel / vowels
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function buildSearchFields(order) {
  const name = normalizeArabic(order.header?.customerName || '');
  const phone = (order.header?.customerPhone || '').replace(/\D/g, '');
  const serialId = (order.id || '').toLowerCase().trim();
  return {
    searchName: name,
    searchPhone: phone,
    searchId: serialId,
  };
}

// ── Offline Queue Sync Engine ─────────────────────────────────────

export async function syncOfflineQueue() {
  const queue = readOfflineQueue();
  if (!queue || queue.length === 0) return;

  console.log(`[Offline Sync] Processing ${queue.length} pending offline operation(s)...`);
  const remainingQueue = [];

  for (const item of queue) {
    try {
      if (item.type === 'CREATE') {
        let order = { ...item.order };

        // 1. Upload photo if still Base64
        if (order.body?.referencePhoto && order.body.referencePhoto.startsWith('data:image')) {
          const storageUrl = await uploadPhotoDataUrl(order.body.referencePhoto);
          if (storageUrl) {
            order.body.referencePhoto = storageUrl;
          }
        }
        if (Array.isArray(order.items)) {
          for (const it of order.items) {
            if (it.body?.referencePhoto && it.body.referencePhoto.startsWith('data:image')) {
              const storageUrl = await uploadPhotoDataUrl(it.body.referencePhoto);
              if (storageUrl) {
                it.body.referencePhoto = storageUrl;
              }
            }
          }
        }

        // 2. Resolve temporary ID if order was placed offline with TEMP-OFFLINE-
        let oldId = order.id;
        if (order.id && order.id.startsWith('TEMP-OFFLINE-')) {
          const officialId = await getNextOrderId(); // Fetch atomic cloud serial
          order.id = officialId;
        }

        // 3. Attach search fields
        const searchFields = buildSearchFields(order);
        const orderToStore = { ...order, ...searchFields, syncedAt: new Date().toISOString() };

        // 4. Save to Firestore
        const orderRef = doc(db, ORDERS_COLLECTION, orderToStore.id);
        await setDoc(orderRef, orderToStore);

        // 5. Update local storage: swap old TEMP-OFFLINE ID with new official ID
        const localOrders = readLocalOrders();
        const idx = localOrders.findIndex(o => o.id === oldId || o.id === orderToStore.id);
        if (idx !== -1) {
          localOrders[idx] = orderToStore;
        } else {
          localOrders.push(orderToStore);
        }
        writeLocalOrders(localOrders);

        console.log(`[Offline Sync] Successfully synced order ${orderToStore.id} (was ${oldId})`);
      } else if (item.type === 'UPDATE') {
        const orderRef = doc(db, ORDERS_COLLECTION, item.id);
        await updateDoc(orderRef, { ...item.patch, syncedAt: new Date().toISOString() });
      }
    } catch (err) {
      console.warn(`[Offline Sync] Failed to sync operation for order ${item.id || item.order?.id}:`, err?.message);
      remainingQueue.push(item); // Keep in queue for next retry
    }
  }

  writeOfflineQueue(remainingQueue);
}

// ── Public API ────────────────────────────────────────────────────

export function peekCurrentOrderId() {
  const current = parseInt(localStorage.getItem(COUNTER_KEY) ?? STARTING_SERIAL, 10);
  return `CAKE-${current + 1}`;
}

export async function syncCounterFromCloud() {
  try {
    const snap = await getDoc(COUNTER_DOC);
    if (snap.exists()) {
      const cloudSerial = snap.data().serial ?? STARTING_SERIAL;
      localStorage.setItem(COUNTER_KEY, cloudSerial);
    } else {
      const currentLocal = parseInt(localStorage.getItem(COUNTER_KEY) ?? STARTING_SERIAL, 10);
      await setDoc(COUNTER_DOC, { serial: currentLocal });
    }
  } catch (e) {
    console.warn('Offline or unable to fetch cloud counter:', e?.message);
  }
}

export async function getNextOrderId() {
  let nextSerial;
  try {
    nextSerial = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(COUNTER_DOC);
      let newSerial = STARTING_SERIAL + 1;
      if (snap.exists()) {
        newSerial = (snap.data().serial ?? STARTING_SERIAL) + 1;
      }
      transaction.set(COUNTER_DOC, { serial: newSerial });
      return newSerial;
    });
    localStorage.setItem(COUNTER_KEY, nextSerial);
    return `CAKE-${nextSerial}`;
  } catch (cloudErr) {
    console.warn('Cloud counter unavailable (offline mode). Generating temporary offline ID:', cloudErr?.message);
    const rand = Math.random().toString(36).substring(2, 7);
    return `TEMP-OFFLINE-${Date.now()}-${rand}`;
  }
}

export async function createOrder(order) {
  const searchFields = buildSearchFields(order);
  const saved = { 
    ...order, 
    ...searchFields, 
    savedAt: new Date().toISOString() 
  };

  // 1. Mirror to local storage
  const localOrders = readLocalOrders();
  localOrders.push(saved);
  writeLocalOrders(localOrders);

  // 2. Write to Firestore if online, or add to offline queue
  try {
    if (!navigator.onLine) throw new Error('Client is offline');
    const orderRef = doc(db, ORDERS_COLLECTION, saved.id);
    await setDoc(orderRef, saved);
  } catch (error) {
    console.warn('Enqueued order for offline sync:', saved.id, error?.message);
    const queue = readOfflineQueue();
    queue.push({ type: 'CREATE', order: saved, timestamp: Date.now() });
    writeOfflineQueue(queue);
  }

  return saved;
}

export async function getOrdersByVisit(customerVisitId) {
  try {
    const q = query(collection(db, ORDERS_COLLECTION), where('customerVisitId', '==', customerVisitId));
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizeOrder(d.data()));
  } catch {
    return readLocalOrders().filter((o) => o.customerVisitId === customerVisitId).map(normalizeOrder);
  }
}

export async function updateOrder(id, patch) {
  const updatedAt = new Date().toISOString();

  // Update local
  const localOrders = readLocalOrders();
  const idx = localOrders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    localOrders[idx] = { ...localOrders[idx], ...patch, updatedAt };
    writeLocalOrders(localOrders);
  }

  // Update Firestore / queue
  try {
    if (!navigator.onLine) throw new Error('Offline');
    const orderRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(orderRef, { ...patch, updatedAt });
    const updatedSnap = await getDoc(orderRef);
    return updatedSnap.exists() ? normalizeOrder(updatedSnap.data()) : null;
  } catch (e) {
    console.warn('Update queued offline:', id, e?.message);
    const queue = readOfflineQueue();
    queue.push({ type: 'UPDATE', id, patch, timestamp: Date.now() });
    writeOfflineQueue(queue);
    return idx !== -1 ? normalizeOrder(localOrders[idx]) : null;
  }
}

export async function collectDeposit(id, collectedBy) {
  return updateOrder(id, {
    depositCollected: true,
    depositCollectedAt: new Date().toISOString(),
    depositCollectedBy: collectedBy || 'الكاشير',
  });
}

export async function undoDeposit(id) {
  return updateOrder(id, {
    depositCollected: false,
    depositCollectedAt: null,
    depositCollectedBy: null,
  });
}

function normalizeOrder(data) {
  if (!data) return data;
  const remainingVal = parseFloat(data.footer?.remaining) || 0;
  const isOldLegacy = data.isPaid === undefined && (remainingVal === 0 || !data.createdAt || (Date.now() - new Date(data.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000));
  return {
    ...data,
    isPaid: data.isPaid !== undefined ? data.isPaid : isOldLegacy ? true : false,
    depositCollected: data.depositCollected !== undefined ? data.depositCollected : false,
    productionStatus: data.productionStatus || 'received',
    isCancelled: data.isCancelled || false,
  };
}

export async function updateProductionStatus(id, newStatus, updatedBy) {
  return updateOrder(id, {
    productionStatus: newStatus,
    productionStatusUpdatedAt: new Date().toISOString(),
    productionStatusUpdatedBy: updatedBy || 'المصنع',
  });
}

export async function cancelOrder(id, reason, cancelledBy) {
  return updateOrder(id, {
    isCancelled: true,
    cancelledReason: reason || 'إلغاء من قبل الزبون / الإدارة',
    cancelledAt: new Date().toISOString(),
    cancelledBy: cancelledBy || 'الموظف',
  });
}

export async function uncancelOrder(id) {
  return updateOrder(id, {
    isCancelled: false,
    cancelledReason: null,
    cancelledAt: null,
    cancelledBy: null,
  });
}

export async function listOrders(maxCount = 150) {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizeOrder(d.data()));
  } catch {
    return [...readLocalOrders()].reverse().slice(0, maxCount).map(normalizeOrder);
  }
}

/**
 * Return paginated list of orders for infinite scrolling or load-more.
 * @param {Object} options { pageSize: 50, lastDocSnap: null }
 * @returns {Promise<{ orders: Object[], lastDocSnap: Object|null, hasMore: boolean }>}
 */
export async function listOrdersPaginated({ pageSize = 50, lastDocSnap = null }) {
  try {
    let qConstraints = [
      collection(db, ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
    ];
    if (lastDocSnap) {
      qConstraints.push(startAfter(lastDocSnap));
    }
    qConstraints.push(limit(pageSize));

    const q = query(...qConstraints);
    const snap = await getDocs(q);
    const orders = snap.docs.map(d => normalizeOrder(d.data()));
    const newLastDoc = snap.docs[snap.docs.length - 1] || null;
    const hasMore = snap.docs.length === pageSize;

    return { orders, lastDocSnap: newLastDoc, hasMore };
  } catch (e) {
    console.warn('Paginated fetch fallback to local:', e?.message);
    const local = readLocalOrders().reverse();
    return { orders: local.slice(0, pageSize).map(normalizeOrder), lastDocSnap: null, hasMore: false };
  }
}

/**
 * Perform server-side scalar prefix range queries across customer name, phone, or order ID.
 * @param {string} searchInput
 * @returns {Promise<Object[]>}
 */
export async function searchOrders(searchInput) {
  if (!searchInput || !searchInput.trim()) return [];
  const qStr = searchInput.trim().toLowerCase();
  const normalizedName = normalizeArabic(searchInput);
  const digitsOnly = qStr.replace(/\D/g, '');

  try {
    const queries = [];
    
    // 1. Prefix query on searchName
    queries.push(query(
      collection(db, ORDERS_COLLECTION),
      where('searchName', '>=', normalizedName),
      where('searchName', '<=', normalizedName + '\uf8ff'),
      limit(30)
    ));

    // 2. Prefix query on searchId
    queries.push(query(
      collection(db, ORDERS_COLLECTION),
      where('searchId', '>=', qStr),
      where('searchId', '<=', qStr + '\uf8ff'),
      limit(30)
    ));

    // 3. Prefix query on searchPhone (if numbers typed)
    if (digitsOnly.length > 2) {
      queries.push(query(
        collection(db, ORDERS_COLLECTION),
        where('searchPhone', '>=', digitsOnly),
        where('searchPhone', '<=', digitsOnly + '\uf8ff'),
        limit(30)
      ));
    }

    const resultsMap = new Map();
    for (const q of queries) {
      const snap = await getDocs(q);
      snap.docs.forEach(docSnap => {
        const order = normalizeOrder(docSnap.data());
        if (order && order.id) {
          resultsMap.set(order.id, order);
        }
      });
    }

    return Array.from(resultsMap.values());
  } catch (e) {
    console.warn('Search query error, falling back to local filter:', e?.message);
    const local = readLocalOrders().map(normalizeOrder);
    return local.filter(o => 
      (o.header?.customerName || '').toLowerCase().includes(qStr) ||
      (o.header?.customerPhone || '').includes(digitsOnly) ||
      (o.id || '').toLowerCase().includes(qStr)
    );
  }
}
