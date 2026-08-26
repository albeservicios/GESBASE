// ==========================================
// FIREBASE.JS - GESBASE
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Authentication
const auth = getAuth(app);

// Firestore
const db = getFirestore(app);

// Storage
const almacenamiento = getStorage(app);

// Exportar
export {
    app,
    auth,
    db,
    almacenamiento
};
