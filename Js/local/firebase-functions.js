// ============================================================
// GESBASE - SHIM firebase-functions.js
// httpsCallable -> POST /api/functions/:name
// ============================================================

import { api } from "./shared.js";

let functionsSingleton = null;

export function getFunctions(_app, _region) {
    if (!functionsSingleton) {
        functionsSingleton = { __type: "functions", app: _app || null };
    }
    return functionsSingleton;
}

export function httpsCallable(_functions, name) {
    return async data => {
        const resp = await api(`/api/functions/${name}`, { data });
        return { data: resp.result };
    };
}

export function connectFunctionsEmulator() {}
