import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0n_CaZPieu8UvFJlY1RZUi7CztAvfb34",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cronogramasec.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cronogramasec",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cronogramasec.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "848884905231",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:848884905231:web:5876c6f1c529121d303a7a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-HCC859F95X"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
