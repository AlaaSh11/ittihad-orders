// ============================================================
// firebase.js — Firebase Client Initialization & Config
//
// Initializes Google Firebase Authentication and Cloud Firestore.
// Enables robust offline persistence via IndexedDB so staff can
// save orders and generate receipts even if shop WiFi disconnects.
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore
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

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

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
