// All values CONFIRMED from spreadsheet specification.

// الشكل — Cake shape options
export const CAKE_SHAPES = [
  'مستطيل',
  'مدور',
  'قلب',
  'الشكل على المجموعة',
];
export const DEFAULT_CAKE_SHAPE = 'قلب';

// نوع القالب — Cake type options
export const CAKE_TYPES = [
  'جلواز',
  'تشيز كيك',
  'لايت كيك',
  'موس شوكولا',
  'توبيكس كيك',
  'أوريو كيك',
  'لوتس كيك',
  'بستاشيو كيك',
  'با با روم',
  'تارت فواكه',
  'تارت فريز',
  'فريزيار',
  'ميلفي',
  'غلاسي عربي',
  'غلاسي إيطالي',
  'Bûche de Noël 30 cm',
  'Bûche de Noël 40 cm',
];
export const DEFAULT_CAKE_TYPE = 'جلواز';

// النكهة — Flavor options
export const CAKE_FLAVORS = [
  'شوكولا',
  'فانيل',
];

// الحشوة — Filling options
export const CAKE_FILLINGS = [
  'كريمة',
  'فواكه',
  'مكسرات',
  'لوتس',
  'بستاشيو',
  'فريز',
  'نيوتيلا',
];

// لون القالب — Cake color options
export const CAKE_COLORS = [
  'أبيض',
  'فضي',
  'ذهبي',
];

// الكتابة على — Write-on surface options
export const WRITE_ON_OPTIONS = [
  'الصورة',
  'القالب',
  'بلاك',
  'أرضية القالب',
];

// الكتابة — Inscription preset phrases
export const INSCRIPTION_PRESETS = [
  'HAPPY BIRTHDAY',
  'HAPPY ANNIVERSARY',
  "HAPPY MOTHER'S DAY",
  'عيد سعيد',
  'خطوبة مباركة',
  'ألف مبروك',
];

// حجم الصورة — Photo size options (includes "بلا صورة" for no-photo orders)
export const PHOTO_SIZES = [
  'A5',
  'A4',
  'A3',
  'بلا صورة',
];
export const DEFAULT_PHOTO_SIZE = 'A4';

// مصدر الصورة — Photo source options
export const PHOTO_SOURCES = [
  'المجموعة',
  'الإنترنت',
  'الزبون',
];
export const DEFAULT_PHOTO_SOURCE = 'المجموعة';

// ─────────────────────────────────────────────────────────────────────────────
// Shape → Allowed Serve Counts mapping
// Defines which عدد الأشخاص (serves) options are shown per الشكل (shape).
// Update the arrays here when adding new shapes or resizing charts — no
// component logic needs to change.
// ─────────────────────────────────────────────────────────────────────────────
export const SHAPE_SERVES_MAP = {
  // Heart shapes are limited to smaller sizes that can hold the heart form cleanly
  'قلب': [6, 10, 18, 22, 27, 34, 40],
  // Round cakes support all sizes
  'مدور': [6, 10, 18, 22, 27, 34, 40, 45, 54, 60, 66, 81, 93, 107, 120, 133, 150],
  // Rectangular cakes support all sizes (including the rectangular dimension entries)
  'مستطيل': [15, 16, 19, 27, 34, 40, 45, 54, 60, 66, 81, 93, 107, 120, 133, 150],
  // Custom / group shape — no restriction, show everything
  'الشكل على المجموعة': [6, 10, 15, 16, 18, 19, 22, 27, 34, 40, 45, 54, 60, 66, 81, 93, 107, 120, 133, 150],
};

// ─────────────────────────────────────────────────────────────────────────────
// Add-ons / Accessories — chip selector items for the cake order form.
// Each item has:
//   id     {string}  Stable key stored in bodyData.addons[]
//   label  {string}  Display label (Arabic)
//   price  {number}  Unit price in shop currency (used for price hints / totals)
//
// To add a new add-on, append an entry here — no component changes needed.
// ─────────────────────────────────────────────────────────────────────────────
export const CAKE_ADDONS = [
  { id: 'crown_gold',  label: 'تاج ذهبي',  price: 0 },
  { id: 'crown_silver',label: 'تاج فضي',   price: 0 },
  { id: 'sword_gold',  label: 'سيف ذهبي',  price: 0 },
  { id: 'sword_silver',label: 'سيف فضي',   price: 0 },
];
// Note: prices above are set to 0 (TBD). Fill in real prices to enable
// automatic price contribution from the AddonsSelector component.
