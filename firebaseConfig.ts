// firebaseConfig.ts
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  Auth, 
  initializeAuth, 
  //@ts-ignore - silences version mismatch warnings
  getReactNativePersistence 
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

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

// 1. Initialize App
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. SAFE AUTH INITIALIZATION
let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    // This is the standard way for Expo 54
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  } catch (e) {
    auth = getAuth(app);
  }
}

const db = getDatabase(app);
const storage = getStorage(app);

export { app, auth, db, storage };