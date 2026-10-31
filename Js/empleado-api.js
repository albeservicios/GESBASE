const API_URL = "https://gesbase.online/api";

export async function iniciarSesionEmpleado(email, password) {
    const respuesta = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.token) {
        throw new Error(datos.error || "No se pudo iniciar sesión.");
    }

    sessionStorage.setItem("gesbaseEmpleadoToken", datos.token);
    return datos;
}

export async function consultarPerfilEmpleado() {
    const token = sessionStorage.getItem("gesbaseEmpleadoToken");

    if (!token) throw new Error("Sesión no iniciada.");

    const respuesta = await fetch(`${API_URL}/empleado/perfil`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(datos.error || "No se pudo cargar el perfil.");
    }

    return datos;
}

export function cerrarSesionEmpleado() {
    sessionStorage.removeItem("gesbaseEmpleadoToken");
    sessionStorage.removeItem("gesbaseEmpleado");
}
