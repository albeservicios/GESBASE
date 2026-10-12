// ============================================================
// Arranque de MongoDB local (binario gestionado por npm)
// Datos persistentes en server/data/db
// ============================================================

import { MongoMemoryServer } from "mongodb-memory-server";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(dir, "../data/db");
fs.mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
    instance: {
        port: 27017,
        dbPath,
        storageEngine: "wiredTiger"
    }
});

console.log(`MongoDB local corriendo en ${mongod.getUri()}`);
console.log(`Datos en ${dbPath}`);
console.log("Ctrl+C para detener.");

process.on("SIGINT", async () => {
    await mongod.stop({ doCleanup: false });
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await mongod.stop({ doCleanup: false });
    process.exit(0);
});
