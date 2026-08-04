// ============================================================
// ordersStore.js — Firebase Cloud Firestore Order Access Layer
//
// Powered by Google Cloud Firestore with automatic offline fallback.
// - Online: Uses atomic transactions for order serial numbers (CAKE-####)
//           to prevent duplicate IDs across multiple shop POS devices.
// - Offline: Seamlessly falls back to local IndexedDB/localStorage so
//            staff can place and print orders even without shop WiFi!
// ============================================================

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
  runTransaction 
} from 'firebase/firestore';
import { db } from './firebase';

const ORDERS_KEY = 'ittihad_orders_backup';
const COUNTER_KEY = 'ittihad_order_counter';
const STARTING_SERIAL = 1217;
const ORDERS_COLLECTION = 'orders';
const COUNTER_DOC = doc(db, 'metadata', 'orderCounter');

// ── Local failover helpers ────────────────────────────────────────

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
    // Keep max 200 orders in localStorage backup to avoid hitting 5MB limit
    const trimmed = orders.slice(-200);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('LocalStorage quota limit reached for backup:', e);
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Peek at the current order number synchronously for instant UI display.
 */
export function peekCurrentOrderId() {
  const current = parseInt(localStorage.getItem(COUNTER_KEY) ?? STARTING_SERIAL, 10);
  return `CAKE-${current + 1}`;
}

/**
 * Sync the latest global counter from Firebase in the background on startup.
 */
export async function syncCounterFromCloud() {
  try {
    const snap = await getDoc(COUNTER_DOC);
    if (snap.exists()) {
      const cloudSerial = snap.data().serial ?? STARTING_SERIAL;
      // Force local storage to synchronize identically with Firebase database
      localStorage.setItem(COUNTER_KEY, cloudSerial);
    } else {
      // Initialize cloud counter if it doesn't exist yet
      const currentLocal = parseInt(localStorage.getItem(COUNTER_KEY) ?? STARTING_SERIAL, 10);
      await setDoc(COUNTER_DOC, { serial: currentLocal });
    }
  } catch (e) {
    console.warn('Offline or unable to fetch cloud counter:', e?.message);
  }
}

/**
 * Returns the next order ID string (e.g. "CAKE-1218").
 * Uses an atomic cloud transaction when online to guarantee unique numbers across multiple tills.
 */
export async function getNextOrderId() {
  let nextSerial;
  try {
    // Attempt atomic increment in Cloud Firestore
    nextSerial = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(COUNTER_DOC);
      let newSerial = STARTING_SERIAL + 1;
      if (snap.exists()) {
        newSerial = (snap.data().serial ?? STARTING_SERIAL) + 1;
      }
      transaction.set(COUNTER_DOC, { serial: newSerial });
      return newSerial;
    });
  } catch (cloudErr) {
    console.warn('Atomic cloud counter failed (offline?), falling back to local sequence:', cloudErr?.message);
    // Offline fallback
    const current = parseInt(localStorage.getItem(COUNTER_KEY) ?? STARTING_SERIAL, 10);
    nextSerial = current + 1;
  }

  // Always keep local storage counter synchronized with latest assigned serial
  localStorage.setItem(COUNTER_KEY, nextSerial);

  return `CAKE-${nextSerial}`;
}

/**
 * Persist a new order to Google Cloud Firestore with offline local storage mirroring.
 * @param {Object} order
 * @returns {Promise<Object>} savedOrder
 */
export async function createOrder(order) {
  const saved = { ...order, savedAt: new Date().toISOString() };
  
  // 1. Mirror to localStorage backup immediately
  const localOrders = readLocalOrders();
  localOrders.push(saved);
  writeLocalOrders(localOrders);

  // 2. Save to Firebase Cloud Firestore
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, saved.id);
    await setDoc(orderRef, saved);
  } catch (error) {
    console.warn('Error writing order to Firebase (will remain in offline cache/localStorage):', error?.message);
  }

  return saved;
}

