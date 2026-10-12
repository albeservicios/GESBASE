// ============================================================
// EXPORTAR USUARIOS DE FIREBASE AUTH -> JSON
// Exporta email/uid/displayName y hashes de contraseña
// (scrypt de Firebase - ver nota abajo para importar).
// ============================================================

import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(dir, "..");
const keyPath = path.join(serverDir, "serviceAccountKey.json");
const outDir = path.join(serverDir, "data", "export");

if (!fs.existsSync(keyPath)) {
    console.error("Falta server/serviceAccountKey.json");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(keyPath)
});

fs.mkdirSync(outDir, { recursive: true });

const users = [];
let pageToken;
do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const u of result.users) {
        users.push({
            uid: u.uid,
            email: u.email || null,
            displayName: u.displayName || null,
            photoURL: u.photoURL || null,
            emailVerified: u.emailVerified,
            disabled: u.disabled,
            passwordHash: u.passwordHash || null,
            passwordSalt: u.passwordSalt || null,
            createdAt: u.metadata.creationTime
        });
    }
    pageToken = result.pageToken;
} while (pageToken);

const file = path.join(outDir, "_auth_users.json");
fs.writeFileSync(file, JSON.stringify(users, null, 1));
console.log(`${users.length} usuarios -> ${file}`);
console.log(
    "\nNOTA: los hashes usan el scrypt propio de Firebase. Para\n" +
    "importarlos hacen falta los parámetros del hash del proyecto\n" +
    "(Firebase Console > Authentication > Users > ⋮ > Password\n" +
    "hash parameters) como env vars en la importación, o pedir a\n" +
    "los usuarios restablecer la contraseña."
);
process.exit(0);
