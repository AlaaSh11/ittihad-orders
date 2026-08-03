// ─────────────────────────────────────────────────────────────────────────────
// نوع الضيافة — Hospitality / Favor types with their quantity unit label.
// unit: 'حبة'  → quantity is measured in pieces
// unit: 'كيلو' → quantity is measured in kilograms
//
// To add a new type, append an entry here. No component changes needed.
// ─────────────────────────────────────────────────────────────────────────────
export const HOSPITALITY_TYPES = [
  { label: 'حلويات فردية',  unit: 'حبة'  },
  { label: 'كعك',           unit: 'حبة'  },
  { label: 'شوكولا',        unit: 'حبة'  },
  { label: 'مكسرات',        unit: 'كيلو' },
  { label: 'تمر',           unit: 'كيلو' },
  { label: 'ملبس',          unit: 'كيلو' },
  { label: 'بسكويت',        unit: 'حبة'  },
  { label: 'مشكل حلويات',   unit: 'كيلو' },
];

// لون التغليف — Wrapping color
export const OCCASION_WRAPPING_COLORS = [
  'ذهبي',
  'أبيض',
  'برنز',
];

// طريقة التغليف/اللف — Wrapping method
export const OCCASION_WRAPPING_METHODS = [
  'لف سولوفان',
  'لف مكنة',
];

// عدد السلال — Basket count options (used for multi-select)
export const OCCASION_BASKET_COUNTS = [
  'بدون سواني',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
];

// Note: OCCASION_WRAPPING_PAPER_COLORS removed — field deleted from Tab 2 per spec.
