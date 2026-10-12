// ============================================================
// EXPORTAR FIREBASE STORAGE -> server/uploads/
// Descarga todo el bucket preservando rutas. Requiere
// server/serviceAccountKey.json
//   npm run export:storage
// ============================================================

import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(dir, "..");
const keyPath = path.join(serverDir, "serviceAccountKey.json");
const uploadsDir = path.join(serverDir, "uploads");

if (!fs.existsSync(keyPath)) {
    console.error(
        "Falta server/serviceAccountKey.json\n" +
        "Descargalo desde Firebase Console > Configuración > " +
        "Cuentas de servicio."
    );
    process.exit(1);
}

const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const bucket =
    process.env.STORAGE_BUCKET ||
    `${key.project_id}.firebasestorage.app`;

admin.initializeApp({
    credential: admin.credential.cert(key),
    storageBucket: bucket
});

fs.mkdirSync(uploadsDir, { recursive: true });

const [files] = await admin.storage().bucket().getFiles();
console.log(`${files.length} archivos en el bucket ${bucket}`);

let ok = 0;
let fail = 0;
for (const file of files) {
    const dest = path.join(uploadsDir, file.name);
    if (!path.resolve(dest).startsWith(path.resolve(uploadsDir))) {
        console.warn(`Ruta insegura, salteada: ${file.name}`);
        fail++;
        continue;
    }
    try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await file.download({ destination: dest });
        ok++;
        if (ok % 50 === 0) console.log(`${ok}/${files.length}...`);
    } catch (e) {
        console.error(`Error descargando ${file.name}: ${e.message}`);
        fail++;
    }
}

console.log(`\nListo: ${ok} descargados, ${fail} errores`);
console.log(`Destino: ${uploadsDir}`);
process.exit(0);
