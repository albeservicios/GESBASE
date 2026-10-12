// ============================================================
// GESBASE - SHIM firebase-firestore.js
// API compatible con el SDK de Firestore, backed por MongoDB
// local via /api/fs + WebSocket para onSnapshot
// ============================================================

import { api, encodeWire, subscribe, unsubscribe, LocalFirebaseError } from "./shared.js";

// ============================================================
// TIMESTAMP
// ============================================================

export class Timestamp {
    constructor(seconds, nanoseconds = 0) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
        this.__fsTs = seconds * 1000 + Math.floor(nanoseconds / 1e6);
    }
    static now() {
        return Timestamp.fromMillis(Date.now());
    }
    static fromDate(date) {
        return Timestamp.fromMillis(date.getTime());
    }
    static fromMillis(ms) {
        return new Timestamp(
            Math.floor(ms / 1000),
            (ms % 1000) * 1e6
        );
    }
    toDate() {
        return new Date(this.__fsTs);
    }
    toMillis() {
        return this.__fsTs;
    }
    toJSON() {
        return { seconds: this.seconds, nanoseconds: this.nanoseconds };
    }
    isEqual(other) {
        return other && this.__fsTs === other.__fsTs;
    }
    valueOf() {
        return this.__fsTs;
    }
}

// ============================================================
// DECODE WIRE -> objetos del shim
// ============================================================

function decodeWire(value) {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map(decodeWire);
    if (typeof value === "object") {
        if (value.__fs === "ts") {
            return Timestamp.fromMillis(value.ms);
        }
        if (value.__fs === "ref") {
            return makeDocRef(value.v);
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = decodeWire(v);
        }
        return out;
    }
    return value;
}

// ============================================================
// REFERENCIAS
// ============================================================

function joinPath(...segments) {
    return segments
        .flatMap(s => String(s).split("/"))
        .filter(s => s.length > 0)
        .join("/");
}

function makeDocRef(path) {
    const segments = path.split("/");
    const id = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const ref = {
        __type: "docref",
        path,
        id,
        parent: parentPath
            ? { __type: "colref", path: parentPath, id: segments[segments.length - 2] }
            : null,
        firestore: firestoreSingleton,
        converter: null,
        withConverter(conv) {
            const r = makeDocRef(path);
            r.converter = conv;
            return r;
        }
    };
    return ref;
}

function makeColRef(path) {
    const segments = path.split("/");
    return {
        __type: "colref",
        path,
        id: segments[segments.length - 1],
        parent: segments.length > 1
            ? makeDocRef(segments.slice(0, -1).join("/"))
            : null,
        firestore: firestoreSingleton,
        converter: null
    };
}

export function collection(target, ...segments) {
    if (target && target.__type === "colref" && !segments.length) {
        return target;
    }
    const base = target && target.path ? target.path : "";
    return makeColRef(joinPath(base, ...segments));
}

export function doc(target, ...segments) {
    if (!segments.length) {
        // doc(collectionRef) -> auto id; doc(docRef) -> mismo ref
        if (target.__type === "colref") {
            return makeDocRef(`${target.path}/${autoId()}`);
        }
        return target;
    }
    const base = target && target.path ? target.path : "";
    return makeDocRef(joinPath(base, ...segments));
}

const ID_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function autoId(length = 20) {
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
    return id;
}

// ============================================================
// SNAPSHOTS
// ============================================================

function makeDocSnapshot(wire) {
    const ref = makeDocRef(wire.path);
    const data = wire.exists === false ? undefined : decodeWire(wire.data || {});
    return {
        id: wire.id,
        ref,
        exists: () => wire.exists !== false,
        data: () => (ref.converter?.fromFirestore
            ? ref.converter.fromFirestore({ data: () => data })
            : data),
        get: field => field?.split(".").reduce((o, k) => o?.[k], data),
        metadata: { hasPendingWrites: false, fromCache: false }
    };
}

