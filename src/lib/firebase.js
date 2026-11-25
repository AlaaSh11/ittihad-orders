// ============================================================
// firebase.js — Firebase Client Initialization & Config
//
// Initializes Google Firebase Authentication and Cloud Firestore.
// Enables robust offline persistence via IndexedDB so staff can
// save orders and generate receipts even if shop WiFi disconnects.
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDxebZQ4rr-w9BtmNUE97I6e6PHi_EC2NE",
  authDomain: "ittihad-orders.firebaseapp.com",
  projectId: "ittihad-orders",
  storageBucket: "ittihad-orders.firebasestorage.app",
  messagingSenderId: "862569935873",
  appId: "1:862569935873:web:596a0655e10865df22fc00",
  measurementId: "G-XCEDLNZZLC"
};

// Local testing: `VITE_USE_EMULATORS=true npm run dev` talks to the Firebase
// emulators (`npm run emulators`) under a demo project, never to real data.
const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';
if (USE_EMULATORS) {
  firebaseConfig.projectId = 'demo-ittihad-orders';
  firebaseConfig.storageBucket = 'demo-ittihad-orders.appspot.com';
}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Storage (for reference photo uploads)
export const storage = getStorage(app);

// Initialize Firestore Database with multi-tab robust offline caching
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // If initializeFirestore fails (e.g., across HMR dev reloads or unverified environments), fall back cleanly
  console.warn("Firestore persistent local cache fallback applied:", e?.message);
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
