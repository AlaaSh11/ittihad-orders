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
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-ittihad-orders';
let env;

// The rules restrict non-admin/boss roles to 07:00–22:00 Beirut time and the
// emulator uses the real clock, so expectations for those roles depend on now.
const beirutHour = parseInt(
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).find((p) => p.type === 'hour').value, 10);
const IN_HOURS = beirutHour >= 7 && beirutHour < 22;
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
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});
after(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orders/CAKE-2000'), ORDER);
    await setDoc(doc(ctx.firestore(), 'metadata/orderCounter'), { serial: 2000 });
  });
});

// ── Identity ──────────────────────────────────────────────────
test('unauthenticated and role-less users have no access', async () => {
  for (const r of [null, undefined]) {
    await assertFails(getDoc(doc(db(r), 'orders/CAKE-2000')));
    await assertFails(setDoc(doc(db(r), 'orders/CAKE-2001'), { ...ORDER, id: 'CAKE-2001' }));
    await assertFails(updateDoc(doc(db(r), 'orders/CAKE-2000'), { isPaid: true }));
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
  await assertSucceeds(setDoc(doc(db('admin'), 'orders/CAKE-2001'), o));
  await env.clearFirestore();
  await duringHours(setDoc(doc(db('staff'), 'orders/CAKE-2001'), o));
  for (const r of ['cashier', 'factory', 'boss']) {
    await assertFails(setDoc(doc(db(r), 'orders/CAKE-2002'), { ...ORDER, id: 'CAKE-2002' }));
  }
});

test('order id must match document id and CAKE-<n> format', async () => {
  await assertFails(setDoc(doc(db('admin'), 'orders/CAKE-2003'), { ...ORDER, id: 'CAKE-9999' }));
  await assertFails(setDoc(doc(db('admin'), 'orders/TEMP-OFFLINE-1'), { ...ORDER, id: 'TEMP-OFFLINE-1' }));
  await assertFails(setDoc(doc(db('admin'), 'orders/CAKE-2004'), { ...ORDER, id: 'CAKE-2004', productionStatus: 'hacked' }));
});

// ── Update ────────────────────────────────────────────────────
test('boss is read-only', async () => {
  await assertFails(updateDoc(doc(db('boss'), 'orders/CAKE-2000'), { productionStatus: 'ready' }));
});

test('factory can only change production status', async () => {
  const ref_ = doc(db('factory'), 'orders/CAKE-2000');
  await duringHours(updateDoc(ref_, {
    productionStatus: 'in_progress',
    productionStatusUpdatedAt: 'x',
    productionStatusUpdatedBy: 'factory',
    updatedAt: 'x',
  }));
  await assertFails(updateDoc(ref_, { isPaid: true, updatedAt: 'x' }));
  await assertFails(updateDoc(ref_, { 'footer.price': '1' }));
  await assertFails(updateDoc(ref_, { productionStatus: 'bogus' }));
});

test('cashier can handle payments/footer/production but not order content or cancellation', async () => {
  const ref_ = doc(db('cashier'), 'orders/CAKE-2000');
  await duringHours(updateDoc(ref_, { isPaid: true, paidAt: 'x', paidBy: 'c', depositCollected: true, depositCollectedBy: 'c', updatedAt: 'x' }));
  await duringHours(updateDoc(ref_, { footer: { ...ORDER.footer, price: '60', remaining: '50' }, updatedAt: 'x' }));
  await assertFails(updateDoc(ref_, { header: { customerName: 'changed' } }));
  await assertFails(updateDoc(ref_, { items: [{ x: 1 }] }));
  await assertFails(updateDoc(ref_, { isCancelled: true }));
});

test('staff can edit orders but not identity fields', async () => {
  const ref_ = doc(db('staff'), 'orders/CAKE-2000');
  await duringHours(updateDoc(ref_, { header: { customerName: 'edited' }, isCancelled: true, updatedAt: 'x' }));
  await assertFails(updateDoc(ref_, { createdAt: 'forged' }));
  await assertFails(updateDoc(ref_, { customerVisitId: 'other' }));
  await assertFails(updateDoc(ref_, { id: 'CAKE-1' }));
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
  await assertSucceeds(updateDoc(doc(db('admin'), 'orders/CAKE-2000'), patch));
  await duringHours(updateDoc(doc(db('staff'), 'orders/CAKE-2000'), patch));
  await assertFails(updateDoc(doc(db('cashier'), 'orders/CAKE-2000'), patch));
  await assertFails(updateDoc(doc(db('factory'), 'orders/CAKE-2000'), patch));
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