function makeQuerySnapshot(docsWire, prevDocs) {
    const docs = docsWire.map(makeDocSnapshot);
    const snap = {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        metadata: { hasPendingWrites: false, fromCache: false },
        forEach(cb) {
            docs.forEach(cb);
        },
        docChanges() {
            if (!prevDocs) {
                return docs.map((d, i) => ({
                    type: "added", doc: d, oldIndex: -1, newIndex: i
                }));
            }
            const changes = [];
            const prevById = new Map(prevDocs.map((d, i) => [d.id, [d, i]]));
            const currById = new Map(docs.map((d, i) => [d.id, [d, i]]));
            for (const [id, [d, newIndex]] of currById) {
                if (!prevById.has(id)) {
                    changes.push({ type: "added", doc: d, oldIndex: -1, newIndex });
                } else {
                    const [prevDoc, oldIndex] = prevById.get(id);
                    if (JSON.stringify(encodeWire(prevDoc.data())) !==
                        JSON.stringify(encodeWire(d.data()))) {
                        changes.push({
                            type: "modified", doc: d, oldIndex, newIndex
                        });
                    }
                }
            }
            for (const [id, [d, oldIndex]] of prevById) {
                if (!currById.has(id)) {
                    changes.push({ type: "removed", doc: d, oldIndex, newIndex: -1 });
                }
            }
            return changes.sort((a, b) => a.newIndex - b.newIndex);
        }
    };
    return snap;
}

// ============================================================
// CONSULTAS
// ============================================================

export function query(target, ...constraints) {
    const base =
        target.__type === "query"
            ? { ...target, filters: [...target.filters], orderBys: [...target.orderBys] }
            : {
                __type: "query",
                parent: target.path,
                filters: [],
                orderBys: [],
                limitN: null
            };
    for (const c of constraints) {
        if (!c) continue;
        if (c.__constraint === "where") base.filters.push(c.spec);
        else if (c.__constraint === "orderBy") base.orderBys.push(c.spec);
        else if (c.__constraint === "limit") base.limitN = c.n;
    }
    return base;
}

export function where(field, op, value) {
    return {
        __constraint: "where",
        spec: { field, op, value }
    };
}

export function orderBy(field, dir = "asc") {
    return {
        __constraint: "orderBy",
        spec: { field, dir: dir === "desc" ? "desc" : "asc" }
    };
}

export function limit(n) {
    return { __constraint: "limit", n };
}

function querySpec(q) {
    return {
        kind: "query",
        parent: q.path || q.parent,
        filters: (q.filters || []).map(f => ({
            field: f.field,
            op: f.op,
            value: encodeWire(f.value)
        })),
        orderBys: q.orderBys || [],
        limit: q.limitN || null
    };
}

// ============================================================
// LECTURAS
// ============================================================

export async function getDoc(ref) {
    const resp = await api("/api/fs/get", { path: ref.path });
    return makeDocSnapshot(resp);
}

export async function getDocs(target) {
    const q =
        target.__type === "colref"
            ? { parent: target.path, filters: [], orderBys: [], limitN: null }
            : target;
    const resp = await api("/api/fs/query", querySpec(q));
    return makeQuerySnapshot(resp.docs);
}

// ============================================================
// ESCRITURAS
// ============================================================

export async function setDoc(ref, data, options = {}) {
    await api("/api/fs/write", {
        type: "set",
        path: ref.path,
        data: encodeWire(data),
        merge: !!options.merge
    });
}

export async function addDoc(colRef, data) {
    const resp = await api("/api/fs/write", {
        type: "add",
        parent: colRef.path,
        data: encodeWire(data)
    });
    return makeDocRef(resp.path);
}

export async function updateDoc(ref, data) {
    await api("/api/fs/write", {
        type: "update",
        path: ref.path,
        data: encodeWire(data)
    });
}

export async function deleteDoc(ref) {
    await api("/api/fs/write", { type: "delete", path: ref.path });
}

export function writeBatch(_db) {
    const ops = [];
    return {
        set(ref, data, options = {}) {
            ops.push({
                type: "set",
                path: ref.path,
                data: encodeWire(data),
                merge: !!options.merge
            });
            return this;
        },
        update(ref, data) {
            ops.push({
                type: "update",
                path: ref.path,
                data: encodeWire(data)
            });
            return this;
        },
        delete(ref) {
            ops.push({ type: "delete", path: ref.path });
            return this;
        },
        async commit() {
            await api("/api/fs/batch", { ops });
        }
    };
}

