// ============================================================
// GESBASE - SHIM firebase-messaging.js
// Push local: stub seguro. La entrega real se configura en el
// servidor (pushOutbox / Web Push VAPID).
// ============================================================

let messagingSingleton = null;

export function getMessaging(_app) {
    if (!messagingSingleton) {
        messagingSingleton = { __type: "messaging", app: _app || null };
    }
    return messagingSingleton;
}

export async function isSupported() {
    return false;
}

export async function getToken() {
    let token = localStorage.getItem("gesbase_local_token");
    if (!token) {
        token = "local-" + crypto.randomUUID();
        localStorage.setItem("gesbase_local_token", token);
    }
    return token;
}

export async function deleteToken() {
    localStorage.removeItem("gesbase_local_token");
    return true;
}

export function onMessage(_messaging, _callback) {
    return () => {};
}
