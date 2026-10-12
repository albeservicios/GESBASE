// ============================================================
// GESBASE SERVER - ALMACENAMIENTO LOCAL (reemplaza Firebase Storage)
// ============================================================

import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export const storageRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

function safePath(p) {
    const clean = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const resolved = path.resolve(config.uploadsDir, clean);
    if (!resolved.startsWith(config.uploadsDir + path.sep)) {
        throw new Error("storage/invalid-path");
    }
    return resolved;
}

// POST /api/storage/upload?path=dir/archivo.jpg  (multipart, campo "file")
storageRouter.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const rel = String(req.query.path || "");
        const dest = safePath(rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, req.file.buffer);
        res.json({
            path: rel,
            downloadURL: `/uploads/${rel.split("/").map(encodeURIComponent).join("/")}`
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/storage/delete {path}
storageRouter.post("/delete", async (req, res) => {
    try {
        const dest = safePath(req.body.path);
        fs.rmSync(dest, { force: true });
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
