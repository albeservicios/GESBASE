// ==========================================
// GESBASE - CONEXIÓN FIREBASE
// ==========================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getAuth } from
"https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getFirestore } from
"https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { getStorage } from
"https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

import { firebaseConfig } from
"./firebase-config.js";


// ==========================================
// INICIALIZAR FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);


// ==========================================
// SERVICIOS FIREBASE
// ==========================================

const auth = getAuth(app);

const db = getFirestore(app);

const almacenamiento = getStorage(app);


// ==========================================
// EXPORTAR
// ==========================================

export {
    app,
    auth,
    db,
    almacenamiento
};
