import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  runTransaction,
  writeBatch,
  serverTimestamp,
  collectionGroup,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { uploadPhotoDataUrl } from './storageHelper';
import { getCurrentUser } from './auth';

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

// Photos saved inline (data: URLs) would fill the browser's ~5 MB storage
// after a few dozen orders, silently stopping the backup and the offline
// queue. The backup keeps everything except those inline photos (the queue
// keeps them, so nothing is lost before it syncs).
function withoutInlinePhotos(order) {
  const strip = (body) => (body?.referencePhoto?.startsWith?.('data:')
    ? { ...body, referencePhoto: null }
    : body);
  return {
    ...order,
    body: order.body ? strip(order.body) : order.body,
    items: Array.isArray(order.items) ? order.items.map((it) => ({ ...it, body: strip(it.body) })) : order.items,
  };
}

function writeLocalOrders(orders) {
  try {
    const trimmed = orders.slice(-150).map(withoutInlinePhotos);
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

/** @returns {boolean} false if the queue could not be stored (device storage full). */
function writeOfflineQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.warn('LocalStorage error writing offline queue:', e);
    return false;
  }
}

/** Queue a change for later; throws if it cannot be kept, so the UI reports a failed save. */
function enqueue(item) {
  const queue = readOfflineQueue();
  queue.push(item);
  if (!writeOfflineQueue(queue)) {
    throw new Error('لا يمكن حفظ الطلبية على هذا الجهاز بدون إنترنت (ذاكرة الجهاز ممتلئة).');
  }
}

const queueKey = (item) => `${item.type}|${item.timestamp}|${item.id || item.order?.id}`;

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

// ── Change history & payments ─────────────────────────────────
//
// Every order write goes through a batch that also adds a history entry
// (orders/{id}/history/{changeId}) and, when money changes hands, a
// /payments document. firestore.rules rejects order writes that skip it.

// Fields that change on every write and are not worth showing in history.
const HISTORY_SKIP = new Set(['updatedAt', 'syncedAt', 'savedAt', 'searchName', 'searchPhone', 'searchId', 'lastChangeId']);

function shortValue(v) {
  if (v === undefined || v === null || v === '') return '';
  const str = typeof v === 'string' ? v : JSON.stringify(v);
  return str.length > 200 ? str.slice(0, 197) + '...' : str;
}

/**
 * Human-readable list of what a patch changes compared to `before`:
 * [{ f: 'footer.price', from: '50', to: '35' }, ...]. Header/footer are
 * compared field by field; items are summarised.
 */
export function describeChanges(before, patch) {
  const out = [];
  const old = before || {};
  for (const [key, value] of Object.entries(patch)) {
    if (HISTORY_SKIP.has(key)) continue;
    const prev = old[key];
    if (key === 'items') {
      const a = Array.isArray(prev) ? prev : [];
      const b = Array.isArray(value) ? value : [];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        out.push({ f: 'items', from: `${a.length}`, to: `${b.length}` });
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value) && (key === 'header' || key === 'footer')) {
      const p = prev && typeof prev === 'object' ? prev : {};
      for (const k of new Set([...Object.keys(p), ...Object.keys(value)])) {
        if (shortValue(p[k]) !== shortValue(value[k])) {
          out.push({ f: `${key}.${k}`, from: shortValue(p[k]), to: shortValue(value[k]) });
        }
      }
    } else if (shortValue(prev) !== shortValue(value)) {
      out.push({ f: key, from: shortValue(prev), to: shortValue(value) });
    }
  }
  return out;
}

/** The signed-in user, as recorded in history and payments. */
function actor() {
  const u = getCurrentUser();
  return {
    uid: auth.currentUser?.uid || '',
    by: u?.arabicName || u?.username || '',
    role: u?.role || '',
  };
}

function historyDoc(action, fields, changes, meta) {
  const a = actor();
  return {
    action,
    fields,
    changes: changes || [],
    uid: a.uid,
    by: a.by,
    role: a.role,
    at: serverTimestamp(),
    clientAt: meta.clientAt,
    day: localDateString(0, new Date(meta.clientAt)),
  };
}

