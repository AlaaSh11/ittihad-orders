// ─────────────────────────────────────────────────────────────────────────────
// Weight of ONE piece of each chocolate, in kg — from the shop's table
// (chocolate_tables_fixed.docx). Keys are the names used in the app's
// "اسم الشوكولا" list (src/constants/chocolateOrderFields.js); the shop's
// own spelling is noted where it differs.
//
// Pieces in 1 kg = 1 / weight. Used to show "≈ N حبة" for orders entered
// in kg (and "≈ N كغ" for chocolates ordered by the piece).
//
// HOW TO UPDATE: change the weight next to the chocolate, or add a line.
// ─────────────────────────────────────────────────────────────────────────────
import { CHOCOLATE_FILLING_UNIT_MAP, CHOCOLATE_UNIT_MAP, DEFAULT_CHOCOLATE_UNIT } from './chocolateOrderFields';

export const CHOCOLATE_PIECE_WEIGHT_KG = {
  // ── وطني ──
  'شوكولا تشيز كيك':        0.022,
  'لوتس وطني':              0.022,
  'كرانش':                  0.024,
  'كريمة شوكولا + كسر لوز':  0.028,
  'فانتازيا':               0.022, // shop: فنتازيا
  'كسر كاجو':               0.022, // shop: كاجو كسر
  'جندويا':                 0.030,
  'وايفر برالين':            0.022, // shop: وافر
  'Baby':                   0.028,
  'أصابع لوتس':             0.028,
  'أصابع حلاوة':            0.014,
  'ملبن':                   0.024,
  'عرموش':                  0.022,
  'لوز حب':                 0.032,
  'بندق حب':                0.046,

  // ── بلجيكي ──
  'كراب':                   0.018,
  'شوكولا سادة مر':          0.008, // shop: سادة
  'الكازار':                0.026,
  'فستق حلبي':              0.024, // shop: فستق
  'وايفر بالفستق':           0.024, // shop: وافر فستق
  'لوتس مغطّس':             0.030, // shop: Lotus Dipped
  'دايجستف كراميل مدور':     0.024, // shop: ديجستيف
  'اوريو بلجيكي':            0.024, // shop: اوريو
  'شوكولا دبي':             0.028, // shop: Dubai Chocolate
  'غزلت':                   0.022,
  'وايفر نيوتيلا':           0.024, // shop: وافر نيوتلا
  'كريستوفيل':              0.020, // shop: كريسبوفل
};

/** Pieces that make 1 kg, per chocolate (derived from the weights above). */
export const CHOCOLATE_PIECES_PER_KILO = Object.fromEntries(
  Object.entries(CHOCOLATE_PIECE_WEIGHT_KG).map(([name, kg]) => [name, 1 / kg]),
);

/**
 * Estimate for a chocolate quantity: pieces when ordered in kg, kg when
 * ordered by the piece. Returns '' when the chocolate's weight is unknown.
 * @param {string} name      chocolate name (اسم الشوكولا)
 * @param {string|number} quantity
 * @param {'كيلو'|'حبة'} unit
 * @returns {string} e.g. "≈ 90 حبة" or "≈ 0.280 كغ"
 */
export function chocolateEstimate(name, quantity, unit) {
  const kg = CHOCOLATE_PIECE_WEIGHT_KG[name];
  const q = parseFloat(quantity);
  if (!kg || !(q > 0)) return '';
  if (unit === 'حبة') return `≈ ${(q * kg).toFixed(3)} كغ`;
  return `≈ ${Math.round(q / kg)} حبة`;
}

/** Unit a chocolate is ordered in — same rule as the order forms. */
export function chocolateUnit(name, type) {
  return CHOCOLATE_FILLING_UNIT_MAP[name] || CHOCOLATE_UNIT_MAP[type] || DEFAULT_CHOCOLATE_UNIT;
}

/**
 * Quantity text for receipts / WhatsApp: "10 كيلو (≈ 455 حبة)".
 * Returns the bare quantity when nothing is entered or the weight is unknown.
 */
export function describeChocolateQuantity(name, type, quantity) {
  if (quantity === undefined || quantity === null || quantity === '') return '';
  const unit = chocolateUnit(name, type);
  const estimate = chocolateEstimate(name, quantity, unit);
  return `${quantity} ${unit}${estimate ? ` (${estimate})` : ''}`;
}
