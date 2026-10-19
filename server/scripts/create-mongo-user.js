// Uso: node scripts/create-mongo-user.js <password>
// Crea el usuario "gesbase" con rol readWrite sobre la DB gesbase.
// Correr con mongod SIN --auth activo (primera vez). Idempotente.

import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, "..", ".env");
const env = {};
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2];
    }
}

const password = process.argv[2];
if (!password || password.length < 8) {
    console.error("Uso: node scripts/create-mongo-user.js <password> (mín 8 chars)");
    process.exit(1);
}

const dbName = env.MONGODB_DB || "gesbase";
const client = new MongoClient("mongodb://127.0.0.1:27017");
await client.connect();
const db = client.db(dbName);

try {
    await db.command({
        createUser: "gesbase",
        pwd: password,
        roles: [{ role: "readWrite", db: dbName }]
    });
    console.log(`Usuario "gesbase" creado en db "${dbName}"`);
} catch (e) {
    if (e.codeName === "DuplicateKey" || /already exists/i.test(e.message)) {
        await db.command({ updateUser: "gesbase", pwd: password });
        console.log(`Usuario "gesbase" ya existía - contraseña actualizada`);
    } else {
        throw e;
    }
}
await client.close();
