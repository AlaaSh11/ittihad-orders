// ============================================================
// authConfig.js — User Metadata & Roles Definition
//
// Note: Plaintext passwords have been removed. Secure authentication
// is handled via Firebase Auth (Email/Password). This mapping provides
// display metadata and Arabic names for logged in usernames.
//
// SECURITY: the `role` values here are NOT trusted by the app. They are
// the source list for `npm run set-roles` (scripts/set-roles.mjs), which
// writes them as Firebase Auth custom claims. The app and the Firestore /
// Storage rules read the role only from that verified claim. After editing
// a role here, re-run the script.
// ============================================================

export const USER_METADATA = {
  jawad:    { username: 'jawad',    arabicName: 'جواد',                role: 'staff'   },
  naja:     { username: 'naja',     arabicName: 'نجا',                 role: 'staff'   },
  adeeb:    { username: 'adeeb',    arabicName: 'أديب',                role: 'staff'   },
  alaa:     { username: 'alaa',     arabicName: 'علاء - الصندوق',         role: 'cashier' },
  cashier:  { username: 'cashier',  arabicName: 'الصندوق (الكاشير)',   role: 'cashier' },
  cashier1: { username: 'cashier1', arabicName: 'كاشير 1 (الصندوق)',    role: 'cashier' },
  cashier2: { username: 'cashier2', arabicName: 'كاشير 2 (الصندوق)',    role: 'cashier' },
  factory:  { username: 'factory',  arabicName: 'شاشة المصنع (المطبخ)', role: 'factory' },
  packing:    { username: 'packing',    arabicName: 'التغليف',           role: 'factory' },
  packingwed: { username: 'packingwed', arabicName: 'تغليف الأعراس',     role: 'factory' },
  orders:   { username: 'orders',   arabicName: 'المدير / المراقب',    role: 'boss'    },
  boss:     { username: 'boss',     arabicName: 'المدير / المراقب',    role: 'boss'    },
  admin:    { username: 'admin',    arabicName: 'ADMIN',               role: 'admin'   },
};

// Default display metadata for Firebase users not explicitly listed above.
// (Such users get NO role — and no access — until a role claim is assigned.)
export const DEFAULT_METADATA = {
  arabicName: 'موظف',
};

// Role definitions
export const ROLES = {
  ADMIN:   'admin',
  STAFF:   'staff',
  CASHIER: 'cashier',
  FACTORY: 'factory',
  BOSS:    'boss',
};

