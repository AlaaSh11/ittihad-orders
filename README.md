# Ittihad Orders

Order-taking app for الاتحاد للحلويات والكيك — React + Vite + Firebase (Auth, Firestore, Storage).

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run lint
npm run test:rules # security-rules tests in the Firebase emulators (needs Java)
```

## Roles & security

Access is enforced by `firestore.rules` and `storage.rules` using the Firebase Auth
custom claim **`role`**. The app also reads the role only from that verified claim.
An account without a role claim has **no access**.

| Role      | Can do                                                                 | Hours (Beirut) |
|-----------|------------------------------------------------------------------------|----------------|
| `admin`   | everything (no deletes)                                                | 24/7           |
| `boss`    | read-only oversight                                                    | 24/7           |
| `staff`   | create/edit orders, payments, cancel, production status, upload photos | 07:00–22:00    |
| `cashier` | payment, deposit, price (`footer`) and production-status fields        | 07:00–22:00    |
| `factory` | production-status fields only                                          | 07:00–22:00    |

The order-serial counter (`metadata/orderCounter`) can only go up by exactly 1. Orders can never be deleted.

### Change history, payments and the daily report

- Every order create/update is written together with an entry in
  `orders/{id}/history` (who, server time, what changed). The rules reject
  order writes without one, and history can never be edited or deleted.
- When the cashier collects a deposit or the final payment they enter the
  amount received in **$, L.L or both**. Each amount is a document in
  `/payments`; undoing a payment adds a reversal (`void`) instead of deleting.
- Admins get **📊 التقرير اليومي**: cash collected (USD / L.L, by type and by
  cashier), orders taken, money still owed, and price changes / reversals /
  cancellations to review. History and payments are readable by admin only.
- The exchange rate used for equivalents lives in `src/constants/currency.js`.

### Assigning roles

Roles are listed in `src/constants/authConfig.js` (`USER_METADATA`). To push them to Firebase as claims:

1. Firebase console → Project settings → Service accounts → **Generate new private key**.
   Keep the file outside the repo and never commit it.
2. Preview the changes, then apply them:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run set-roles -- --dry-run
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run set-roles
   ```
   The script also lists Firebase accounts that are missing from `authConfig.js`. Those accounts will be locked out.

Run it again whenever you add a user or change a role. Users get the new role at their next login.

### Deploy order (important)

Assign the role claims **before** deploying the new rules, or every user will be locked out:

```bash
npm run set-roles                                    # 1. claims
npm run build && firebase deploy --only hosting      # 2. app that reads claims
firebase deploy --only firestore:rules,storage       # 3. rules
```

The live app is hosted on Netlify from `master`, so step 2 is "merge to `master`
and wait for the Netlify deploy". Always deploy the app **before** the rules:
the rules require the change-history entries that only the new app writes.
After a rules deploy, everyone should reload the app so no tab is running an
old version. Index changes (`firestore.indexes.json`) are deployed with
`firebase deploy --only firestore:indexes`.

## Testing locally (no real data)

```bash
npm run emulators                                  # Auth + Firestore + Storage emulators
VITE_USE_EMULATORS=true npm run dev                # app talks to the emulators only
npm run test:rules                                 # security-rules tests
TEST_IGNORE_HOURS=1 npm run test:rules             # same, with working hours always open
```

Emulator accounts are created in the Auth emulator (with a `role` custom claim);
they never exist in the real project.