/**
 * Return all orders belonging to a customer visit.
 * @param {string} customerVisitId
 * @returns {Promise<Object[]>}
 */
export async function getOrdersByVisit(customerVisitId) {
  try {
    const q = query(collection(db, ORDERS_COLLECTION), where('customerVisitId', '==', customerVisitId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch {
    return readLocalOrders().filter((o) => o.customerVisitId === customerVisitId);
  }
}

/**
 * Partially update an existing order by ID.
 * @param {string} id  e.g. "CAKE-1218"
 * @param {Object} patch
 * @returns {Promise<Object|null>}
 */
export async function updateOrder(id, patch) {
  const updatedAt = new Date().toISOString();
  
  // 1. Update local backup
  const localOrders = readLocalOrders();
  const idx = localOrders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    localOrders[idx] = { ...localOrders[idx], ...patch, updatedAt };
    writeLocalOrders(localOrders);
  }

  // 2. Update Firestore document
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(orderRef, { ...patch, updatedAt });
    const updatedSnap = await getDoc(orderRef);
    return updatedSnap.exists() ? updatedSnap.data() : null;
  } catch (e) {
    console.warn('Firestore update failed, updated in local backup only:', e?.message);
    return idx !== -1 ? localOrders[idx] : null;
  }
}

/**
 * Record that the Cashier has collected the upfront deposit from the customer.
 * @param {string} id  e.g. "CAKE-1218"
 * @param {string} collectedBy  Name of the cashier
 * @returns {Promise<Object|null>}
 */
export async function collectDeposit(id, collectedBy) {
  return updateOrder(id, {
    depositCollected: true,
    depositCollectedAt: new Date().toISOString(),
    depositCollectedBy: collectedBy || 'الكاشير',
  });
}

/**
 * Undo recording of a deposit collection (in case of an accidental button tap).
 * @param {string} id  e.g. "CAKE-1218"
 * @returns {Promise<Object|null>}
 */
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
  // If an older order lacks the isPaid field and either has zero remaining balance or is over 14 days old, classify as paid
  const isOldLegacy = data.isPaid === undefined && (remainingVal === 0 || !data.createdAt || (Date.now() - new Date(data.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000));
  return {
    ...data,
    isPaid: data.isPaid !== undefined ? data.isPaid : isOldLegacy ? true : false,
    depositCollected: data.depositCollected !== undefined ? data.depositCollected : false,
    productionStatus: data.productionStatus || 'received',
    isCancelled: data.isCancelled || false,
  };
}

/**
 * Update factory production status.
 * @param {string} id
 * @param {string} newStatus 'received' | 'in_progress' | 'ready' | 'delivered'
 * @param {string} updatedBy Name of worker/staff
 */
export async function updateProductionStatus(id, newStatus, updatedBy) {
  return updateOrder(id, {
    productionStatus: newStatus,
    productionStatusUpdatedAt: new Date().toISOString(),
    productionStatusUpdatedBy: updatedBy || 'المصنع',
  });
}

/**
 * Cancel an order.
 * @param {string} id
 * @param {string} reason
 * @param {string} cancelledBy
 */
export async function cancelOrder(id, reason, cancelledBy) {
  return updateOrder(id, {
    isCancelled: true,
    cancelledReason: reason || 'إلغاء من قبل الزبون / الإدارة',
    cancelledAt: new Date().toISOString(),
    cancelledBy: cancelledBy || 'الموظف',
  });
}

/**
 * Undo cancellation of an order.
 * @param {string} id
 */
export async function uncancelOrder(id) {
  return updateOrder(id, {
    isCancelled: false,
    cancelledReason: null,
    cancelledAt: null,
    cancelledBy: null,
  });
}

/**
 * Return all orders (newest first), normalized for schema compatibility.
 * @returns {Promise<Object[]>}
 */
export async function listOrders(maxCount = 150) {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => normalizeOrder(doc.data()));
  } catch {
    return [...readLocalOrders()].reverse().slice(0, maxCount).map(normalizeOrder);
  }
}

