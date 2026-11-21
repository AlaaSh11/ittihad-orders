// ============================================================
// auth.js — Firebase Authentication integration & Working Hours Enforcement
//
// Authenticates staff against Firebase Auth using an internal email
// domain mapping (e.g., username "jawad" -> "jawad@ittihad.local").
//
// SECURITY: the user's role comes ONLY from the Firebase Auth custom
// claim `role` (assigned server-side via scripts/set-roles.mjs). The
// copy cached in localStorage is just for fast first paint and is
// re-verified against the ID token on every app load (see
// subscribeToAuth). Firestore/Storage rules enforce the real access.
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth';
import { auth } from './firebase';
import { USER_METADATA, DEFAULT_METADATA, ROLES } from '../constants/authConfig';

const SESSION_KEY = 'ittihad_auth_user';
const INTERNAL_DOMAIN = '@ittihad.local';
const SHOP_TIME_ZONE = 'Asia/Beirut';
const VALID_ROLES = new Set(Object.values(ROLES));

const OUTSIDE_HOURS_ERROR =
  'نعتذر، تسجيل الدخول متاح فقط خلال ساعات العمل الرسمية (من 7:00 صباحاً حتى 10:00 مساءً).';
const NO_ROLE_ERROR =
  'هذا الحساب غير مفعّل بصلاحية في النظام. يرجى التواصل مع الإدارة.';

/** Current hour (0–23) in the shop's time zone, independent of the device's zone. */
function shopHour() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHOP_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
}

/**
 * Check if current time is within official working hours (07:00 – 22:00, Beirut time).
 * Admins and boss retain 24/7 access. This is a UX check; the same window is
 * enforced server-side in firestore.rules / storage.rules.
 * @param {string} role
 * @returns {boolean}
 */
export function isWithinWorkingHours(role) {
  if (role === 'admin' || role === 'boss') return true;
  const hour = shopHour();
  return hour >= 7 && hour < 22;
}

function usernameFromEmail(email) {
  return (email || '').toLowerCase().split('@')[0];
}

/**
 * Build the app user object from a Firebase user, reading the role from the
 * verified ID token claims. Returns null if the account has no valid role.
 */
async function resolveUser(fbUser, forceRefresh = false) {
  const token = await getIdTokenResult(fbUser, forceRefresh);
  const role = token.claims.role;
  if (!VALID_ROLES.has(role)) return null;

  const username = usernameFromEmail(fbUser.email);
  const meta = USER_METADATA[username] || DEFAULT_METADATA;
  return {
    username,
    email: fbUser.email,
    arabicName: meta.arabicName || username.toUpperCase(),
    role,
  };
}

function saveSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    sessionStorage.removeItem(SESSION_KEY); // legacy cleanup
  } catch {
    /* storage unavailable */
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Attempt to log in with short username + password via Firebase.
 * Automatically converts e.g. "jawad" -> "jawad@ittihad.local".
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ ok: boolean, user?: Object, error?: string }>}
 */
export async function login(username, password) {
  const cleanUser = username.trim().toLowerCase();
  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}${INTERNAL_DOMAIN}`;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    // Force a token refresh so newly assigned role claims are picked up.
    const user = await resolveUser(credential.user, true);

    if (!user) {
      await fbSignOut(auth);
      return { ok: false, error: NO_ROLE_ERROR };
    }
    if (!isWithinWorkingHours(user.role)) {
      await fbSignOut(auth);
      return { ok: false, error: OUTSIDE_HOURS_ERROR };
    }

    saveSession(user);
    return { ok: true, user };
  } catch (error) {
    console.error('Firebase Auth Error:', error?.code, error?.message);
    let errorMsg = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    if (error?.code === 'auth/network-request-failed') {
      errorMsg = 'تعذر الاتصال بالشبكة. يرجى التحقق من اتصالك عبر الإنترنت.';
    } else if (error?.code === 'auth/too-many-requests') {
      errorMsg = 'محاولات كثيرة خاطئة. يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
    }
    return { ok: false, error: errorMsg };
  }
}

/**
 * Clear the current session from Firebase and local storage.
 */
export async function logout() {
  try {
    await fbSignOut(auth);
  } catch (e) {
    console.warn('Error signing out from Firebase:', e);
  }
  clearSession();
}

/**
 * Return the cached user for instant first render, or null.
 * NOT a security boundary — App re-validates it via subscribeToAuth().
 * @returns {Object|null}
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!VALID_ROLES.has(user?.role) || !isWithinWorkingHours(user.role)) {
      clearSession();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Subscribe to Firebase auth state and keep the app user in sync with the
 * verified role claim. Calls `onChange(user | null)`.
 *
 * - Signed out in Firebase          → null
 * - Signed in but no valid role     → signs out, null
 * - Network error reading the token → keeps the cached user (offline support);
 *   Firestore rules still validate the real token on every request.
 *
 * @param {(user: Object|null) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeToAuth(onChange) {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      clearSession();
      onChange(null);
      return;
    }
    try {
      const user = await resolveUser(fbUser);
      if (!user) {
        await logout();
        onChange(null);
        return;
      }
      saveSession(user);
      onChange(user);
    } catch (e) {
      console.warn('Could not verify auth token (offline?):', e?.message);
      const cached = getCurrentUser();
      if (cached && usernameFromEmail(fbUser.email) === cached.username) {
        onChange(cached);
      } else {
        onChange(null);
      }
    }
  });
}

/**
 * Check whether a user has at least a given role.
 * @param {Object} user
 * @param {'admin'|'staff'|'cashier'} requiredRole
 * @returns {boolean}
 */
export function hasRole(user, requiredRole) {
  if (!user) return false;
  if (user.role === 'admin') return true; // admin has all permissions
  if (requiredRole === 'cashier') return user.role === 'cashier';
  if (requiredRole === 'staff') return user.role === 'staff' || user.role === 'admin';
  return user.role === requiredRole;
}
