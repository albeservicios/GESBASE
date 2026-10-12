// Uso: node scripts/set-password.js <email> <nueva-password>
// Cambia la contraseña de un usuario directamente en MongoDB.

import bcrypt from "bcryptjs";
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

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 6) {
    console.error("Uso: node scripts/set-password.js <email> <password> (mín 6 chars)");
    process.exit(1);
}

const uri = env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = env.MONGODB_DB || "gesbase";

const client = new MongoClient(uri);
await client.connect();
const col = client.db(dbName).collection("_auth_users");
const user = await col.findOne({ email: email.toLowerCase() });
if (!user) {
    console.error(`Usuario no encontrado: ${email}`);
    process.exit(1);
}
const hash = await bcrypt.hash(password, 10);
await col.updateOne(
    { _id: user._id },
    { $set: { passwordHash: hash, needsPasswordReset: false } }
);
console.log(`OK: contraseña actualizada para ${user.email} (uid ${user._id})`);
await client.close();
