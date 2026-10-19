// ============================================================
// GESBASE SERVER - CONFIGURACIÓN
// ============================================================

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(SERVER_DIR, ".env") });

// JWT secret: del .env o generado y persistido en .jwt-secret
function loadJwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    const secretFile = path.join(SERVER_DIR, ".jwt-secret");
    try {
        return fs.readFileSync(secretFile, "utf8").trim();
    } catch {
        const secret = crypto.randomBytes(48).toString("hex");
        fs.writeFileSync(secretFile, secret, { mode: 0o600 });
        return secret;
    }
}

export const config = {
    port: Number(process.env.PORT || 3000),
    mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
    mongoDb: process.env.MONGODB_DB || "gesbase",
    jwtSecret: loadJwtSecret(),
    jwtTtl: process.env.JWT_TTL || "30d",
    serverDir: SERVER_DIR,
    rootDir: path.resolve(SERVER_DIR, ".."),
    uploadsDir: path.join(SERVER_DIR, "uploads"),
    // Integraciones externas (opcionales)
    resendApiKey: process.env.RESEND_API_KEY || "",
    resendFromEmail: process.env.RESEND_FROM_EMAIL || "",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    // URL pública del sitio (para links en emails)
    publicUrl: process.env.PUBLIC_URL || "http://localhost:3000",
    // Email del admin (recibe contactos y tickets de soporte)
    adminEmail: process.env.ADMIN_EMAIL || "gesbase0@gmail.com"
};
