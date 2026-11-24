
// ============================================================
// GESBASE - SHIM FIREBASE AUTH
// Autenticación mediante API propia y JWT
// ============================================================

import {
    api,
    apiGet,
    getToken,
    setToken,
    getStoredUser,
    setStoredUser,
    LocalFirebaseError
} from "./shared.js";

let authSingleton = null;

// ============================================================
// VALIDAR RESPUESTA DEL SERVIDOR
// ============================================================

function validarUsuario(raw) {
    if (!raw || !raw.uid || !raw.email) {
        throw new LocalFirebaseError(
            "auth/invalid-server-response",
            "El servidor no devolvió los datos de usuario esperados."
        );
    }

    return raw;
}

// ============================================================
// CONSTRUIR USUARIO
// ============================================================

function buildUser(raw) {
    raw = validarUsuario(raw);

    return {
        uid: raw.uid,
        email: raw.email,
        displayName: raw.displayName || null,
        photoURL: raw.photoURL || null,
        emailVerified: !!raw.emailVerified,
        isAnonymous: false,

        metadata: {
            creationTime: raw.createdAt || null
        },

        providerId: "password",

        async getIdToken() {
            return getToken();
        },

        async reload() {
            const resp = await apiGet("/api/auth/me");

            if (!resp || !resp.user) {
                throw new LocalFirebaseError(
                    "auth/invalid-server-response",
                    "No se pudieron recuperar los datos del usuario."
                );
            }

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

// ============================================================
// CREAR AUTENTICACIÓN
// ============================================================

function makeAuth(app) {
    const listeners = new Set();

    const auth = {
        app: app || null,
        currentUser: null,
        _listeners: listeners,
        _ready: null,

        _notify() {
            for (const cb of listeners) {
                try {
                    cb(auth.currentUser);
                } catch (error) {
                    console.error(
                        "GESBASE Auth - Error en listener:",
                        error
                    );
                }
            }
        },

        _setUser(raw) {
            auth.currentUser = raw
                ? buildUser(raw)
                : null;

            setStoredUser(raw || null);
            auth._notify();
        }
    };

    // ========================================================
    // RESTAURAR SESIÓN
    // ========================================================

    auth._ready = (async () => {
        const token = getToken();

        if (!token) {
            auth.currentUser = null;
            auth._notify();
            return;
        }

        try {
            const resp = await apiGet("/api/auth/me");

            if (!resp || !resp.user) {
                throw new LocalFirebaseError(
                    "auth/invalid-server-response",
                    "Respuesta de sesión inválida."
                );
            }

            auth.currentUser = buildUser(resp.user);
            setStoredUser(resp.user);

        } catch (error) {
            console.error(
                "GESBASE Auth - Error restaurando sesión:",
                error
            );

            // No borrar el token ante un error de red.
            // Así evitamos cerrar sesiones por una caída temporal.
            if (
                error?.code === "http/401" ||
                error?.code === "http/403" ||
                error?.code === "auth/unauthorized"
            ) {
                setToken(null);
                setStoredUser(null);
            }

            auth.currentUser = null;

        } finally {
            auth._notify();
        }
    })();

    return auth;
}

// ============================================================
// OBTENER AUTH
// ============================================================

export function getAuth(app) {
    if (!authSingleton) {
        authSingleton = makeAuth(app);
    }

    return authSingleton;
}

// ============================================================
// OBSERVAR CAMBIOS DE SESIÓN
// ============================================================

export function onAuthStateChanged(
    auth,
    callbackOrObserver,
    onError
) {
    const cb =
        typeof callbackOrObserver === "function"
            ? callbackOrObserver
            : callbackOrObserver?.next?.bind(callbackOrObserver);

    if (!cb) {
        return () => {};
    }

    auth._listeners.add(cb);

    auth._ready.then(() => {
        try {
            cb(auth.currentUser);
        } catch (error) {
            if (onError) onError(error);
            else console.error(error);
        }
    });

    return () => {
        auth._listeners.delete(cb);
    };
}

// ============================================================
// INICIAR SESIÓN
// ============================================================

export async function signInWithEmailAndPassword(
    auth,
    email,
    password
) {
    if (!email || !password) {
        throw new LocalFirebaseError(
            "auth/invalid-credential",
            "Ingresá tu correo electrónico y contraseña."
        );
    }

    try {
        const resp = await api(
            "/api/auth/login",
            {
                email: String(email).trim().toLowerCase(),
                password: String(password)
            }
        );

        if (!resp || !resp.token || !resp.user) {
            throw new LocalFirebaseError(
                "auth/invalid-server-response",
                "El servidor no devolvió un token y usuario válidos."
            );
        }

        validarUsuario(resp.user);

        setToken(resp.token);
        auth._setUser(resp.user);

        return {
            user: auth.currentUser
        };

    } catch (error) {
        console.error(
            "GESBASE Auth - Error al iniciar sesión:",
            error
        );

        throw error;
    }
}

// ============================================================
// REGISTRAR USUARIO
// ============================================================

export async function createUserWithEmailAndPassword(
    auth,
    email,
    password
) {
    if (!email || !password) {
        throw new LocalFirebaseError(
            "auth/invalid-credential",
            "Completá el correo y la contraseña."
        );
    }

    const resp = await api(
        "/api/auth/register",
        {
            email: String(email).trim().toLowerCase(),
            password: String(password)
        }
    );

    if (!resp || !resp.token || !resp.user) {
        throw new LocalFirebaseError(
            "auth/invalid-server-response",
            "El servidor no devolvió los datos de registro esperados."
        );
    }

    validarUsuario(resp.user);

    setToken(resp.token);
    auth._setUser(resp.user);

    return {
        user: auth.currentUser
    };
}

// ============================================================
// CERRAR SESIÓN
// ============================================================

export async function signOut(auth) {
    try {
        await api("/api/auth/logout");
    } catch (error) {
        console.warn(
            "GESBASE Auth - No se pudo notificar el cierre al servidor:",
            error
        );
    }

    setToken(null);
    auth._setUser(null);
}

// ============================================================
// RECUPERAR CONTRASEÑA
// ============================================================

export async function sendPasswordResetEmail(auth, email) {
    if (!email) {
        throw new LocalFirebaseError(
            "auth/invalid-email",
            "Ingresá tu correo electrónico."
        );
    }

    return await api(
        "/api/auth/send-password-reset",
        {
            email: String(email).trim().toLowerCase()
        }
    );
}

// ============================================================
// ACTUALIZAR PERFIL
// ============================================================

export async function updateProfile(user, profile) {
    const resp = await api(
        "/api/auth/update-profile",
        {
            displayName: profile?.displayName,
            photoURL: profile?.photoURL
        }
    );

    if (!resp || !resp.user) {
        throw new LocalFirebaseError(
            "auth/invalid-server-response",
            "El servidor no devolvió el perfil actualizado."
        );
    }

    getAuth()._setUser(resp.user);
}

// ============================================================
// ACTUALIZAR CONTRASEÑA
// ============================================================

export async function updatePassword(user, newPassword) {
    if (!newPassword) {
        throw new LocalFirebaseError(
            "auth/weak-password",
            "Ingresá una nueva contraseña."
        );
    }

    await api(
        "/api/auth/update-password",
        {
            newPassword
        }
    );
}

// ============================================================
// TOKEN
// ============================================================

export async function getIdToken(user, forceRefresh) {
    const token = getToken();

    if (!token) {
        throw new LocalFirebaseError(
            "auth/no-current-user",
            "No hay una sesión activa."
        );
    }

    return token;
}

// ============================================================
// COMPATIBILIDAD FIREBASE
// ============================================================

export async function setPersistence() {}

export async function sendEmailVerification() {}

export async function applyActionCode() {}

export function browserLocalPersistence() {
    return "local";
}

export {
    LocalFirebaseError as AuthError
};