function paymentDoc(orderId, changeId, payment, meta) {
  const a = actor();
  return {
    orderId,
    changeId,
    kind: payment.kind,
    usd: Number(payment.usd) || 0,
    lbp: Number(payment.lbp) || 0,
    uid: a.uid,
    by: a.by,
    at: serverTimestamp(),
    clientAt: meta.clientAt,
    day: localDateString(0, new Date(meta.clientAt)),
    customerName: payment.customerName || '',
  };
}

/** Write an order update together with its history entry (and payment). */
async function commitUpdate(id, patch, meta) {
  const batch = writeBatch(db);
  const orderRef = doc(db, ORDERS_COLLECTION, id);
  const histRef = doc(collection(orderRef, 'history'));
  batch.update(orderRef, { ...patch, lastChangeId: histRef.id });
  batch.set(histRef, historyDoc(meta.action || 'update', Object.keys(patch), meta.changes, meta));
  for (const payment of meta.payments || []) {
    batch.set(doc(collection(db, 'payments')), paymentDoc(id, histRef.id, payment, meta));
  }
  await batch.commit();
}

/** Write a new order together with its 'create' history entry. */
async function commitCreate(order, meta) {
  const batch = writeBatch(db);
  const orderRef = doc(db, ORDERS_COLLECTION, order.id);
  const histRef = doc(collection(orderRef, 'history'));
  batch.set(orderRef, { ...order, lastChangeId: histRef.id });
  batch.set(histRef, historyDoc('create', [], [], meta));
  await batch.commit();
}

// ── Offline Queue Sync Engine ─────────────────────────────────────

// Only one sync at a time: app start and the browser's "online" event can
// fire together, and two parallel runs would send the same offline order
// twice (as two orders with different numbers).
let syncInFlight = null;

export function syncOfflineQueue() {
  if (!syncInFlight) {
    syncInFlight = runOfflineSync().finally(() => { syncInFlight = null; });
  }
  return syncInFlight;
}

