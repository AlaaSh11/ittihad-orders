// ============================================================
// auth.js — Firebase Authentication integration & Working Hours Enforcement
//
// Authenticates staff against Firebase Auth using an internal email
// domain mapping (e.g., username "jawad" -> "jawad@ittihad.local").
// Maintains persistent local user session via localStorage so staff remain
// logged in across shifts and page reloads, bound by 7 AM - 10 PM shift hours.
// ============================================================

import { signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from './firebase';
import { USER_METADATA, DEFAULT_METADATA } from '../constants/authConfig';

const SESSION_KEY = 'ittihad_auth_user';
const INTERNAL_DOMAIN = '@ittihad.local';

/**
 * Check if current time is within official working hours (07:00 AM - 10:00 PM).
 * Admins retain 24/7 access.
 * @param {string} role - User role ('admin', 'staff', 'cashier')
 * @returns {boolean}
 */
export function isWithinWorkingHours(role) {
  if (role === 'admin') return true; // Owners / admins retain full 24/7 emergency access
  const now = new Date();
  const hour = now.getHours();
  // Allowed strictly from 07:00 (hour >= 7) until 22:00 (hour < 22)
  return hour >= 7 && hour < 22;
}

/**
 * Resolve staff metadata from username or fallback to defaults.
 */
function enrichUser(username, email) {
  const cleanUsername = username.toLowerCase().trim();
  const meta = USER_METADATA[cleanUsername] || {
    ...DEFAULT_METADATA,
    arabicName: cleanUsername.toUpperCase(),
    role: cleanUsername.includes('cashier') ? 'cashier' : DEFAULT_METADATA.role,
  };
  return {
    username: cleanUsername,
    email,
    arabicName: meta.arabicName,
    role: meta.role,
  };
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
  const shortName = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
  const expectedMeta = USER_METADATA[shortName] || DEFAULT_METADATA;

  // Enforce 7 AM - 10 PM working hours policy prior to auth check
  if (!isWithinWorkingHours(expectedMeta.role)) {
    return { 
      ok: false, 
      error: 'نعتذر، تسجيل الدخول متاح فقط خلال ساعات العمل الرسمية (من 7:00 صباحاً حتى 10:00 مساءً).' 
    };
  }

  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}${INTERNAL_DOMAIN}`;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = enrichUser(shortName, userCredential.user.email);

    // Enforce check again on resolved user metadata just in case
    if (!isWithinWorkingHours(user.role)) {
      await fbSignOut(auth);
      return { 
        ok: false, 
        error: 'نعتذر، تسجيل الدخول متاح فقط خلال ساعات العمل الرسمية (من 7:00 صباحاً حتى 10:00 مساءً).' 
      };
    }

    // Save current session in localStorage for persistent access across browser restarts
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    sessionStorage.removeItem(SESSION_KEY); // Clean up legacy sessionStorage if any
    return { ok: true, user };
  } catch (error) {
    console.error('Firebase Auth Error:', error?.code, error?.message);
    let errorMsg = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    if (error?.code === 'auth/network-request-failed') {
      errorMsg = 'تعذر الاتصال بالشبكة. يرجى التحقق من اتصالك عبر الإنترنت.';
    } else if (error?.code === 'auth/too-many-requests' || error?.code === 'auth/invalid-credential') {
      errorMsg = 'اسم المستخدم أو كلمة المرور غير صحيحة (أو لم تتم إضافتها في Firebase بعد).';
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
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Return the currently logged-in user from storage, or null if not authenticated or outside working hours.
 * @returns {Object|null}
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    
    // Automatic expiration if accessed outside official working hours (after 10 PM / before 7 AM)
    if (!isWithinWorkingHours(user?.role)) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return user;
  } catch {
    return null;
  }
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
