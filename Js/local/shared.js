
// Dirección fija del servidor GESBASE
const API_BASE = "https://gesbase.online";

function apiUrl(path) {
    return new URL(path, API_BASE).toString();
}

// POST JSON a la API local; devuelve el body parseado
export async function api(path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();

    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(apiUrl(path), {
        method: "POST",
        headers,
        body: JSON.stringify(body === undefined ? {} : body)
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
        const code =
            data?.error?.code || data?.error || `http/${resp.status}`;

        const message =
            data?.error?.message || data?.message ||
            `Error ${resp.status}`;

        throw new LocalFirebaseError(code, message);
    }

    return data;
}

export async function apiGet(path) {
    const headers = {};
    const token = getToken();

    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(apiUrl(path), { headers });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
        throw new LocalFirebaseError(
            data?.error || `http/${resp.status}`,
            data?.message || `Error ${resp.status}`
        );
    }

    return data;
}
