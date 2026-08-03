// ─────────────────────────────────────────────────────────────────────────────
// Chocolate Pieces-per-Kilo Lookup Table
//
// Maps each اسم الشوكولا value to the number of pieces that make one kilogram.
// Used by SimpleOrderBody (Tab 4) to auto-calculate weight from عدد الحبات.
//
// HOW TO UPDATE:
//   1. Open this file.
//   2. Change the number next to the chocolate name you want to update.
//   3. Save — no other file needs to change.
//
// TODO: Replace placeholder values (12) with real ratios from the shop.
// ─────────────────────────────────────────────────────────────────────────────
export const CHOCOLATE_PIECES_PER_KILO = {
  'فراولة':   12, // TODO: confirm real ratio
  'كراميل':   12, // TODO: confirm real ratio
  'نوتيلا':   12, // TODO: confirm real ratio
  'بستاشيو':  12, // TODO: confirm real ratio
  // Add new chocolate names here as needed:
  // 'اسم جديد': <pieces per kilo>,
};