async function runOfflineSync() {
  const queue = readOfflineQueue();
  if (!queue || queue.length === 0) return;

  console.log(`[Offline Sync] Processing ${queue.length} pending offline operation(s)...`);
  const remainingQueue = [];
  // Keys taken before processing: a synced order's temporary number is replaced below.
  const processed = new Set(queue.map(queueKey));

  for (const item of queue) {
    try {
      if (item.type === 'CREATE' && item.created) {
        // Order already saved on an earlier attempt; only its payments are left.
        await syncPendingPayments(item);
      } else if (item.type === 'CREATE') {
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
        if (oldId !== order.id) orderToStore.offlineTempId = oldId;

        // 4. Save to Firestore (with its history entry), then any payments
        //    taken while it was still offline.
        const meta = { clientAt: item.clientAt || order.createdAt || new Date().toISOString() };
        await commitCreate(orderToStore, meta);
        // From here on a retry must not create the order again (it would get a new number).
        item.order = orderToStore;
        item.created = true;

        // 5. Update local storage: swap old TEMP-OFFLINE ID with new official ID
        const localOrders = readLocalOrders();
        const idx = localOrders.findIndex(o => o.id === oldId || o.id === orderToStore.id);
        if (idx !== -1) {
          localOrders[idx] = orderToStore;
        } else {
          localOrders.push(orderToStore);
        }
        writeLocalOrders(localOrders);

        await syncPendingPayments(item);
        console.log(`[Offline Sync] Successfully synced order ${orderToStore.id} (was ${oldId})`);
      } else if (item.type === 'UPDATE') {
        await commitUpdate(item.id, { ...item.patch, syncedAt: new Date().toISOString() }, {
          action: item.action || 'update',
          changes: item.changes || [],
          payments: item.payments || [],
          clientAt: item.clientAt || new Date(item.timestamp || Date.now()).toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[Offline Sync] Failed to sync operation for order ${item.id || item.order?.id}:`, err?.message);
      remainingQueue.push(item); // Keep in queue for next retry
    }
  }

  // Keep anything queued while this sync was running.
  const addedMeanwhile = readOfflineQueue().filter((i) => !processed.has(queueKey(i)));
  writeOfflineQueue([...remainingQueue, ...addedMeanwhile]);
}

/** Payments taken on an order while it was still offline; removed one by one as they sync. */
async function syncPendingPayments(item) {
  while (item.pendingPayments?.length) {
    const p = item.pendingPayments[0];
    await commitUpdate(item.order.id, {}, { action: p.action, clientAt: p.clientAt, payments: [p.payment] });
    item.pendingPayments.shift();
  }
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
    if (saved.id.startsWith('TEMP-OFFLINE-')) throw new Error('No official order number yet');
    await commitCreate(saved, { clientAt: saved.savedAt });
  } catch (error) {
    console.warn('Enqueued order for offline sync:', saved.id, error?.message);
    enqueue({ type: 'CREATE', order: saved, timestamp: Date.now(), clientAt: saved.savedAt });
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

/**
 * Update an order and record the change in its history.
 * @param {string} id
 * @param {Object} patch      top-level fields to set
 * @param {Object} [options]
 * @param {Object} [options.before]   the order as currently shown (for the change description)
 * @param {string} [options.action]   e.g. 'edit', 'payment', 'cancel'
 * @param {Object} [options.payment]  { kind: 'deposit'|'final'|'void', usd, lbp, customerName }
 */
export async function updateOrder(id, patch, { before, action = 'update', payment } = {}) {
  const updatedAt = new Date().toISOString();

  // Keep the search index in sync when the customer details change.
  if (patch.header) {
    const { searchName, searchPhone } = buildSearchFields({ header: patch.header });
    patch = { ...patch, searchName, searchPhone };
  }

  // Order saved offline with a temporary ID.
  if (id.startsWith('TEMP-OFFLINE-')) {
    const queue = readOfflineQueue();
    const pending = queue.find((q) => q.type === 'CREATE' && !q.created && q.order?.id === id);
    if (pending) {
      // Not synced yet: amend the queued creation instead of queueing an update
      // for a document that does not exist. Payments are written after it syncs.
      pending.order = { ...pending.order, ...patch, updatedAt };
      if (payment) {
        pending.pendingPayments = [...(pending.pendingPayments || []), { action, payment, clientAt: updatedAt }];
      }
      if (!writeOfflineQueue(queue)) {
        throw new Error('لا يمكن حفظ التعديل على هذا الجهاز بدون إنترنت (ذاكرة الجهاز ممتلئة).');
      }
      const localOrders = readLocalOrders();
      const i = localOrders.findIndex((o) => o.id === id);
      if (i !== -1) {
        localOrders[i] = pending.order;
        writeLocalOrders(localOrders);
      }
      return normalizeOrder(pending.order);
    }
    // Already synced: switch to the official ID it received.
    const synced = readLocalOrders().find((o) => o.offlineTempId === id);
    if (synced) id = synced.id;
  }

  // Update local
  const localOrders = readLocalOrders();
  const idx = localOrders.findIndex((o) => o.id === id);
  const changes = describeChanges(before || localOrders[idx], patch);
  const payments = payment ? [payment] : [];
  if (idx !== -1) {
    localOrders[idx] = { ...localOrders[idx], ...patch, updatedAt };
    writeLocalOrders(localOrders);
  }

  // Update Firestore / queue
  try {
    if (!navigator.onLine) throw new Error('Offline');
    const orderRef = doc(db, ORDERS_COLLECTION, id);
    await commitUpdate(id, { ...patch, updatedAt }, { action, changes, payments, clientAt: updatedAt });
    const updatedSnap = await getDoc(orderRef);
    return updatedSnap.exists() ? normalizeOrder(updatedSnap.data()) : null;
  } catch (e) {
    console.warn('Update queued offline:', id, e?.message);
    enqueue({ type: 'UPDATE', id, patch: { ...patch, updatedAt }, action, changes, payments, clientAt: updatedAt, timestamp: Date.now() });
    return idx !== -1 ? normalizeOrder(localOrders[idx]) : null;
  }
}

/**
 * Cashier collected the deposit: records the amount(s) actually received.
 * @param {Object} order
 * @param {{ usd: number, lbp: number }} amounts
 * @param {string} collectedBy
 */
export async function collectDeposit(order, amounts, collectedBy) {
  const at = new Date().toISOString();
  const by = collectedBy || 'الكاشير';
  return updateOrder(order.id, {
    depositCollected: true,
    depositCollectedAt: at,
    depositCollectedBy: by,
    depositPayment: { usd: Number(amounts.usd) || 0, lbp: Number(amounts.lbp) || 0, at, by },
  }, {
    before: order,
    action: 'deposit',
    payment: { kind: 'deposit', ...amounts, customerName: order.header?.customerName },
  });
}

/** Undo a deposit collection; reverses the recorded amount in /payments. */
export async function undoDeposit(order) {
  const prev = order.depositPayment;
  return updateOrder(order.id, {
    depositCollected: false,
    depositCollectedAt: null,
    depositCollectedBy: null,
    depositPayment: null,
  }, {
    before: order,
    action: 'undo_deposit',
    payment: prev && (prev.usd || prev.lbp)
      ? { kind: 'void', usd: -(prev.usd || 0), lbp: -(prev.lbp || 0), customerName: order.header?.customerName }
      : undefined,
  });
}

/**
 * Cashier collected the final payment: records the amount(s) received
 * and marks the order fully paid.
 */
export async function markPaid(order, amounts, paidBy) {
  const at = new Date().toISOString();
  const by = paidBy || 'الكاشير';
  return updateOrder(order.id, {
    isPaid: true,
    paidAt: at,
    paidBy: by,
    depositCollected: true,
    depositCollectedBy: order.depositCollectedBy || by,
    finalPayment: { usd: Number(amounts.usd) || 0, lbp: Number(amounts.lbp) || 0, at, by },
  }, {
    before: order,
    action: 'payment',
    payment: { kind: 'final', ...amounts, customerName: order.header?.customerName },
  });
}

/** Undo "fully paid"; reverses the recorded final payment in /payments. */
export async function undoPaid(order) {
  const prev = order.finalPayment;
  const patch = {
    isPaid: false,
    paidAt: null,
    paidBy: null,
    finalPayment: null,
  };
  // Paid in one go (no separate deposit was collected): "paid" also marked the
  // deposit as collected, so undoing must reopen the deposit too — otherwise
  // the order would show a deposit that was never received.
  // (Only for payments recorded by this system: older orders have no finalPayment.)
  if (prev && order.footer?.depositPaid && !order.depositPayment) {
    Object.assign(patch, { depositCollected: false, depositCollectedAt: null, depositCollectedBy: null });
  }
  return updateOrder(order.id, patch, {
    before: order,
    action: 'undo_payment',
    payment: prev && (prev.usd || prev.lbp)
      ? { kind: 'void', usd: -(prev.usd || 0), lbp: -(prev.lbp || 0), customerName: order.header?.customerName }
      : undefined,
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

export async function updateProductionStatus(id, newStatus, updatedBy, before) {
  return updateOrder(id, {
    productionStatus: newStatus,
    productionStatusUpdatedAt: new Date().toISOString(),
    productionStatusUpdatedBy: updatedBy || 'المصنع',
  }, { before, action: 'production' });
}

export async function cancelOrder(id, reason, cancelledBy, before) {
  return updateOrder(id, {
    isCancelled: true,
    cancelledReason: reason || 'إلغاء من قبل الزبون / الإدارة',
    cancelledAt: new Date().toISOString(),
    cancelledBy: cancelledBy || 'الموظف',
  }, { before, action: 'cancel' });
}

export async function uncancelOrder(id, before) {
  return updateOrder(id, {
    isCancelled: false,
    cancelledReason: null,
    cancelledAt: null,
    cancelledBy: null,
  }, { before, action: 'uncancel' });
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

/** YYYY-MM-DD in the device's local time zone (the shop's). */
export { localDateString };

function localDateString(offsetDays = 0, from = new Date()) {
  const d = new Date(isNaN(from.getTime()) ? Date.now() : from.getTime());
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Orders that still need attention regardless of when they were created:
 * every order due from `daysBack` days ago onwards (e.g. weddings booked
 * months ahead) and, optionally, every unpaid order. The "latest N" lists
 * alone miss these once enough newer orders have been entered.
 * @param {{ includeUnpaid?: boolean, daysBack?: number }} options
 * @returns {Promise<Object[]>}
 */
export async function listOpenOrders({ includeUnpaid = false, daysBack = 3 } = {}) {
  const queries = [
    query(collection(db, ORDERS_COLLECTION), where('header.deliveryDate', '>=', localDateString(-daysBack))),
  ];
  if (includeUnpaid) {
    queries.push(query(collection(db, ORDERS_COLLECTION), where('isPaid', '==', false)));
  }
  const results = await Promise.allSettled(queries.map((q) => getDocs(q)));
  const lists = results.map((r) => {
    if (r.status === 'fulfilled') return r.value.docs.map((d) => normalizeOrder(d.data()));
    console.warn('Open-orders query failed:', r.reason?.message);
    return [];
  });
  return mergeOrders(...lists);
}

/**
 * Live view of the orders the factory / oversight screens need: the newest
 * `recentCount` orders plus every order due from `daysBack` days ago onwards.
 * Firestore sends the full lists once, then only the orders that change,
 * which keeps reads far below the free plan's daily quota (a 45-second
 * re-read of 300 orders costs ~360k reads/day per open screen).
 * @returns {() => void} unsubscribe
 */
export function subscribeOperationalOrders({ recentCount = 300, daysBack = 3 } = {}, onData, onError) {
  let recent = null;
  let upcoming = null;
  const emit = () => {
    if (recent && upcoming) onData(mergeOrders(recent, upcoming));
  };
  const toOrders = (snap) => snap.docs.map((d) => normalizeOrder(d.data()));

  const stopRecent = onSnapshot(
    query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'), limit(recentCount)),
    (snap) => { recent = toOrders(snap); emit(); },
    (err) => onError?.(err),
  );
  const stopUpcoming = onSnapshot(
    query(collection(db, ORDERS_COLLECTION), where('header.deliveryDate', '>=', localDateString(-daysBack))),
    (snap) => { upcoming = toOrders(snap); emit(); },
    (err) => onError?.(err),
  );
  return () => { stopRecent(); stopUpcoming(); };
}

/**
 * Merge order lists, dropping duplicates (first occurrence wins),
 * newest created first.
 */
export function mergeOrders(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const o of list || []) {
      if (o?.id && !map.has(o.id)) map.set(o.id, o);
    }
  }
  return [...map.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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

// ── Admin report ──────────────────────────────────────────────────

/** Change-history entries for one order, oldest first (admin only). */
export async function getOrderHistory(orderId) {
  const snap = await getDocs(collection(db, ORDERS_COLLECTION, orderId, 'history'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.clientAt || '').localeCompare(b.clientAt || ''));
}

/**
 * Everything the daily report needs for one day (YYYY-MM-DD, shop time):
 * payments taken, orders created, order changes made that day, and all
 * currently unpaid orders. Admin only.
 */
export async function getDailyReportData(day) {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d).toISOString();
  const end = new Date(y, m - 1, d + 1).toISOString();
  const [paySnap, createdSnap, histSnap, open] = await Promise.all([
    getDocs(query(collection(db, 'payments'), where('day', '==', day))),
    getDocs(query(collection(db, ORDERS_COLLECTION), where('createdAt', '>=', start), where('createdAt', '<', end))),
    getDocs(query(collectionGroup(db, 'history'), where('day', '==', day))),
    listOpenOrders({ includeUnpaid: true, daysBack: 0 }),
  ]);
  return {
    payments: paySnap.docs.map((x) => ({ id: x.id, ...x.data() })),
    createdOrders: createdSnap.docs.map((x) => normalizeOrder(x.data())),
    changes: histSnap.docs.map((x) => ({ id: x.id, orderId: x.ref.parent.parent?.id, ...x.data() })),
    unpaidOrders: open.filter((o) => !o.isPaid && !o.isCancelled),
  };
}
