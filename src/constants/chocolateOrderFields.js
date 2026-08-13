// ─────────────────────────────────────────────────────────────────────────────
// نوع الشوكولا — Chocolate type options
// ─────────────────────────────────────────────────────────────────────────────
export const CHOCOLATE_TYPES = [
  'بلجيكي',
  'وطني',
];

// Quantity unit label per chocolate type.
// unit: 'حبة'  → pieces   |  unit: 'كيلو' → kilograms
// To change a unit, edit this map only — no component logic changes needed.
export const CHOCOLATE_UNIT_MAP = {
  'بلجيكي':       'كيلو',
  'وطني':         'كيلو',
};
export const DEFAULT_CHOCOLATE_UNIT = 'كيلو';

// Specific overrides based on the filling name (e.g. some are Piece instead of KG)
export const CHOCOLATE_FILLING_UNIT_MAP = {
  'شوكولا دبي': 'حبة',
};

// ─────────────────────────────────────────────────────────────────────────────
// اسم الشوكولا — Chocolate name / filling types
// (previously exported as CHOCOLATE_FILLING_TYPES — renamed per spec)
// ─────────────────────────────────────────────────────────────────────────────
export const CHOCOLATE_FILLING_MAP = {
  'بلجيكي': [
    'Red Velvet Chocolate',
    'اوريو بلجيكي',
    'دايجستف كراميل مدور',
    'سنيكرز',
    'شوكولا بلجيكي مشكل',
    'شوكولا بيض 1',
    'شوكولا بيض بلجيكي',
    'شوكولا دبي صغير',
    'شوكولا سادة مر',
    'شوكولا مر للسكري',
    'غزلت',
    'فانتازيا بارد',
    'فستق حلبي',
    'فيريرو',
    'كاب كيك',
    'كراب',
    'كراميل+شوفان',
    'كريستوفيل',
    'كسر قلوبات',
    'كندر بارد',
    'لوتس مغطّس',
    'وايفر بالفستق',
    'وايفر مربع',
    'وايفر نيوتيلا',
    'شوكولا دبي',
    'شوكولا كاب فريز',
    'شوكولا كابتشينو',
    'شوكولا هرم كسر قلوبات',
    'بولات جوز الهند',
    'بندق حب بلجيكي',
  ],
  'وطني': [
    'كريمة شوكولا + كسر لوز',
    'بندق حب',
    'جندويا',
    'شوكولا تشيز كيك',
    'شوكولا وطني مشكل',
    'فانتازيا',
    'كرانش',
    'كسر بندق',
    'كسر كاجو',
    'لوتس وطني',
    'لوز حب',
    'وايفر برالين',
  ]
};

export const CHOCOLATE_NAMES = [
  ...CHOCOLATE_FILLING_MAP['بلجيكي'],
  ...CHOCOLATE_FILLING_MAP['وطني'],
];

// طريقة التغليف wrapping methods (kept for backward-compat; label replaced on form)
export const CHOCOLATE_WRAPPING_METHODS = [
  'قلب سلوفان',
  'لف',
  'لف مكة',
];
