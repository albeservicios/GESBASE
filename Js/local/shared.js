
// ============================================================
// GESBASE - CAPA COMPARTIDA DEL SHIM LOCAL
// Transporte HTTP/WS + serialización wire + sesión
// ============================================================

const TOKEN_KEY = "gesbase_auth_token";
const USER_KEY = "gesbase_auth_user";

// ============================================================
// SERVIDOR GESBASE
// ============================================================

const API_BASE = "https://gesbase.online";

function apiUrl(path) {
    const cleanPath = String(path || "");

    if (/^https?:\/\//i.test(cleanPath)) {
        return cleanPath;
    }

    return new URL(
        cleanPath.replace(/^\/+/, ""),
        API_BASE + "/"
    ).toString();
}

// ============================================================
// SESIÓN
// ============================================================

export function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(t) {
    if (t) {
        localStorage.setItem(TOKEN_KEY, t);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function getStoredUser() {
    try {
        return JSON.parse(
            localStorage.getItem(USER_KEY) || "null"
        );
    } catch {
        return null;
    }
}

export function setStoredUser(u) {
    if (u) {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
    } else {
        localStorage.removeItem(USER_KEY);
    }
}

// ============================================================
// ERRORES
// ============================================================

export class LocalFirebaseError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = "LocalFirebaseError";
        this.code = code;
    }
}

// ============================================================
// PROCESAR RESPUESTA DEL SERVIDOR
// ============================================================

async function procesarRespuesta(resp) {
    const texto = await resp.text();

    let data = {};

    if (texto) {
        try {
            data = JSON.parse(texto);
        } catch {
            data = {
                message: texto
            };
        }
    }

    if (!resp.ok) {
        const errorData = data?.error;

        const code =
            typeof errorData === "object"
                ? errorData?.code || `http/${resp.status}`
                : errorData || `http/${resp.status}`;

        const message =
            typeof errorData === "object"
                ? errorData?.message || data?.message
                : data?.message || errorData;

        throw new LocalFirebaseError(
            code,
            message || `Error del servidor: ${resp.status}`
        );
    }

    return data;
}

// ============================================================
// ERRORES DE CONEXIÓN
// ============================================================

function convertirErrorConexion(error) {
    if (error instanceof LocalFirebaseError) {
        return error;
    }

    console.error(
        "GESBASE - Error de conexión:",
        error
    );

    return new LocalFirebaseError(
        "network/request-failed",
        "No se pudo conectar con el servidor GESBASE. Verificá tu conexión a Internet e intentá nuevamente."
    );
}

// ============================================================
// POST JSON A LA API
// ============================================================

export async function api(path, body) {
    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const resp = await fetch(apiUrl(path), {
            method: "POST",
            headers,
            body: JSON.stringify(
                body === undefined ? {} : body
            )
        });

        return await procesarRespuesta(resp);

    } catch (error) {
        throw convertirErrorConexion(error);
    }
}

// ============================================================
// GET A LA API
// ============================================================

export async function apiGet(path) {
    const headers = {
        "Accept": "application/json"
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const resp = await fetch(apiUrl(path), {
            method: "GET",
            headers
        });

        return await procesarRespuesta(resp);

    } catch (error) {
        throw convertirErrorConexion(error);
    }
}

// ============================================================
// SERIALIZACIÓN WIRE
// Timestamp -> {__fs:'ts',ms}; sentinels pasan como están
// ============================================================

export function encodeWire(value) {
    if (value == null) return value;

    if (value instanceof Date) {
        return {
            __fs: "ts",
            ms: value.getTime()
        };
    }

    if (value.__fsTs !== undefined) {
        return {
            __fs: "ts",
            ms: value.__fsTs
        };
    }

    if (typeof value.__fs === "string") {
        const out = {
            __fs: value.__fs
        };

        if ("v" in value) {
            out.v = encodeWire(value.v);
        }

        if ("ms" in value) {
            out.ms = value.ms;
        }

        return out;
    }

    if (value.__type === "docref") {
        return {
            __fs: "ref",
            v: value.path
        };
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
// WEBSOCKET COMPARTIDO
// Un socket por pestaña
// ============================================================

let ws = null;
let wsReady = null;

const pendingSubs = new Map();
const listeners = new Map();

// ============================================================
// DIRECCIÓN WEBSOCKET
// ============================================================

function wsUrl() {
    const token = getToken();

    const q = token
        ? `?token=${encodeURIComponent(token)}`
        : "";

    return `wss://gesbase.online/ws${q}`;
}

// ============================================================
// ENVÍO DE MENSAJES
// ============================================================

function send(msg) {
    if (
        ws &&
        ws.readyState === WebSocket.OPEN
    ) {
        ws.send(JSON.stringify(msg));
    }
}

// ============================================================
// CONEXIÓN WEBSOCKET
// ============================================================

function connect() {
    if (wsReady) return wsReady;

    wsReady = new Promise((resolve, reject) => {
        try {
            ws = new WebSocket(wsUrl());

            ws.onopen = () => {
                for (const [id, spec] of pendingSubs) {
                    send({
                        t: "sub",
                        id,
                        spec
                    });
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

                if (cb) {
                    cb(msg);
                }
            };

            ws.onclose = () => {
                ws = null;
                wsReady = null;

                if (pendingSubs.size) {
                    setTimeout(() => {
                        connect().catch(error => {
                            console.error(
                                "GESBASE - Error reconectando WebSocket:",
                                error
                            );
                        });
                    }, 1500);
                }
            };

            ws.onerror = error => {
                console.error(
                    "GESBASE - Error WebSocket:",
                    error
                );
            };

        } catch (error) {
            ws = null;
            wsReady = null;
            reject(error);
        }
    });

    return wsReady;
}

// ============================================================
// SUSCRIPCIONES
// ============================================================

let subCounter = 0;

export async function subscribe(spec, onMessage) {
    const id = `s${++subCounter}_${Date.now()}`;

    pendingSubs.set(id, spec);
    listeners.set(id, onMessage);

    try {
        await connect();

        send({
            t: "sub",
            id,
            spec
        });

        return id;

    } catch (error) {
        pendingSubs.delete(id);
        listeners.delete(id);

        throw convertirErrorConexion(error);
    }
}

// ============================================================
// CANCELAR SUSCRIPCIÓN
// ============================================================

export function unsubscribe(id) {
    pendingSubs.delete(id);
    listeners.delete(id);

    send({
        t: "unsub",
        id
    });
}