// ============================================================
// TRANSACCIONES
// ============================================================

export async function runTransaction(_db, updateFunction) {
    const MAX_INTENTOS = 5;
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
        const reads = new Map();
        const writes = [];

        const transaction = {
            async get(ref) {
                const resp = await api("/api/fs/get", { path: ref.path });
                reads.set(ref.path, resp.v || 0);
                return makeDocSnapshot(resp);
            },
            set(ref, data, options = {}) {
                writes.push({
                    type: "set",
                    path: ref.path,
                    data: encodeWire(data),
                    merge: !!options.merge
                });
                return transaction;
            },
            update(ref, data) {
                writes.push({
                    type: "update",
                    path: ref.path,
                    data: encodeWire(data)
                });
                return transaction;
            },
            delete(ref) {
                writes.push({ type: "delete", path: ref.path });
                return transaction;
            }
        };

        const resultado = await updateFunction(transaction);

        try {
            await api("/api/fs/txn", {
                reads: [...reads].map(([path, v]) => ({ path, v })),
                writes
            });
            return resultado;
        } catch (e) {
            if (e.code === "http/409" || e.message?.includes("409")) {
                continue; // conflicto de versiones: reintentar
            }
            throw e;
        }
    }
    throw new LocalFirebaseError(
        "firestore/aborted",
        "La transacción falló por conflictos repetidos."
    );
}

// ============================================================
// ONSNAPSHOT (WebSocket)
// ============================================================

export function onSnapshot(target, ...args) {
    // Firmas: (ref, next), (ref, next, error),
    // (ref, options, next, error), (ref, {next, error})
    let options = {};
    let onNext = null;
    let onError = null;

    for (const arg of args) {
        if (typeof arg === "function" && !onNext) onNext = arg;
        else if (typeof arg === "function") onError = arg;
        else if (arg && typeof arg === "object") {
            if (arg.next || arg.error) {
                onNext = arg.next || onNext;
                onError = arg.error || onError;
            } else {
                options = arg;
            }
        }
    }

    const spec =
        target.__type === "docref"
            ? { kind: "doc", path: target.path }
            : querySpec(target);

    let prevDocs = null;
    let closed = false;
    let subId = null;

    subscribe(spec, msg => {
        if (closed) return;
        if (msg.t === "error") {
            if (onError) onError(new LocalFirebaseError("firestore/error", msg.error));
            return;
        }
        if (msg.t !== "snap") return;
        const snap =
            msg.snap.kind === "doc"
                ? makeDocSnapshot(msg.snap)
                : makeQuerySnapshot(msg.snap.docs, prevDocs);
        if (msg.snap.kind === "query") {
            prevDocs = snap.docs;
        }
        if (onNext) onNext(snap);
    }).then(id => {
        if (closed) unsubscribe(id);
        else subId = id;
    }).catch(e => {
        if (onError) onError(e);
    });

    return () => {
        closed = true;
        if (subId) unsubscribe(subId);
    };
}

// ============================================================
// CENTINELAS
// ============================================================

export function serverTimestamp() {
    return { __fs: "svr" };
}

export function arrayUnion(...elements) {
    return { __fs: "au", v: elements };
}

export function arrayRemove(...elements) {
    return { __fs: "ar", v: elements };
}

export function increment(n) {
    return { __fs: "inc", v: n };
}

export function deleteField() {
    return { __fs: "del" };
}

// ============================================================
// INSTANCIA FIRESTORE
// ============================================================

let firestoreSingleton = null;

export function getFirestore(_app) {
    if (!firestoreSingleton) {
        firestoreSingleton = { __type: "firestore", app: _app || null };
    }
    return firestoreSingleton;
}

export function connectFirestoreEmulator() {}
export function terminate() { return Promise.resolve(); }
export function clearIndexedDbPersistence() { return Promise.resolve(); }
