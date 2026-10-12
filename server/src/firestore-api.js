// ============================================================
// GESBASE SERVER - API COMPATIBLE CON FIRESTORE
// Traduce operaciones del SDK a MongoDB
// ============================================================

import { Router } from "express";
import { docs } from "./db.js";
import {
    decodeWire,
    docToWire,
    parentPathOf,
    docIdOf,
    autoId,
    isPlainObject
} from "./serialize.js";
import { emitWrite } from "./events.js";

export const fsRouter = Router();

// ============================================================
// RESOLUCIÓN DE CENTINELAS ({__fs:...})
// ============================================================

const DELETE = Symbol("delete");

function resolveSentinel(value, existing) {
    if (Array.isArray(value)) {
        return value.map(v => resolveSentinel(v, undefined));
    }
    if (isPlainObject(value)) {
        const op = value.__fs;
        if (op === "svr") return new Date();
        if (op === "ts") return new Date(value.ms);
        if (op === "ref") return { $ref: value.v };
        if (op === "del") return DELETE;
        if (op === "inc") return Number(existing || 0) + Number(value.v || 0);
        if (op === "au") {
            const base = Array.isArray(existing) ? existing : [];
            const merged = [...base];
            for (const el of value.v || []) {
                const dec = resolveSentinel(el, undefined);
                if (!merged.some(e => JSON.stringify(e) === JSON.stringify(dec))) {
                    merged.push(dec);
                }
            }
            return merged;
        }
        if (op === "ar") {
            const base = Array.isArray(existing) ? existing : [];
            const remove = (value.v || []).map(e =>
                JSON.stringify(resolveSentinel(e, undefined))
            );
            return base.filter(
                e => !remove.includes(JSON.stringify(e))
            );
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const resolved = resolveSentinel(v, existing?.[k]);
            if (resolved !== DELETE && resolved !== undefined) {
                out[k] = resolved;
            }
        }
        return out;
    }
    return value;
}

function getNested(obj, dotPath) {
    return dotPath.split(".").reduce((o, k) => o?.[k], obj);
}

function mergeDeep(target, src) {
    const out = { ...(target || {}) };
    for (const [k, v] of Object.entries(src)) {
        const resolved = resolveSentinel(v, out[k]);
        if (resolved === DELETE) {
            delete out[k];
        } else if (
            isPlainObject(resolved) &&
            isPlainObject(out[k]) &&
            isPlainObject(v) &&
            !v.__fs
        ) {
            out[k] = mergeDeep(out[k], v);
        } else {
            out[k] = resolved;
        }
    }
    return out;
}

function stripMeta(doc) {
    const { _id, _parent, _v, ...data } = doc;
    return data;
}

// ============================================================
// MUTACIONES
// ============================================================

async function applySet(path, rawData, merge) {
    const existing = await docs().findOne({ _id: path });
    const data = decodeWire(rawData) || {};
    let newData;

    if (merge && existing) {
        newData = mergeDeep(stripMeta(existing), data);
    } else {
        newData = resolveSentinel(data, stripMeta(existing || {}));
    }

    const op = existing ? "update" : "create";
    await docs().replaceOne(
        { _id: path },
        {
            ...newData,
            _id: path,
            _parent: parentPathOf(path),
            _v: (existing?._v || 0) + 1
        },
        { upsert: true }
    );
    return op;
}

async function applyUpdate(path, rawData) {
    const existing = await docs().findOne({ _id: path });
    if (!existing) {
        const err = new Error(`No existe el documento: ${path}`);
        err.code = "not-found";
        throw err;
    }
    const data = decodeWire(rawData) || {};
    const $set = {};
    const $unset = {};

    for (const [key, rawVal] of Object.entries(data)) {
        const existingVal = getNested(stripMeta(existing), key);
        const resolved = resolveSentinel(rawVal, existingVal);
        if (resolved === DELETE) {
            $unset[key] = "";
        } else {
            $set[key] = resolved;
        }
    }

    await docs().updateOne(
        { _id: path },
        {
            ...(Object.keys($set).length ? { $set } : {}),
            ...(Object.keys($unset).length ? { $unset } : {}),
            $inc: { _v: 1 }
        }
    );
    return "update";
}

async function applyDelete(path) {
    const result = await docs().deleteOne({ _id: path });
    return result.deletedCount ? "delete" : "update";
}

async function runOp(op) {
    switch (op.type) {
        case "set":
            return {
                path: op.path,
                op: await applySet(op.path, op.data, op.merge)
            };
        case "add": {
            const id = op.id || autoId();
            const path = `${op.parent}/${id}`;
            await applySet(path, op.data, false);
            return { path, op: "create", id };
        }
        case "update":
            return {
                path: op.path,
                op: await applyUpdate(op.path, op.data)
            };
        case "delete":
            return { path: op.path, op: await applyDelete(op.path) };
        default:
            throw new Error(`Operación desconocida: ${op.type}`);
    }
}

