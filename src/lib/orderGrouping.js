import { normalizeArabic } from './ordersStore';

/**
 * Builds a lookup map for orders that share the same customer and delivery date.
 * Grouping key uses normalized customer phone (digits only) + deliveryDate.
 * If phone is missing or short, it falls back to normalized customerName + deliveryDate.
 *
 * @param {Array} orders - Array of order objects
 * @returns {Object} map of key -> Order[]
 */
export function buildSameDayCustomerOrdersMap(orders) {
  if (!Array.isArray(orders)) return {};
  const map = {};

  orders.forEach(order => {
    if (!order || order.isCancelled) return;
    const date = order.header?.deliveryDate?.trim();
    if (!date) return;

    const rawPhone = (order.header?.customerPhone || '').replace(/\D/g, '');
    const rawName = normalizeArabic(order.header?.customerName || '').trim();
    
    // Require at least 7 digits for phone matching, else fallback to name
    const key = rawPhone.length >= 7 
      ? `phone_${rawPhone}_${date}` 
      : rawName 
      ? `name_${rawName}_${date}` 
      : null;

    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(order);
  });

  return map;
}

/**
 * Returns grouping metadata if the given order belongs to a multi-order customer on that delivery date.
 *
 * @param {Object} order - The current order object
 * @param {Object} sameDayMap - The map created by buildSameDayCustomerOrdersMap
 * @returns {Object|null}
 */
export function getSameDayCustomerInfo(order, sameDayMap) {
  if (!order || order.isCancelled || !sameDayMap) return null;
  const date = order.header?.deliveryDate?.trim();
  if (!date) return null;

  const rawPhone = (order.header?.customerPhone || '').replace(/\D/g, '');
  const rawName = normalizeArabic(order.header?.customerName || '').trim();
  const key = rawPhone.length >= 7 
    ? `phone_${rawPhone}_${date}` 
    : rawName 
    ? `name_${rawName}_${date}` 
    : null;

  if (!key || !sameDayMap[key]) return null;

  const group = sameDayMap[key];
  if (group.length < 2) return null;

  // Sort chronologically by createdAt (or fallback to ID)
  const sorted = [...group].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB || (a.id || '').localeCompare(b.id || '');
  });

  const index = sorted.findIndex(o => o.id === order.id);
  const siblings = sorted.filter(o => o.id !== order.id);

  // Compute total remaining amount across all orders for this customer on this date
  const combinedRemaining = sorted.reduce((sum, o) => {
    if (o.isPaid) return sum;
    const rem = parseFloat(o.footer?.remaining);
    if (!isNaN(rem) && rem > 0) return sum + rem;
    const pr = parseFloat(o.footer?.price);
    return !isNaN(pr) && pr > 0 ? sum + pr : sum;
  }, 0);

  const allPaid = sorted.every(o => o.isPaid);

  return {
    count: sorted.length,
    index: index >= 0 ? index : 0,
    orderNum: (index >= 0 ? index : 0) + 1,
    deliveryDate: date,
    allOrders: sorted,
    siblings,
    siblingIds: siblings.map(s => s.id),
    combinedRemaining,
    allPaid,
  };
}
