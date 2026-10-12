// ============================================================
// GESBASE SERVER - SERIALIZACIÓN FIRESTORE <-> JSON
// Formato wire: valores especiales viajan como {__fs: ...}
// ============================================================

export function isPlainObject(v) {
    return v !== null && typeof v === "object" &&
        (v.constructor === Object || v.constructor === undefined);
}

// Cliente -> Servidor: revivir valores especiales
// {__fs:'ts',ms} -> Date | {__fs:'svr'} -> sentinel | {__fs:'au',v} | {__fs:'ar',v}
// {__fs:'inc',v} | {__fs:'del'} | {__fs:'ref',v}
export function decodeWire(value) {
    if (Array.isArray(value)) {
        return value.map(decodeWire);
    }
    if (isPlainObject(value)) {
        if (typeof value.__fs === "string") {
            return value; // centinela: se interpreta en mutations.js
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = decodeWire(v);
        }
        return out;
    }
    return value;
}

// Servidor -> Cliente: Date -> {__fs:'ts',ms}, ref almacenada -> {__fs:'ref',v}
export function encodeWire(value) {
    if (value instanceof Date) {
        return { __fs: "ts", ms: value.getTime() };
    }
    if (Array.isArray(value)) {
        return value.map(encodeWire);
    }
    if (isPlainObject(value)) {
        if (typeof value.$ref === "string" && Object.keys(value).length === 1) {
            return { __fs: "ref", v: value.$ref };
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = encodeWire(v);
        }
        return out;
    }
    return value;
}

// Documento Mongo -> snapshot wire para el cliente
export function docToWire(doc) {
    const segments = doc._id.split("/");
    const data = {};
    for (const [k, v] of Object.entries(doc)) {
        if (k === "_id" || k === "_parent" || k === "_v") continue;
        data[k] = encodeWire(v);
    }
    return {
        id: segments[segments.length - 1],
        path: doc._id,
        data,
        v: doc._v || 0
    };
}

export function parentPathOf(docPath) {
    const i = docPath.lastIndexOf("/");
    return i === -1 ? "" : docPath.slice(0, i);
}

export function docIdOf(docPath) {
    const i = docPath.lastIndexOf("/");
    return i === -1 ? docPath : docPath.slice(i + 1);
}

const ID_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function autoId(length = 20) {
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
    return id;
}
