// ============================================================
// GESBASE - SHIM firebase-storage.js
// API compatible con Firebase Storage, backed por /api/storage
// ============================================================

import { getToken, LocalFirebaseError } from "./shared.js";

let storageSingleton = null;

export function getStorage(_app) {
    if (!storageSingleton) {
        storageSingleton = { __type: "storage", app: _app || null };
    }
    return storageSingleton;
}

export function ref(storageOrRef, path) {
    const base = storageOrRef?.fullPath || "";
    const clean = String(path || "").replace(/^\/+/, "");
    const fullPath = base ? `${base}/${clean}` : clean;
    return {
        __type: "storageref",
        bucket: "local",
        fullPath,
        name: fullPath.split("/").pop(),
        parent: base ? { fullPath: base } : null,
        root: { fullPath: "" },
        storage: storageSingleton,
        child(p) {
            return ref(this, p);
        }
    };
}

async function doUpload(r, data) {
    const form = new FormData();
    const blob =
        data instanceof Blob
            ? data
            : new Blob([data]);
    form.append("file", blob, r.name);
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(
        `/api/storage/upload?path=${encodeURIComponent(r.fullPath)}`,
        { method: "POST", headers, body: form }
    );
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new LocalFirebaseError(
            json.error || "storage/unknown",
            json.error || `Error ${resp.status}`
        );
    }
    return json;
}

export async function uploadBytes(r, data, metadata) {
    const result = await doUpload(r, data);
    return {
        ref: r,
        metadata: {
            ...(metadata || {}),
            fullPath: r.fullPath,
            size: data.size ?? data.byteLength ?? 0
        }
    };
}

export function uploadBytesResumable(r, data, metadata) {
    const task = {
        snapshot: {
            ref: r,
            bytesTransferred: 0,
            totalBytes: data.size ?? data.byteLength ?? 0,
            state: "running",
            metadata: metadata || {}
        },
        _handlers: [],
        _done: null,
        _error: null,
        on(event, nextOrObj, errorCb, completeCb) {
            const next =
                typeof nextOrObj === "function"
                    ? nextOrObj
                    : nextOrObj?.state_changed?.bind(nextOrObj) ||
                      nextOrObj?.next?.bind(nextOrObj);
            const err =
                errorCb || nextOrObj?.error?.bind?.(nextOrObj);
            const complete =
                completeCb || nextOrObj?.complete?.bind?.(nextOrObj);
            task._handlers.push({ next, err, complete });
            if (task._done && next) {
                next(task.snapshot);
                if (complete) complete();
            }
            if (task._error && err) err(task._error);
            return () => {};
        },
        then(resolve, reject) {
            return task._promise.then(resolve, reject);
        },
        catch(reject) {
            return task._promise.catch(reject);
        },
        pause() { return false; },
        resume() { return false; },
        cancel() { return true; }
    };

    task._promise = doUpload(r, data)
        .then(() => {
            task.snapshot.bytesTransferred = task.snapshot.totalBytes;
            task.snapshot.state = "success";
            task._done = true;
            for (const h of task._handlers) {
                h.next?.(task.snapshot);
                h.complete?.();
            }
            return task.snapshot;
        })
        .catch(e => {
            task._error = e;
            task.snapshot.state = "error";
            for (const h of task._handlers) h.err?.(e);
            throw e;
        });

    return task;
}

export async function getDownloadURL(r) {
    return `/uploads/${r.fullPath.split("/").map(encodeURIComponent).join("/")}`;
}

export async function deleteObject(r) {
    const { api } = await import("./shared.js");
    await api("/api/storage/delete", { path: r.fullPath });
}

export async function listAll() {
    return { items: [], prefixes: [] };
}
export async function getMetadata(r) {
    return { fullPath: r.fullPath, name: r.name };
}
