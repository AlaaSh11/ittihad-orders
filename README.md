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
