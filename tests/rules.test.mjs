// Security-rules tests. Run with: npm run test:rules
// (starts the Firestore + Storage emulators via firebase-tools; needs Java)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, collectionGroup, query, where,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-ittihad-orders';
let env;

function loadRules(file) {
  const src = readFileSync(file, 'utf8');
  if (!IGNORE_HOURS) return src;
  const out = src.replace('(beirutHour() >= 7 && beirutHour() < 22)', 'true');
  if (out === src) throw new Error(`working-hours check not found in ${file}`);
  return out;
}

// The rules restrict non-admin/boss roles to 07:00–22:00 Beirut time and the
// emulator uses the real clock, so expectations for those roles depend on now.
const beirutHour = parseInt(
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).find((p) => p.type === 'hour').value, 10);
// TEST_IGNORE_HOURS=1 swaps the working-hours check for `true` so the
// staff/cashier/factory cases can be exercised at any time of day.
const IGNORE_HOURS = process.env.TEST_IGNORE_HOURS === '1';
const IN_HOURS = IGNORE_HOURS || (beirutHour >= 7 && beirutHour < 22);
const duringHours = (p) => (IN_HOURS ? assertSucceeds(p) : assertFails(p));
console.log(`Beirut hour ${beirutHour} → ${IN_HOURS ? 'inside' : 'outside'} working hours`);

const as = (role) =>
  role === null
    ? env.unauthenticatedContext()
    : env.authenticatedContext(`uid-${role ?? 'norole'}`, role ? { role } : {});
const db = (role) => as(role).firestore();

const ORDER = {
  id: 'CAKE-2000',
  createdAt: '2026-11-21T10:00:00.000Z',
  customerVisitId: 'v1',
  header: { customerName: 'test', deliveryDate: '2026-11-22' },
  items: [],
  footer: { price: '50', depositAmount: '10', remaining: '40' },
  isPaid: false,
  depositCollected: false,
  productionStatus: 'received',
  isCancelled: false,
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: loadRules('firestore.rules') },
    storage: { rules: loadRules('storage.rules') },
  });
});
after(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orders/CAKE-2000'), { ...ORDER, lastChangeId: 'seed' });
    await setDoc(doc(ctx.firestore(), 'metadata/orderCounter'), { serial: 2000 });
  });
});


// ── Helpers: writes the way the app does them (order + history in one batch)
const historyEntry = (r, fields, action = 'update') => ({
  action,
  fields,
  changes: [],
  uid: `uid-${r ?? 'norole'}`,
  by: String(r),
  role: r ?? '',
  at: serverTimestamp(),
  clientAt: 'x',
  day: '2026-11-21',
});
async function adminRead(path) {
  let ids;
  await env.withSecurityRulesDisabled(async (ctx) => {
    ids = (await getDocs(collection(ctx.firestore(), path))).docs.map((d) => d.id);
  });
  return ids;
}
const topFields = (patch) => [...new Set(Object.keys(patch).map((k) => k.split('.')[0]))];

function change(r, id, patch, { fields = topFields(patch), payment, history = {} } = {}) {
  const fs = db(r);
  const b = writeBatch(fs);
  const h = doc(collection(fs, 'orders', id, 'history'));
  b.update(doc(fs, 'orders', id), { ...patch, lastChangeId: h.id });
  b.set(h, { ...historyEntry(r, fields), ...history });
  if (payment) {
    b.set(doc(collection(fs, 'payments')), {
      orderId: id, changeId: h.id, kind: 'final', usd: 0, lbp: 0,
      uid: `uid-${r}`, by: String(r), at: serverTimestamp(), clientAt: 'x', day: '2026-11-21',
      customerName: 'test', ...payment,
    });
  }
  return b.commit();
}

function create(r, order) {
  const fs = db(r);
  const b = writeBatch(fs);
  const h = doc(collection(fs, 'orders', order.id, 'history'));
  b.set(doc(fs, 'orders', order.id), { ...order, lastChangeId: h.id });
  b.set(h, historyEntry(r, [], 'create'));
  return b.commit();
}

// ── Identity ──────────────────────────────────────────────────
test('unauthenticated and role-less users have no access', async () => {
  for (const r of [null, undefined]) {
    await assertFails(getDoc(doc(db(r), 'orders/CAKE-2000')));
    await assertFails(create(r, { ...ORDER, id: 'CAKE-2001' }));
    await assertFails(change(r, 'CAKE-2000', { isPaid: true }));
    await assertFails(updateDoc(doc(db(r), 'metadata/orderCounter'), { serial: 2001 }));
  }
});