async function runOps(ops) {
    const results = [];
    for (const op of ops) {
        results.push(await runOp(op));
    }
    for (const r of results) {
        emitWrite({
            path: r.path,
            parent: parentPathOf(r.path),
            op: r.op
        });
    }
    return results;
}

// ============================================================
// CONSULTAS
// ============================================================

const OP_MAP = {
    "<": "$lt",
    "<=": "$lte",
    ">": "$gt",
    ">=": "$gte"
};

function buildMongoFilter(filters, orderBys) {
    const mongo = {};
    for (const f of filters || []) {
        const field = f.field;
        const value = resolveSentinel(decodeWire(f.value), undefined);
        switch (f.op) {
            case "==":
            case "array-contains":
                mongo[field] = { ...(mongo[field] || {}), $eq: value };
                break;
            case "!=":
                mongo[field] = {
                    ...(mongo[field] || {}),
                    $ne: value,
                    $exists: true
                };
                break;
            case "in":
            case "array-contains-any":
                mongo[field] = {
                    ...(mongo[field] || {}),
                    $in: Array.isArray(value) ? value : [value]
                };
                break;
            case "not-in":
                mongo[field] = {
                    ...(mongo[field] || {}),
                    $nin: Array.isArray(value) ? value : [value],
                    $exists: true
                };
                break;
            default:
                if (OP_MAP[f.op]) {
                    mongo[field] = {
                        ...(mongo[field] || {}),
                        [OP_MAP[f.op]]: value
                    };
                }
        }
    }
    for (const o of orderBys || []) {
        const existing = mongo[o.field];
        if (!existing || !existing.$exists) {
            mongo[o.field] = { ...(existing || {}), $exists: true };
        }
    }
    return mongo;
}

export async function runQuery(spec) {
    const mongoFilter = buildMongoFilter(spec.filters, spec.orderBys);
    mongoFilter._parent = spec.parent;

    const sort = {};
    for (const o of spec.orderBys || []) {
        sort[o.field] = o.dir === "desc" ? -1 : 1;
    }

    let cursor = docs().find(mongoFilter);
    if (Object.keys(sort).length) cursor = cursor.sort(sort);
    if (spec.limit) cursor = cursor.limit(spec.limit);

    const results = await cursor.toArray();
    return results.map(docToWire);
}

// ============================================================
// ENDPOINTS
// ============================================================

// POST /api/fs/get {path}
fsRouter.post("/get", async (req, res) => {
    const doc = await docs().findOne({ _id: req.body.path });
    if (!doc) {
        return res.json({ exists: false, path: req.body.path, v: 0 });
    }
    res.json({ exists: true, ...docToWire(doc) });
});

// POST /api/fs/query {parent, filters, orderBys, limit}
fsRouter.post("/query", async (req, res) => {
    const result = await runQuery(req.body || {});
    res.json({ docs: result });
});

// POST /api/fs/write {op...}
fsRouter.post("/write", async (req, res) => {
    try {
        const [result] = await runOps([req.body]);
        res.json(result);
    } catch (e) {
        res.status(e.code === "not-found" ? 404 : 500).json({
            error: e.code || "write-failed",
            message: e.message
        });
    }
});

// POST /api/fs/batch {ops:[...]}
fsRouter.post("/batch", async (req, res) => {
    try {
        const results = await runOps(req.body.ops || []);
        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: "write-failed", message: e.message });
    }
});

// ============================================================
// TRANSACCIONES (concurrencia optimista con versión _v)
// ============================================================

let txLock = Promise.resolve();

function withLock(fn) {
    const run = txLock.then(fn, fn);
    txLock = run.catch(() => {});
    return run;
}

// POST /api/fs/txn {reads:[{path,v}], writes:[op...]}
fsRouter.post("/txn", async (req, res) => {
    const { reads = [], writes = [] } = req.body || {};
    const result = await withLock(async () => {
        for (const r of reads) {
            const doc = await docs().findOne({ _id: r.path });
            const current = doc?._v || 0;
            if (current !== r.v) return { conflict: true };
        }
        const results = [];
        for (const op of writes) {
            results.push(await runOp(op));
        }
        return { conflict: false, results };
    });

    if (result.conflict) {
        return res.status(409).json({ conflict: true });
    }
    for (const r of result.results) {
        emitWrite({
            path: r.path,
            parent: parentPathOf(r.path),
            op: r.op
        });
    }
    res.json({ results: result.results });
});

export { applySet, applyUpdate, applyDelete, runOp, runOps };
