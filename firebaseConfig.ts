// firebaseConfig.ts
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCK8OikOvF6oTrZ4565Lakf5U0anbrXtP0",
  authDomain: "trackseat-bd7c5.firebaseapp.com",
  projectId: "trackseat-bd7c5",
  storageBucket: "trackseat-bd7c5.appspot.com",
  messagingSenderId: "759687208177",
  appId: "1:759687208177:android:bcd33c71ef74f6becddd50",
  databaseURL: "https://trackseat-bd7c5-default-rtdb.firebaseio.com/",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
