#!/usr/bin/env node
// ============================================================
// set-roles.mjs — assign Firebase Auth custom claims (`role`).
//
// The app and the Firestore/Storage security rules trust ONLY this
// claim, so every staff account must have one or it is locked out.
//
// Usage (needs a service-account key for the ittihad-orders project,
// Firebase console → Project settings → Service accounts → Generate key):
//
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run set-roles -- --dry-run
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run set-roles
//
// Roles are read from src/constants/authConfig.js (USER_METADATA).
// Accounts are matched by email `<username>@ittihad.local`.
// The script also lists Firebase users that are NOT in USER_METADATA
// (they will have no access) and any whose claim differs.
// Never commit the service-account key.
// ============================================================

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { USER_METADATA, ROLES } from '../src/constants/authConfig.js';

const DOMAIN = '@ittihad.local';
const dryRun = process.argv.includes('--dry-run');
const validRoles = new Set(Object.values(ROLES));

initializeApp({ credential: applicationDefault(), projectId: 'ittihad-orders' });
const auth = getAuth();

const wanted = new Map(
  Object.entries(USER_METADATA).map(([username, meta]) => [`${username}${DOMAIN}`, meta.role]),
);

for (const [email, role] of wanted) {
  if (!validRoles.has(role)) {
    console.error(`✗ ${email}: invalid role "${role}" in authConfig.js`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit();

let changed = 0;
let unchanged = 0;
const unknown = [];
const seen = new Set();

let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    const email = (user.email || '').toLowerCase();
    const current = user.customClaims?.role;
    if (!wanted.has(email)) {
      unknown.push(`${email || user.uid} (current role: ${current ?? 'none'})`);
      continue;
    }
    seen.add(email);
    const role = wanted.get(email);
    if (current === role) {
      unchanged++;
      continue;
    }
    console.log(`${dryRun ? '[dry-run] would set' : '✓ set'} ${email}: ${current ?? 'none'} → ${role}`);
    if (!dryRun) {
      await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role });
    }
    changed++;
  }
  pageToken = page.pageToken;
} while (pageToken);

const missing = [...wanted.keys()].filter((e) => !seen.has(e));

console.log(`\n${changed} ${dryRun ? 'to change' : 'changed'}, ${unchanged} already correct.`);
if (missing.length) {
  console.log(`\nIn authConfig.js but no Firebase account (create them in the console if needed):\n  ${missing.join('\n  ')}`);
}
if (unknown.length) {
  console.log(`\nFirebase accounts NOT in authConfig.js — they will have NO access:\n  ${unknown.join('\n  ')}`);
}
if (changed && !dryRun) {
  console.log('\nUsers pick up a new role on next login (or within ~1 hour automatically).');
}