test('an unknown role claim has no access', async () => {
  await assertFails(getDoc(doc(db('superuser'), 'orders/CAKE-2000')));
});

// ── Reads ─────────────────────────────────────────────────────
test('admin and boss can read at any time; others during working hours', async () => {
  await assertSucceeds(getDoc(doc(db('admin'), 'orders/CAKE-2000')));
  await assertSucceeds(getDoc(doc(db('boss'), 'orders/CAKE-2000')));
  for (const r of ['staff', 'cashier', 'factory']) {
    await duringHours(getDoc(doc(db(r), 'orders/CAKE-2000')));
  }
});

// ── Create ────────────────────────────────────────────────────
test('only staff/admin can create orders, with a valid id', async () => {
  const o = { ...ORDER, id: 'CAKE-2001' };
  await assertSucceeds(create('admin', o));
  await env.clearFirestore();
  await duringHours(create('staff', o));
  for (const r of ['cashier', 'factory', 'boss']) {
    await assertFails(create(r, { ...ORDER, id: 'CAKE-2002' }));
  }
});

test('order id must match document id and CAKE-<n> format', async () => {
  const fs = db('admin');
  const b = writeBatch(fs);
  const h = doc(collection(fs, 'orders', 'CAKE-2003', 'history'));
  b.set(doc(fs, 'orders', 'CAKE-2003'), { ...ORDER, id: 'CAKE-9999', lastChangeId: h.id });
  b.set(h, historyEntry('admin', [], 'create'));
  await assertFails(b.commit());
  await assertFails(create('admin', { ...ORDER, id: 'TEMP-OFFLINE-1' }));
  await assertFails(create('admin', { ...ORDER, id: 'CAKE-2004', productionStatus: 'hacked' }));
});

// ── Change history ────────────────────────────────────────────
test('order writes without a history entry are rejected', async () => {
  await assertFails(setDoc(doc(db('admin'), 'orders/CAKE-2005'), { ...ORDER, id: 'CAKE-2005' }));
  await assertFails(setDoc(doc(db('admin'), 'orders/CAKE-2005'), { ...ORDER, id: 'CAKE-2005', lastChangeId: 'nope' }));
  await assertFails(updateDoc(doc(db('admin'), 'orders/CAKE-2000'), { isPaid: true }));
  // Re-using the previous change id does not count as a new entry.
  await assertFails(updateDoc(doc(db('admin'), 'orders/CAKE-2000'), { isPaid: true, lastChangeId: 'seed' }));
});

test('history must list every changed field, with the real author and server time', async () => {
  // Hides the price change
  await assertFails(change('admin', 'CAKE-2000', { 'footer.price': '1', isPaid: true }, { fields: ['isPaid'] }));
  // Claims to be someone else
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { history: { uid: 'uid-staff' } }));
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { history: { role: 'staff' } }));
  // Back-dated
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { history: { at: new Date(2020, 0, 1) } }));
  // Extra fields in the entry
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { history: { note: 'x' } }));
  // Listing extra (unchanged) fields is fine
  await assertSucceeds(change('admin', 'CAKE-2000', { isPaid: true }, { fields: ['isPaid', 'footer'] }));
});

test('history is append-only, cannot be created on its own, and only admin reads it', async () => {
  await assertSucceeds(change('admin', 'CAKE-2000', { isPaid: true }));
  const id = (await adminRead('orders/CAKE-2000/history'))[0];
  const path = `orders/CAKE-2000/history/${id}`;
  await assertSucceeds(getDoc(doc(db('admin'), path)));
  await assertSucceeds(getDocs(query(collectionGroup(db('admin'), 'history'), where('day', '==', '2026-11-21'))));
  for (const r of ['boss', 'staff', 'cashier', 'factory']) {
    await assertFails(getDoc(doc(db(r), path)));
    await assertFails(getDocs(query(collectionGroup(db(r), 'history'), where('day', '==', '2026-11-21'))));
  }
  await assertFails(updateDoc(doc(db('admin'), path), { by: 'someone else' }));
  await assertFails(deleteDoc(doc(db('admin'), path)));
  await assertFails(setDoc(doc(db('admin'), 'orders/CAKE-2000/history/standalone'), historyEntry('admin', [])));
});

