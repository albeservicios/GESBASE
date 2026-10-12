// ============================================================
// GESBASE SERVER - AUTENTICACIÓN LOCAL (reemplaza Firebase Auth)
// ============================================================

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { mongo } from "./db.js";
import { config } from "./config.js";
import { autoId } from "./serialize.js";

export const authRouter = Router();

const users = () => mongo.collection("_auth_users");
const tokens = () => mongo.collection("_auth_tokens");

function signToken(uid) {
    return jwt.sign({ uid }, config.jwtSecret, {
        expiresIn: config.jwtTtl
    });
}

function publicUser(u) {
    return {
        uid: u._id,
        email: u.email,
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        emailVerified: !!u.emailVerified,
        createdAt: u.createdAt ? u.createdAt.toISOString() : null
    };
}

export async function createUser({ email, password, displayName }) {
    const hash = await bcrypt.hash(password, 10);
    const doc = {
        _id: autoId(28),
        email: email.toLowerCase(),
        passwordHash: hash,
        displayName: displayName || null,
        photoURL: null,
        emailVerified: false,
        createdAt: new Date()
    };
    await users().insertOne(doc);
    return doc;
}

export function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
        return res.status(401).json({ error: "auth/no-token" });
    }
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.uid = payload.uid;
        next();
    } catch {
        return res.status(401).json({ error: "auth/invalid-token" });
    }
}

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
    const { email, password, displayName } = req.body || {};
    if (!email || !password || password.length < 6) {
        return res.status(400).json({
            error: "auth/weak-password",
            message: "Email o contraseña inválidos (mínimo 6 caracteres)."
        });
    }
    const existing = await users().findOne({
        email: email.toLowerCase()
    });
    if (existing) {
        return res.status(409).json({ error: "auth/email-already-in-use" });
    }
    const user = await createUser({ email, password, displayName });
    res.json({ user: publicUser(user), token: signToken(user._id) });
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    const user = await users().findOne({
        email: String(email || "").toLowerCase()
    });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
        return res.status(401).json({ error: "auth/invalid-credential" });
    }
    res.json({ user: publicUser(user), token: signToken(user._id) });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, async (req, res) => {
    const user = await users().findOne({ _id: req.uid });
    if (!user) return res.status(404).json({ error: "auth/user-not-found" });
    res.json({ user: publicUser(user) });
});

// POST /api/auth/logout (el cliente descarta el token)
authRouter.post("/logout", (_req, res) => res.json({ ok: true }));

// POST /api/auth/send-password-reset
authRouter.post("/send-password-reset", async (req, res) => {
    const { email } = req.body || {};
    const user = await users().findOne({
        email: String(email || "").toLowerCase()
    });
    // No revelar si el email existe o no
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString("hex");
    await tokens().insertOne({
        _id: crypto.createHash("sha256").update(token).digest("hex"),
        uid: user._id,
        type: "password-reset",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    const link = `${config.publicUrl}/cambiar-password.html?token=${token}`;
    console.log(`\n=== RESET DE CONTRASEÑA ===\n${user.email}\n${link}\n`);

    if (config.resendApiKey) {
        try {
            const { Resend } = await import("resend");
            const resend = new Resend(config.resendApiKey);
            await resend.emails.send({
                from: config.resendFromEmail,
                to: [user.email],
                subject: "Restablecer contraseña - GESBASE",
                html: `<p>Hacé clic para restablecer tu contraseña:</p><p><a href="${link}">${link}</a></p><p>Vence en 1 hora.</p>`
            });
        } catch (e) {
            console.error("Error enviando email de reset:", e.message);
        }
    }
    res.json({ ok: true });
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password || password.length < 6) {
        return res.status(400).json({ error: "auth/weak-password" });
    }
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await tokens().findOne({
        _id: hash,
        type: "password-reset"
    });
    if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({ error: "auth/invalid-token" });
    }
    await users().updateOne(
        { _id: record.uid },
        { $set: { passwordHash: await bcrypt.hash(password, 10) } }
    );
    await tokens().deleteOne({ _id: hash });
    res.json({ ok: true });
});

// POST /api/auth/update-profile
authRouter.post("/update-profile", requireAuth, async (req, res) => {
    const { displayName, photoURL } = req.body || {};
    const set = {};
    if (displayName !== undefined) set.displayName = displayName;
    if (photoURL !== undefined) set.photoURL = photoURL;
    await users().updateOne({ _id: req.uid }, { $set: set });
    const user = await users().findOne({ _id: req.uid });
    res.json({ user: publicUser(user) });
});

// POST /api/auth/update-password
authRouter.post("/update-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "auth/weak-password" });
    }
    const user = await users().findOne({ _id: req.uid });
    if (!user) return res.status(404).json({ error: "auth/user-not-found" });
    // Si se envía currentPassword, verificarla (reautenticación simple)
    if (currentPassword !== undefined) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
            return res
                .status(401)
                .json({ error: "auth/wrong-password" });
        }
    }
    await users().updateOne(
        { _id: req.uid },
        { $set: { passwordHash: await bcrypt.hash(newPassword, 10) } }
    );
    res.json({ ok: true });
});

export { publicUser };
