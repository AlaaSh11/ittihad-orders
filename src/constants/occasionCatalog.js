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

// عدد السلال — Basket count options (used for single-select)
export const OCCASION_BASKET_COUNTS = [
  'بدون صواني',
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

// لون ورق اللف — Wrapping Paper Color (Catalog Codes)
export const OCCASION_WRAPPING_PAPER_COLORS = [
  'PMM 1',
  'MMC 1',
  'MMC 2',
  'MMC 5',
  'MMC 9',
  'MMC 12',
  'MMC 13',
  'MMC 14',
  'MMC 18',
  'MMC 19',
  'MMC 21',
  'MMC 24',
  'MMC 27',
  'MMC 28',
  'MMC 30',
  'MMC 34',
  'MMC 35',
  'MMC 36',
  'MMC 39',
  'MMC 41',
  'MMC 73',
  'MMC 6',
  'MMC 10',
  'Babies 9 - Princess Pink',
  'Babies 9 - Princess Blue',
  'Babies 8 - Magazine Pink',
  'Babies 8 - Magazine Blue',
  'Babies 7 - Pink',
  'Babies 7 - Blue',
  'Babies 6 - Pink',
  'Babies 6 - Blue',
  'Babies 3 - Pink',
  'Babies 3 - Blue',
  'Babies 2 - Pink',
  'Babies 1 - Pink',
  'Babies 2 - Blue',
];
