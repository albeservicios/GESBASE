// ============================================================
// GESBASE - GEMINI.JS
// Conexión entre asistente.html y Firebase Cloud Function
// ============================================================

import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "./firebase-config.js";

// Firebase Authentication
const auth = getAuth(app);

// URL de la Cloud Function de GESBASE
const GEMINI_FUNCTION_URL =
    "https://us-central1-gesbase-4bf94.cloudfunctions.net/geminiChat";

/**
 * Envía una consulta a Gemini a través de Firebase Cloud Functions.
 *
 * @param {string} mensaje - Mensaje escrito por el usuario.
 * @returns {Promise<string>} Respuesta de Gemini.
 */
export async function preguntarGemini(mensaje) {

    // --------------------------------------------------------
    // Validar mensaje
    // --------------------------------------------------------

    if (!mensaje || typeof mensaje !== "string") {
        throw new Error("El mensaje está vacío.");
    }

    mensaje = mensaje.trim();

    if (!mensaje) {
        throw new Error("El mensaje está vacío.");
    }

    // --------------------------------------------------------
    // Verificar usuario autenticado
    // --------------------------------------------------------

    const usuario = auth.currentUser;

    if (!usuario) {
        throw new Error(
            "No hay un usuario autenticado en GESBASE."
        );
    }

    // --------------------------------------------------------
    // Obtener token de Firebase
    // --------------------------------------------------------

    let token;

    try {

        token = await usuario.getIdToken(true);

    } catch (error) {

        console.error(
            "Error obteniendo token de Firebase:",
            error
        );

        throw new Error(
            "No se pudo verificar la sesión del usuario."
        );
    }

    // --------------------------------------------------------
    // Enviar consulta a Cloud Function
    // --------------------------------------------------------

    let respuesta;

    try {

        respuesta = await fetch(
            GEMINI_FUNCTION_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    mensaje: mensaje
                })
            }
        );

    } catch (error) {

        console.error(
            "Error conectando con Gemini:",
            error
        );

        throw new Error(
            "No se pudo conectar con la inteligencia artificial."
        );
    }

    // --------------------------------------------------------
    // Leer respuesta
    // --------------------------------------------------------

    let datos;

    try {

        datos = await respuesta.json();

    } catch (error) {

        console.error(
            "Respuesta inválida de Cloud Function:",
            error
        );

        throw new Error(
            "La inteligencia artificial devolvió una respuesta inválida."
        );
    }

    // --------------------------------------------------------
    // Comprobar errores HTTP
    // --------------------------------------------------------

    if (!respuesta.ok) {

        console.error(
            "Error Gemini:",
            datos
        );

        throw new Error(
            datos.error ||
            datos.message ||
            `Error de Gemini (${respuesta.status})`
        );
    }

    // --------------------------------------------------------
    // Obtener respuesta
    // --------------------------------------------------------

    if (
        !datos ||
        typeof datos.respuesta !== "string"
    ) {

        console.error(
            "Formato inesperado:",
            datos
        );

        throw new Error(
            "Gemini no devolvió una respuesta válida."
        );
    }

    return datos.respuesta.trim();
}


// ============================================================
// FUNCIÓN ALTERNATIVA
// Permite usar:
// const respuesta = await enviarMensaje("Hola");
// ============================================================

export async function enviarMensaje(mensaje) {

    return await preguntarGemini(mensaje);

}


// ============================================================
// FUNCIÓN PARA COMPROBAR LA CONEXIÓN
// ============================================================

export async function comprobarGemini() {

    try {

        const usuario = auth.currentUser;

        if (!usuario) {

            return {
                conectado: false,
                mensaje: "Usuario no autenticado"
            };

        }

        const token = await usuario.getIdToken();

        const respuesta = await fetch(
            GEMINI_FUNCTION_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    mensaje: "Responde solamente: GESBASE IA funcionando."
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            return {
                conectado: false,
                mensaje:
                    datos.error ||
                    `Error HTTP ${respuesta.status}`
            };

        }

        return {
            conectado: true,
            mensaje: datos.respuesta || "Conectado"
        };

    } catch (error) {

        console.error(
            "Comprobación Gemini:",
            error
        );

        return {
            conectado: false,
            mensaje: error.message
        };

    }

}


// ============================================================
// EXPORTACIÓN POR DEFECTO
// ============================================================

export default {
    preguntarGemini,
    enviarMensaje,
    comprobarGemini
};
