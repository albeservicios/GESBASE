// ============================================================
// GESBASE SERVER - REALTIME (WebSocket)
// Suscripciones a documentos y consultas; potencia onSnapshot
// ============================================================

import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { docs } from "./db.js";
import { docToWire, parentPathOf } from "./serialize.js";
import { runQuery } from "./firestore-api.js";
import { writeEvents } from "./events.js";

const subscriptions = new Map(); // id -> {ws, spec}

async function snapshotFor(spec) {
    if (spec.kind === "doc") {
        const doc = await docs().findOne({ _id: spec.path });
        return {
            kind: "doc",
            exists: !!doc,
            ...(doc ? docToWire(doc) : { path: spec.path })
        };
    }
    const result = await runQuery(spec);
    return { kind: "query", docs: result };
}

async function deliver(subId) {
    const sub = subscriptions.get(subId);
    if (!sub || sub.ws.readyState !== 1) return;
    try {
        const snap = await snapshotFor(sub.spec);
        sub.ws.send(JSON.stringify({ t: "snap", id: subId, snap }));
    } catch (e) {
        sub.ws.send(JSON.stringify({
            t: "error",
            id: subId,
            error: e.message
        }));
    }
}

// Una escritura puede afectar: subs de doc exacto y subs de query
// cuyo parent coincide con el parent del documento escrito.
writeEvents.on("write", ({ path, parent }) => {
    for (const [id, sub] of subscriptions) {
        if (sub.ws.readyState !== 1) continue;
        if (sub.spec.kind === "doc" && sub.spec.path === path) {
            deliver(id);
        } else if (sub.spec.kind === "query" && sub.spec.parent === parent) {
            deliver(id);
        }
    }
});

export function initRealtime(server) {
    const wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", (ws, req) => {
        // Autenticación opcional por query param ?token=
        try {
            const url = new URL(req.url, "http://localhost");
            const token = url.searchParams.get("token");
            if (token) jwt.verify(token, config.jwtSecret);
        } catch {
            // continuar sin auth; las reglas de datos se endurecen aparte
        }

        const mySubs = new Set();

        ws.on("message", async raw => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                return;
            }

            if (msg.t === "sub" && msg.spec) {
                subscriptions.set(msg.id, { ws, spec: msg.spec });
                mySubs.add(msg.id);
                await deliver(msg.id);
            } else if (msg.t === "unsub") {
                subscriptions.delete(msg.id);
                mySubs.delete(msg.id);
            }
        });

        ws.on("close", () => {
            for (const id of mySubs) subscriptions.delete(id);
        });
    });

    console.log("Realtime WS listo en /ws");
}
