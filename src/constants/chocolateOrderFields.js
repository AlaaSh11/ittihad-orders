// ─────────────────────────────────────────────────────────────────────────────
// نوع الشوكولا — Chocolate type options
// ─────────────────────────────────────────────────────────────────────────────
export const CHOCOLATE_TYPES = [
  'شوكولا داكن',
  'شوكولا حليب',
  'شوكولا أبيض',
  'بلجيكي',
  'وطني',
];

// Quantity unit label per chocolate type.
// unit: 'حبة'  → pieces   |  unit: 'كيلو' → kilograms
// To change a unit, edit this map only — no component logic changes needed.
export const CHOCOLATE_UNIT_MAP = {
  'شوكولا داكن':  'حبة',
  'شوكولا حليب':  'حبة',
  'شوكولا أبيض':  'حبة',
  'بلجيكي':       'حبة',
  'وطني':         'حبة',
};
export const DEFAULT_CHOCOLATE_UNIT = 'حبة';

// ─────────────────────────────────────────────────────────────────────────────
// اسم الشوكولا — Chocolate name / filling types
// (previously exported as CHOCOLATE_FILLING_TYPES — renamed per spec)
// ─────────────────────────────────────────────────────────────────────────────
export const CHOCOLATE_NAMES = [
  'فراولة',
  'كراميل',
  'نوتيلا',
  'بستاشيو',
];

// طريقة التغليف wrapping methods (kept for backward-compat; label replaced on form)
export const CHOCOLATE_WRAPPING_METHODS = [
  'قلب سلوفان',
  'لف',
  'لف مكة',
];
