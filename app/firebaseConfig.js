// firebaseConfig.ts
import { getApp, getApps, initializeApp } from "firebase/app";
// 🔑 Import the correct functions and AsyncStorage
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";

import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCK8OikOvF6oTrZ4565Lakf5U0anbrXtP0",
  authDomain: "trackseat-bd7c5.firebaseapp.com",
  projectId: "trackseat-bd7c5",
  storageBucket: "trackseat-bd7c5.appspot.com",
  messagingSenderId: "759687208177",
  appId: "1:759687208177:web:559859135ec31d24cddd50",
  measurementId: "G-TTMERSZ12J",
  databaseURL: "https://trackseat-bd7c5-default-rtdb.firebaseio.com/",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 🔑 CRITICAL FIX: Initialize Auth with AsyncStorage Persistence
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

const db = getDatabase(app);
const storage = getStorage(app);

// NOTE: Expo Router warns if a .ts file is in /app without a default export.
// We add a dummy default export to silence this warning.
export default function DummyConfig() { return null; }

export { app, auth, db, storage };
