// ============================================================
// authConfig.js — User Metadata & Roles Definition
//
// Note: Plaintext passwords have been removed. Secure authentication
// is handled via Firebase Auth (Email/Password). This mapping provides
// display metadata and Arabic names for logged in usernames.
// ============================================================

export const USER_METADATA = {
  jawad:    { username: 'jawad',    arabicName: 'جواد',                role: 'staff'   },
  naja:     { username: 'naja',     arabicName: 'نجا',                 role: 'staff'   },
  adeeb:    { username: 'adeeb',    arabicName: 'أديب',                role: 'staff'   },
  alaa:     { username: 'alaa',     arabicName: 'علاء - الصندوق',         role: 'cashier' },
  cashier:  { username: 'cashier',  arabicName: 'الصندوق (الكاشير)',   role: 'cashier' },
  cashier1: { username: 'cashier1', arabicName: 'كاشير 1 (الصندوق)',    role: 'cashier' },
  cashier2: { username: 'cashier2', arabicName: 'كاشير 2 (الصندوق)',    role: 'cashier' },
  admin:    { username: 'admin',    arabicName: 'ADMIN',               role: 'admin'   },
};

// Default fallback metadata for newly added Firebase users not explicitly listed above
export const DEFAULT_METADATA = {
  arabicName: 'موظف',
  role: 'staff',
};

// Role definitions
export const ROLES = {
  ADMIN:   'admin',
  STAFF:   'staff',
  CASHIER: 'cashier',
};
