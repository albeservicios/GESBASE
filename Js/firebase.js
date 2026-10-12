import { initializeApp } from "./local/firebase-app.js";
import { getAuth } from "./local/firebase-auth.js";
import { getFirestore } from "./local/firebase-firestore.js";
import { getStorage } from "./local/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const almacenamiento = getStorage(app);
export const storage = almacenamiento;
export { app };
