// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";


// 🔥 Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCS3WLSYGofKC2VLTevTTLB5orMtqhuvmY",
  authDomain: "king-of-diamonds-3f9c8.firebaseapp.com",
  databaseURL: "https://king-of-diamonds-3f9c8-default-rtdb.firebaseio.com",
  projectId: "king-of-diamonds-3f9c8",
  storageBucket: "king-of-diamonds-3f9c8.firebasestorage.app",
  messagingSenderId: "521723545136",
  appId: "1:521723545136:web:1e1ab70279f7d78261cff5"
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 📡 Initialize Realtime Database
const db = getDatabase(app);

// ✅ Export database reference
export { db };
