// ============================================================
// GESBASE SERVER - ENTRADA PRINCIPAL
// Sirve estáticos + API compatible con Firebase + realtime WS
// ============================================================

import express from "express";
import http from "node:http";
import path from "node:path";
import cors from "cors";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { authRouter } from "./auth.js";
import { fsRouter } from "./firestore-api.js";
import { storageRouter } from "./storage.js";
import { functionsRouter } from "./functions.js";
import { initRealtime } from "./realtime.js";
import { initTriggers } from "./triggers.js";

await connectDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Bloquear rutas sensibles antes de servir estáticos
app.use((req, res, next) => {
    const p = req.path;
    if (
        p.startsWith("/.git") ||
        p.startsWith("/server/node_modules") ||
        p.startsWith("/server/data") ||
        p.startsWith("/server/.env") ||
        p.startsWith("/server/.jwt-secret") ||
        p.endsWith("/serviceAccountKey.json")
    ) {
        return res.status(404).end();
    }
    next();
});

// API
app.use("/api/auth", authRouter);
app.use("/api/fs", fsRouter);
app.use("/api/storage", storageRouter);
app.use("/api/functions", functionsRouter);

// Archivos subidos (reemplaza Firebase Storage URLs)
app.use("/uploads", express.static(config.uploadsDir));

// Estáticos del frontend (raíz del proyecto)
app.use(
    express.static(config.rootDir, {
        index: "index.html",
        extensions: ["html"]
    })
);

// Fallback SPA-lite: /pagina -> /pagina.html
app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws")) {
        return next();
    }
    res.sendFile(path.join(config.rootDir, "index.html"), err => {
        if (err) next();
    });
});

const server = http.createServer(app);
initRealtime(server);
initTriggers();

server.listen(config.port, () => {
    console.log(
        `\nGESBASE local listo: http://localhost:${config.port}\n`
    );
});
