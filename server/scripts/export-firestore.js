// ============================================================
// EXPORTAR FIRESTORE -> JSON
// Uso:
//   1. Descargar serviceAccountKey.json desde Firebase Console
//      (Configuración del proyecto > Cuentas de servicio) y
//      guardarlo en server/serviceAccountKey.json
//   2. npm run export:firestore
// Genera server/data/export/<coleccion>.json (+ subcolecciones)
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
    console.error(
        "Falta server/serviceAccountKey.json\n" +
        "Descargalo desde Firebase Console > Configuración > " +
        "Cuentas de servicio > Generar nueva clave privada."
    );
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(keyPath)
});
const db = admin.firestore();

fs.mkdirSync(outDir, { recursive: true });

// Colecciones raíz: se intenta listar; si la cuenta no puede
// listar, completar ROOT_COLLECTIONS a mano.
const ROOT_COLLECTIONS = process.env.COLLECTIONS
    ? process.env.COLLECTIONS.split(",")
    : null;

function serialize(value) {
    if (value === null || value === undefined) return value;
    if (value instanceof admin.firestore.Timestamp) {
        return { __fs: "ts", ms: value.toMillis() };
    }
    if (value instanceof admin.firestore.GeoPoint) {
        return { __fs: "geo", lat: value.latitude, lng: value.longitude };
    }
    if (value instanceof admin.firestore.DocumentReference) {
        return { __fs: "ref", v: value.path };
    }
    if (Array.isArray(value)) return value.map(serialize);
    if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = serialize(v);
        }
        return out;
    }
    return value;
}

async function exportCollection(colRef, relPath) {
    const snap = await colRef.get();
    const docs = [];
    for (const d of snap.docs) {
        docs.push({ id: d.id, data: serialize(d.data()) });
        // subcolecciones
        const subs = await d.ref.listCollections();
        for (const sub of subs) {
            await exportCollection(
                sub,
                `${relPath}/${d.id}/${sub.id}`
            );
        }
    }
    const file = path.join(
        outDir,
        relPath.replace(/\//g, "__") + ".json"
    );
    fs.writeFileSync(file, JSON.stringify(docs, null, 1));
    console.log(`${relPath}: ${docs.length} docs -> ${path.basename(file)}`);
}

const roots =
    ROOT_COLLECTIONS || (await db.listCollections()).map(c => c.id);
console.log(`Exportando ${roots.length} colecciones raíz...`);
for (const name of roots) {
    await exportCollection(db.collection(name), name);
}
console.log(`\nExport completo en ${outDir}`);
process.exit(0);