// ── Payments ──────────────────────────────────────────────────
test('payments: recorded with the order change, USD and/or LBP, admin-only read, append-only', async () => {
  const paid = { isPaid: true, paidAt: 'x', paidBy: 'c', finalPayment: { usd: 20, lbp: 900000 }, updatedAt: 'x' };
  await assertSucceeds(change('admin', 'CAKE-2000', paid, { payment: { usd: 20, lbp: 900000 } }));
  await duringHours(change('cashier', 'CAKE-2000', { ...paid, paidBy: 'c2' }, { payment: { usd: 0, lbp: 4500000 } }));
  await duringHours(change('cashier', 'CAKE-2000', { isPaid: false, finalPayment: null }, { payment: { kind: 'void', usd: -20, lbp: -900000 } }));

  // invalid amounts / kinds
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { usd: 0, lbp: 0 } }));
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { usd: -5, lbp: 0 } }));
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { kind: 'void', usd: 5, lbp: 0 } }));
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { kind: 'gift', usd: 5, lbp: 0 } }));
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { usd: '5', lbp: 0 } }));
  // forged author or time
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { usd: 5, uid: 'uid-cashier' } }));
  await assertFails(change('admin', 'CAKE-2000', { isPaid: true }, { payment: { usd: 5, at: new Date(2020, 0, 1) } }));
  // factory and boss cannot record money
  await assertFails(change('factory', 'CAKE-2000', { productionStatus: 'ready' }, { payment: { usd: 5 } }));
  await assertFails(change('boss', 'CAKE-2000', { isPaid: true }, { payment: { usd: 5 } }));
  // a payment on its own (no order change) is rejected
  await assertFails(setDoc(doc(db('admin'), 'payments/p1'), {
    orderId: 'CAKE-2000', changeId: 'seed', kind: 'final', usd: 5, lbp: 0,
    uid: 'uid-admin', by: 'a', at: serverTimestamp(), clientAt: 'x', day: '2026-11-21', customerName: 't',
  }));

  const ids = await adminRead('payments');
  assert.equal(ids.length, IN_HOURS ? 3 : 1);
  const path = `payments/${ids[0]}`;
  await assertSucceeds(getDocs(query(collection(db('admin'), 'payments'), where('day', '==', '2026-11-21'))));
  for (const r of ['boss', 'staff', 'cashier', 'factory']) {
    await assertFails(getDoc(doc(db(r), path)));
  }
  await assertFails(updateDoc(doc(db('admin'), path), { usd: 1 }));
  await assertFails(deleteDoc(doc(db('admin'), path)));
});

// ── Update ────────────────────────────────────────────────────
test('boss is read-only', async () => {
  await assertFails(change('boss', 'CAKE-2000', { productionStatus: 'ready' }));
});

test('factory can only change production status', async () => {
  await duringHours(change('factory', 'CAKE-2000', {
    productionStatus: 'in_progress',
    productionStatusUpdatedAt: 'x',
    productionStatusUpdatedBy: 'factory',
    updatedAt: 'x',
  }));
  await assertFails(change('factory', 'CAKE-2000', { isPaid: true, updatedAt: 'x' }));
  await assertFails(change('factory', 'CAKE-2000', { 'footer.price': '1' }));
  await assertFails(change('factory', 'CAKE-2000', { productionStatus: 'bogus' }));
});

test('cashier can handle payments/footer/production but not order content or cancellation', async () => {
  await duringHours(change('cashier', 'CAKE-2000', { isPaid: true, paidAt: 'x', paidBy: 'c', depositCollected: true, depositCollectedBy: 'c', updatedAt: 'x' }));
  await duringHours(change('cashier', 'CAKE-2000', { footer: { ...ORDER.footer, price: '60', remaining: '50' }, updatedAt: 'x' }));
  await assertFails(change('cashier', 'CAKE-2000', { header: { customerName: 'changed' } }));
  await assertFails(change('cashier', 'CAKE-2000', { items: [{ x: 1 }] }));
  await assertFails(change('cashier', 'CAKE-2000', { isCancelled: true }));
});

test('staff can edit orders but not identity fields', async () => {
  await duringHours(change('staff', 'CAKE-2000', { header: { customerName: 'edited' }, isCancelled: true, updatedAt: 'x' }));
  await assertFails(change('staff', 'CAKE-2000', { createdAt: 'forged' }));
  await assertFails(change('staff', 'CAKE-2000', { customerVisitId: 'other' }));
  await assertFails(change('staff', 'CAKE-2000', { id: 'CAKE-1' }));
});

