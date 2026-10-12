// ============================================================
// GESBASE - SHIM firebase-app.js
// ============================================================

let defaultApp = null;

export function initializeApp(options, name = "[DEFAULT]") {
    if (!defaultApp) {
        defaultApp = {
            name,
            options: options || {},
            automaticDataCollectionEnabled: false
        };
    }
    return defaultApp;
}

export function getApp(name) {
    if (!defaultApp) {
        throw new Error("Firebase App no inicializada");
    }
    return defaultApp;
}

export function getApps() {
    return defaultApp ? [defaultApp] : [];
}

export async function deleteApp() {
    defaultApp = null;
}

export function registerVersion() {}
export function setLogLevel() {}
