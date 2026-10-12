// ============================================================
// GESBASE - CAPA COMPARTIDA DEL SHIM LOCAL
// Transporte HTTP/WS + serialización wire + sesión
// ============================================================

const TOKEN_KEY = "gesbase_auth_token";
const USER_KEY = "gesbase_auth_user";

export function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
}
export function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
        return null;
    }
}
export function setStoredUser(u) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
}

export class LocalFirebaseError extends Error {
    constructor(code, message) {
        super(message || code);
        this.code = code;
    }
}

// POST JSON a la API local; devuelve el body parseado
export async function api(path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(path, {
        method: "POST",
        headers,
        body: JSON.stringify(body === undefined ? {} : body)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const code =
            data?.error?.code || data?.error || `http/${resp.status}`;
        const message =
            data?.error?.message || data?.message ||
            `Error ${resp.status}`;
        throw new LocalFirebaseError(code, message);
    }
    return data;
}

export async function apiGet(path) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(path, { headers });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new LocalFirebaseError(
            data?.error || `http/${resp.status}`,
            data?.message || `Error ${resp.status}`
        );
    }
    return data;
}

// ============================================================
// SERIALIZACIÓN WIRE
// Timestamp -> {__fs:'ts',ms}; sentinels pasan como están
// ============================================================

export function encodeWire(value) {
    if (value == null) return value;
    if (value instanceof Date) {
        return { __fs: "ts", ms: value.getTime() };
    }
    if (value.__fsTs !== undefined) {
        // instancia Timestamp del shim
        return { __fs: "ts", ms: value.__fsTs };
    }
    if (typeof value.__fs === "string") {
        // centinela (serverTimestamp, arrayUnion, etc.) - codificar
        // valores internos por si contienen Timestamps/Date
        const out = { __fs: value.__fs };
        if ("v" in value) out.v = encodeWire(value.v);
        if ("ms" in value) out.ms = value.ms;
        return out;
    }
    if (value.__type === "docref") {
        return { __fs: "ref", v: value.path };
    }
    if (Array.isArray(value)) {
        return value.map(encodeWire);
    }
    if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (v === undefined) continue;
            out[k] = encodeWire(v);
        }
        return out;
    }
    return value;
}

// ============================================================
// WEBSOCKET COMPARTIDO (un socket por pestaña)
// ============================================================

let ws = null;
let wsReady = null;
const pendingSubs = new Map(); // id -> spec
const listeners = new Map();   // id -> callback

function wsUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const token = getToken();
    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${proto}//${location.host}/ws${q}`;
}

function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

function connect() {
    if (wsReady) return wsReady;
    wsReady = new Promise(resolve => {
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
            for (const [id, spec] of pendingSubs) {
                send({ t: "sub", id, spec });
            }
            resolve();
        };
        ws.onmessage = e => {
            let msg;
            try {
                msg = JSON.parse(e.data);
            } catch {
                return;
            }
            const cb = listeners.get(msg.id);
            if (cb) cb(msg);
        };
        ws.onclose = () => {
            ws = null;
            wsReady = null;
            if (pendingSubs.size) {
                setTimeout(connect, 1500);
            }
        };
        ws.onerror = () => {};
    });
    return wsReady;
}

let subCounter = 0;

export async function subscribe(spec, onMessage) {
    const id = `s${++subCounter}_${Date.now()}`;
    pendingSubs.set(id, spec);
    listeners.set(id, onMessage);
    await connect();
    send({ t: "sub", id, spec });
    return id;
}

export function unsubscribe(id) {
    pendingSubs.delete(id);
    listeners.delete(id);
    send({ t: "unsub", id });
}
