// ============================================================
// GESBASE - SHIM firebase-auth.js
// API compatible con Firebase Auth, backed por /api/auth + JWT
// ============================================================

import {
    api, apiGet, getToken, setToken,
    getStoredUser, setStoredUser, LocalFirebaseError
} from "./shared.js";

let authSingleton = null;

function buildUser(raw) {
    return {
        uid: raw.uid,
        email: raw.email,
        displayName: raw.displayName || null,
        photoURL: raw.photoURL || null,
        emailVerified: !!raw.emailVerified,
        isAnonymous: false,
        metadata: { creationTime: raw.createdAt || null },
        providerId: "password",
        async getIdToken(_forceRefresh) {
            return getToken();
        },
        async reload() {
            const resp = await apiGet("/api/auth/me");
            Object.assign(this, buildUser(resp.user));
            setStoredUser(resp.user);
        },
        toJSON() {
            return {
                uid: this.uid,
                email: this.email,
                displayName: this.displayName,
                photoURL: this.photoURL,
                emailVerified: this.emailVerified
            };
        }
    };
}

function makeAuth(app) {
    const listeners = new Set();
    const auth = {
        app: app || null,
        currentUser: null,
        _listeners: listeners,
        _notify() {
            for (const cb of listeners) {
                try {
                    cb(auth.currentUser);
                } catch (e) {
                    console.error(e);
                }
            }
        },
        _setUser(raw) {
            auth.currentUser = raw ? buildUser(raw) : null;
            setStoredUser(raw);
            auth._notify();
        }
    };

    // Restaurar sesión al cargar
    auth._ready = (async () => {
        if (!getToken()) {
            auth._notify();
            return;
        }
        try {
            const resp = await apiGet("/api/auth/me");
            auth.currentUser = buildUser(resp.user);
            setStoredUser(resp.user);
        } catch {
            setToken(null);
            setStoredUser(null);
            auth.currentUser = null;
        }
        auth._notify();
    })();

    return auth;
}

export function getAuth(app) {
    if (!authSingleton) authSingleton = makeAuth(app);
    return authSingleton;
}

export function onAuthStateChanged(auth, callbackOrObserver, onError) {
    const cb =
        typeof callbackOrObserver === "function"
            ? callbackOrObserver
            : callbackOrObserver?.next?.bind(callbackOrObserver);
    if (!cb) return () => {};
    auth._listeners.add(cb);
    // Firebase llama el callback de forma asíncrona con el estado actual
    auth._ready.then(() => cb(auth.currentUser));
    return () => auth._listeners.delete(cb);
}

export async function signInWithEmailAndPassword(auth, email, password) {
    const resp = await api("/api/auth/login", { email, password });
    setToken(resp.token);
    auth._setUser(resp.user);
    return { user: auth.currentUser };
}

export async function createUserWithEmailAndPassword(
    auth, email, password
) {
    const resp = await api("/api/auth/register", { email, password });
    setToken(resp.token);
    auth._setUser(resp.user);
    return { user: auth.currentUser };
}

export async function signOut(auth) {
    try {
        await api("/api/auth/logout");
    } catch {}
    setToken(null);
    auth._setUser(null);
}

export async function sendPasswordResetEmail(auth, email) {
    await api("/api/auth/send-password-reset", { email });
}

export async function updateProfile(user, profile) {
    const resp = await api("/api/auth/update-profile", {
        displayName: profile?.displayName,
        photoURL: profile?.photoURL
    });
    const auth = getAuth();
    auth._setUser(resp.user);
}

export async function updatePassword(user, newPassword) {
    await api("/api/auth/update-password", { newPassword });
}

export async function getIdToken(user, forceRefresh) {
    return getToken();
}

export async function setPersistence() {}
export async function sendEmailVerification() {}
export async function applyActionCode() {}
export function browserLocalPersistence() { return "local"; }

export { LocalFirebaseError as AuthError };
