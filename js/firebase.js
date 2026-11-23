import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCFTpGS3B2XrMDgLSlMEkopHlpuBWGzPD8",
  authDomain: "lich-day-trung-tam-av.firebaseapp.com",
  projectId: "lich-day-trung-tam-av",
  storageBucket: "lich-day-trung-tam-av.firebasestorage.app",
  messagingSenderId: "441046477478",
  appId: "1:441046477478:web:c10e07e589447ae76b2267",
  measurementId: "G-XWR1KP7CV3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const lessonsRef = collection(db, "lessons");
export const roomsRef = collection(db, "rooms");
export const teachersRef = collection(db, "teachers");
export const subjectsRef = collection(db, "subjects");