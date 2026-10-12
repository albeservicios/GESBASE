// ============================================================
// GESBASE SERVER - CONEXIÓN MONGODB
// ============================================================

import { MongoClient } from "mongodb";
import { config } from "./config.js";

const client = new MongoClient(config.mongoUri);

export let mongo;

export async function connectDb() {
    await client.connect();
    mongo = client.db(config.mongoDb);
    await mongo.collection("_documents").createIndex({ _parent: 1 });
    await mongo.collection("_auth_users").createIndex(
        { email: 1 },
        { unique: true }
    );
    await mongo.collection("_auth_tokens").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
    );
    console.log(`MongoDB conectado: ${config.mongoDb}`);
}

export function docs() {
    return mongo.collection("_documents");
}