test('open-orders queries (upcoming by delivery date, unpaid) are allowed for every role', async () => {
  const upcoming = (r) => getDocs(query(collection(db(r), 'orders'), where('header.deliveryDate', '>=', '2026-11-19')));
  const unpaid = (r) => getDocs(query(collection(db(r), 'orders'), where('isPaid', '==', false)));
  for (const r of ['admin', 'boss']) {
    const snap = await assertSucceeds(upcoming(r));
    assert.deepEqual(snap.docs.map((d) => d.id), ['CAKE-2000']);
    assert.equal((await assertSucceeds(unpaid(r))).size, 1);
  }
  for (const r of ['staff', 'cashier', 'factory']) {
    await duringHours(upcoming(r));
    await duringHours(unpaid(r));
  }
  await assertFails(upcoming(null));
});

test('re-saving an order from the form updates it (header, items, footer, search fields)', async () => {
  const patch = {
    header: { customerName: 'new name', deliveryDate: '2026-11-23' },
    items: [{ id: 'i1', orderType: 'cake', body: {} }],
    footer: { price: '60', depositAmount: '10', remaining: '50' },
    searchName: 'new name',
    searchPhone: '96170000000',
    updatedAt: '2026-11-21T11:00:00.000Z',
  };
  await assertSucceeds(change('admin', 'CAKE-2000', patch));
  await duringHours(change('staff', 'CAKE-2000', { ...patch, updatedAt: 'y' }));
  const other = { ...patch, header: { customerName: 'third name' }, items: [], updatedAt: 'z' };
  await assertFails(change('cashier', 'CAKE-2000', other));
  await assertFails(change('factory', 'CAKE-2000', other));
});

test('nobody can delete orders', async () => {
  for (const r of ['admin', 'staff', 'cashier', 'factory', 'boss']) {
    await assertFails(deleteDoc(doc(db(r), 'orders/CAKE-2000')));
  }
});

// ── Counter ───────────────────────────────────────────────────
test('counter can only be incremented by exactly 1 by staff/admin', async () => {
  await assertSucceeds(updateDoc(doc(db('admin'), 'metadata/orderCounter'), { serial: 2001 }));
  await assertFails(updateDoc(doc(db('admin'), 'metadata/orderCounter'), { serial: 1 }));
  await assertFails(updateDoc(doc(db('admin'), 'metadata/orderCounter'), { serial: 5000 }));
  await assertFails(updateDoc(doc(db('admin'), 'metadata/orderCounter'), { serial: 2002, extra: true }));
  await assertFails(deleteDoc(doc(db('admin'), 'metadata/orderCounter')));
  await duringHours(updateDoc(doc(db('staff'), 'metadata/orderCounter'), { serial: 2002 }));
  for (const r of ['cashier', 'factory', 'boss']) {
    await assertFails(updateDoc(doc(db(r), 'metadata/orderCounter'), { serial: 2003 }));
  }
});

test('counter can be created once when missing', async () => {
  await env.clearFirestore();
  await assertSucceeds(setDoc(doc(db('admin'), 'metadata/orderCounter'), { serial: 1217 }));
  await assertFails(setDoc(doc(db('admin'), 'metadata/orderCounter'), { serial: 0 }));
});

test('other collections are closed', async () => {
  await assertFails(setDoc(doc(db('admin'), 'metadata/other'), { a: 1 }));
  await assertFails(setDoc(doc(db('admin'), 'users/x'), { a: 1 }));
});

// ── Storage ───────────────────────────────────────────────────
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('only staff/admin can upload images; no overwrite', async () => {
  const st = (r) => as(r).storage();
  await assertSucceeds(uploadString(ref(st('admin'), 'orders/photos/a.png'), PNG, 'data_url'));
  await assertFails(uploadString(ref(st('admin'), 'orders/photos/a.png'), PNG, 'data_url'));
  await duringHours(uploadString(ref(st('staff'), 'orders/photos/b.png'), PNG, 'data_url'));
  for (const r of ['cashier', 'factory', 'boss', undefined, null]) {
    await assertFails(uploadString(ref(st(r), `orders/photos/c-${r}.png`), PNG, 'data_url'));
  }
  await assertFails(uploadString(ref(st('admin'), 'orders/photos/d.txt'), 'hello', 'raw', { contentType: 'text/plain' }));
  await assertFails(uploadString(ref(st('admin'), 'elsewhere/e.png'), PNG, 'data_url'));
  await assertSucceeds(getBytes(ref(st('boss'), 'orders/photos/a.png')));
  await assertFails(getBytes(ref(st(undefined), 'orders/photos/a.png')));
});
