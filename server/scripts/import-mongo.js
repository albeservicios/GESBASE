// ============================================================
// IMPORTAR JSON EXPORTADO -> MONGODB LOCAL
//   npm run import:mongo
// Lee server/data/export/*.json y carga _documents + _auth_users
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(dir, "..");
const exportDir = path.join(serverDir, "data", "export");
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB = process.env.MONGODB_DB || "gesbase";

if (!fs.existsSync(exportDir)) {
    console.error(
        "No existe server/data/export - corré primero export:firestore"
    );
    process.exit(1);
}

// Reescribe URLs de Firebase Storage a rutas locales /uploads/
// https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path%2Fenc>?...
// https://<bucket>.firebasestorage.app/<path>  ->  /uploads/<path>
function rewriteStorageUrl(url) {
    try {
        const m = url.match(
            /firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/
        );
        if (m) {
            return "/uploads/" + decodeURIComponent(m[1]);
        }
        const m2 = url.match(
            /https?:\/\/[^/]*\.firebasestorage\.app\/(.+)/
        );
        if (m2) {
            return "/uploads/" + m2[1].split("?")[0];
        }
    } catch {}
    return url;
}

function revive(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(revive);
    if (typeof value === "string") {
        return value.includes("firebasestorage")
            ? rewriteStorageUrl(value)
            : value;
    }
    if (typeof value === "object") {
        if (value.__fs === "ts") return new Date(value.ms);
        if (value.__fs === "ref") return { $ref: value.v };
        if (value.__fs === "geo") {
            return { lat: value.lat, lng: value.lng };
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = revive(v);
        }
        return out;
    }
    return value;
}

const client = new MongoClient(MONGO_URI);
await client.connect();
const mongo = client.db(DB);
const docs = mongo.collection("_documents");
await docs.createIndex({ _parent: 1 });

let total = 0;
const files = fs
    .readdirSync(exportDir)
    .filter(f => f.endsWith(".json") && f !== "_auth_users.json");

for (const file of files) {
    const colPath = file.replace(/__/g, "/").replace(/\.json$/, "");
    const entries = JSON.parse(
        fs.readFileSync(path.join(exportDir, file), "utf8")
    );
    const ops = entries.map(e => ({
        replaceOne: {
            filter: { _id: `${colPath}/${e.id}` },
            replacement: {
                ...revive(e.data),
                _id: `${colPath}/${e.id}`,
                _parent: colPath,
                _v: 1
            },
            upsert: true
        }
    }));
    if (ops.length) await docs.bulkWrite(ops, { ordered: false });
    total += ops.length;
    console.log(`${colPath}: ${ops.length} docs importados`);
}

// Usuarios de Auth (opcional)
const authFile = path.join(exportDir, "_auth_users.json");
if (fs.existsSync(authFile)) {
    const authUsers = JSON.parse(fs.readFileSync(authFile, "utf8"));
    const usersCol = mongo.collection("_auth_users");
    let imported = 0;
    for (const u of authUsers) {
        if (!u.email) continue;
        // Contraseña temporal aleatoria: el usuario debe usar
        // "olvidé mi contraseña" o el admin la resetea.
        const tempPassword = crypto.randomBytes(9).toString("base64url");
        await usersCol.updateOne(
            { email: u.email.toLowerCase() },
            {
                $setOnInsert: {
                    _id: u.uid,
                    email: u.email.toLowerCase(),
                    passwordHash: await bcrypt.hash(tempPassword, 10),
                    displayName: u.displayName || null,
                    photoURL: u.photoURL || null,
                    emailVerified: !!u.emailVerified,
                    createdAt: u.createdAt
                        ? new Date(u.createdAt)
                        : new Date(),
                    needsPasswordReset: true
                }
            },
            { upsert: true }
        );
        imported++;
    }
    console.log(
        `${imported} usuarios de auth importados ` +
        `(con contraseña temporal - deben restablecerla)`
    );
}

console.log(`\nImport completo: ${total} documentos`);
await client.close();
