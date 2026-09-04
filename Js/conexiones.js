/* ============================================================
   GESBASE - MÓDULO DE CONEXIONES
   Archivo: Js/conexiones.js

   Funciones:
   - Buscar personas/profesionales/empresas/comercios
   - Enviar solicitudes
   - Aceptar solicitudes
   - Rechazar solicitudes
   - Cancelar solicitudes enviadas
   - Mostrar conexiones aceptadas
   - Mostrar solicitudes recibidas
   - Mostrar solicitudes enviadas
   - Integración con Firestore
   - Integración con red.html

   Requiere que red.html ya tenga:
   import { auth, db } from "./Js/firebase.js";

   Este archivo NO modifica Firebase Auth.
   ============================================================ */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

const COLECCION_USUARIOS = "usuariosRed";
const COLECCION_CONEXIONES = "conexiones";

let usuarioActual = null;

let conexionesCache = [];
let perfilesCache = new Map();

let inicializado = false;
let cargandoConexiones = false;


/* ============================================================
   ELEMENTOS DOM
   ============================================================ */

const obtenerElemento = (id) => {
    return document.getElementById(id);
};


/* ============================================================
   UTILIDADES
   ============================================================ */

function escaparHTML(valor) {

    if (valor === null || valor === undefined) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function normalizarTexto(valor) {

    return String(valor || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


function obtenerNombrePerfil(perfil) {

    if (!perfil) {
        return "Usuario de GESBASE";
    }

    if (perfil.nombreCompleto) {
        return perfil.nombreCompleto;
    }

    const nombre = `${perfil.nombre || ""} ${perfil.apellido || ""}`.trim();

    if (nombre) {
        return nombre;
    }

    if (perfil.nombreEmpresa) {
        return perfil.nombreEmpresa;
    }

    if (perfil.email) {
        return perfil.email;
    }

    return "Usuario de GESBASE";
}


function obtenerIniciales(perfil) {

    const nombre = obtenerNombrePerfil(perfil);

    const partes = nombre
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!partes.length) {
        return "G";
    }

    if (partes.length === 1) {
        return partes[0].substring(0, 2).toUpperCase();
    }

    return (
        partes[0].substring(0, 1) +
        partes[1].substring(0, 1)
    ).toUpperCase();
}


function mostrarMensaje(mensaje, tipo = "info") {

    /*
       Intentamos utilizar el toast que ya existe en red.html.
       Si no existe, usamos una alternativa visual.
    */

    if (typeof window.mostrarToast === "function") {

        window.mostrarToast(mensaje, tipo);

        return;
    }

    console.log(`[GESBASE Conexiones] ${mensaje}`);

    /*
       Fallback.
    */

    let contenedor = obtenerElemento("toastConexiones");

    if (!contenedor) {

        contenedor = document.createElement("div");

        contenedor.id = "toastConexiones";

        contenedor.style.position = "fixed";
        contenedor.style.left = "50%";
        contenedor.style.bottom = "25px";
        contenedor.style.transform = "translateX(-50%)";
        contenedor.style.zIndex = "99999";
        contenedor.style.padding = "12px 18px";
        contenedor.style.borderRadius = "12px";
        contenedor.style.background = "#111827";
        contenedor.style.color = "#ffffff";
        contenedor.style.fontSize = "14px";
        contenedor.style.fontWeight = "600";
        contenedor.style.boxShadow = "0 10px 30px rgba(0,0,0,.25)";
        contenedor.style.maxWidth = "90%";
        contenedor.style.textAlign = "center";

        document.body.appendChild(contenedor);
    }

    contenedor.textContent = mensaje;

    clearTimeout(window.__gesbaseToastConexionTimer);

    window.__gesbaseToastConexionTimer = setTimeout(() => {

        if (contenedor) {
            contenedor.remove();
        }

    }, 3000);
}


/* ============================================================
   USUARIO ACTUAL
   ============================================================ */

export function establecerUsuarioConexiones(usuario) {

    usuarioActual = usuario || null;

    if (!usuarioActual) {

        conexionesCache = [];
        perfilesCache.clear();

        limpiarListasConexiones();

        return;
    }

    /*
       Cuando cambia el usuario, limpiamos cache.
    */

    conexionesCache = [];
    perfilesCache.clear();
}


/* ============================================================
   ID ÚNICO DE CONEXIÓN
   ============================================================ */

function obtenerIdConexion(uidA, uidB) {

    const ids = [
        String(uidA),
        String(uidB)
    ].sort();

    return `${ids[0]}__${ids[1]}`;
}


/* ============================================================
   PERFIL FIRESTORE
   ============================================================ */

async function obtenerPerfil(uid) {

    if (!uid) {
        return null;
    }

    if (perfilesCache.has(uid)) {
        return perfilesCache.get(uid);
    }

    try {

        const referencia = doc(
            db,
            COLECCION_USUARIOS,
            uid
        );

        const resultado = await getDoc(referencia);

        if (!resultado.exists()) {

            perfilesCache.set(uid, null);

            return null;
        }

        const datos = {
            uid,
            ...resultado.data()
        };

        perfilesCache.set(uid, datos);

        return datos;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error obteniendo perfil:",
            error
        );

        return null;
    }
}


/* ============================================================
   OBTENER CONEXIÓN ENTRE DOS USUARIOS
   ============================================================ */

async function obtenerConexion(uidA, uidB) {

    if (!uidA || !uidB || uidA === uidB) {
        return null;
    }

    try {

        const idConexion = obtenerIdConexion(uidA, uidB);

        const referencia = doc(
            db,
            COLECCION_CONEXIONES,
            idConexion
        );

        const resultado = await getDoc(referencia);

        if (!resultado.exists()) {
            return null;
        }

        return {
            id: resultado.id,
            ...resultado.data()
        };

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error obteniendo conexión:",
            error
        );

        return null;
    }
}


/* ============================================================
   CARGAR TODAS LAS CONEXIONES DEL USUARIO
   ============================================================ */

export async function cargarConexiones() {

    if (!usuarioActual || !usuarioActual.uid) {
        return [];
    }

    if (cargandoConexiones) {
        return conexionesCache;
    }

    cargandoConexiones = true;

    try {

        const uid = usuarioActual.uid;

        const referencia = collection(
            db,
            COLECCION_CONEXIONES
        );

        /*
           Se hacen dos consultas para evitar depender de
           consultas OR y reducir problemas con índices.
        */

        const consulta1 = query(
            referencia,
            where("uid1", "==", uid),
            limit(200)
        );

        const consulta2 = query(
            referencia,
            where("uid2", "==", uid),
            limit(200)
        );

        const [resultado1, resultado2] = await Promise.all([
            getDocs(consulta1),
            getDocs(consulta2)
        ]);

        const mapa = new Map();

        resultado1.forEach(resultado => {

            mapa.set(
                resultado.id,
                {
                    id: resultado.id,
                    ...resultado.data()
                }
            );

        });

        resultado2.forEach(resultado => {

            mapa.set(
                resultado.id,
                {
                    id: resultado.id,
                    ...resultado.data()
                }
            );

        });

        conexionesCache = Array.from(mapa.values());

        return conexionesCache;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error cargando conexiones:",
            error
        );

        mostrarMensaje(
            "No se pudieron cargar las conexiones. Verificá los permisos de Firestore.",
            "error"
        );

        return [];

    } finally {

        cargandoConexiones = false;
    }
}


/* ============================================================
   OBTENER UID DEL OTRO USUARIO
   ============================================================ */

function obtenerOtroUid(conexion) {

    if (!usuarioActual || !conexion) {
        return null;
    }

    if (conexion.uid1 === usuarioActual.uid) {
        return conexion.uid2;
    }

    if (conexion.uid2 === usuarioActual.uid) {
        return conexion.uid1;
    }

    return null;
}


/* ============================================================
   ESTADO DE UNA CONEXIÓN
   ============================================================ */

export async function obtenerEstadoConexion(uidDestino) {

    if (!usuarioActual || !uidDestino) {
        return {
            estado: "ninguna"
        };
    }

    if (usuarioActual.uid === uidDestino) {
        return {
            estado: "propio"
        };
    }

    /*
       Primero buscamos en cache.
    */

    const conexionCacheada = conexionesCache.find(conexion => {

        return (
            conexion.uid1 === usuarioActual.uid &&
            conexion.uid2 === uidDestino
        ) ||
        (
            conexion.uid2 === usuarioActual.uid &&
            conexion.uid1 === uidDestino
        );

    });

    if (conexionCacheada) {

        return {
            estado: conexionCacheada.estado,
            conexion: conexionCacheada
        };
    }

    /*
       Si no está en cache, consultamos Firestore.
    */

    const conexion = await obtenerConexion(
        usuarioActual.uid,
        uidDestino
    );

    if (!conexion) {

        return {
            estado: "ninguna"
        };
    }

    return {
        estado: conexion.estado,
        conexion
    };
}


/* ============================================================
   ENVIAR SOLICITUD DE CONEXIÓN
   ============================================================ */

export async function enviarSolicitudConexion(uidDestino) {

    if (!usuarioActual || !usuarioActual.uid) {

        mostrarMensaje(
            "Tenés que iniciar sesión para enviar una solicitud.",
            "error"
        );

        return false;
    }

    if (!uidDestino) {

        mostrarMensaje(
            "No se encontró el usuario seleccionado.",
            "error"
        );

        return false;
    }

    if (usuarioActual.uid === uidDestino) {

        mostrarMensaje(
            "No podés enviarte una solicitud a vos mismo.",
            "error"
        );

        return false;
    }

    try {

        const idConexion = obtenerIdConexion(
            usuarioActual.uid,
            uidDestino
        );

        const referencia = doc(
            db,
            COLECCION_CONEXIONES,
            idConexion
        );

        const resultado = await getDoc(referencia);

        /*
           Ya existe una relación.
        */

        if (resultado.exists()) {

            const conexion = {
                id: resultado.id,
                ...resultado.data()
            };

            if (conexion.estado === "aceptada") {

                mostrarMensaje(
                    "Ya están conectados.",
                    "info"
                );

                return false;
            }

            if (
                conexion.estado === "pendiente" &&
                conexion.solicitanteUid === usuarioActual.uid
            ) {

                mostrarMensaje(
                    "La solicitud ya fue enviada.",
                    "info"
                );

                return false;
            }

            /*
               El otro usuario nos había enviado una solicitud.
               En lugar de crear otra, la aceptamos.
            */

            if (
                conexion.estado === "pendiente" &&
                conexion.receptorUid === usuarioActual.uid
            ) {

                await updateDoc(
                    referencia,
                    {
                        estado: "aceptada",
                        aceptadoEn: serverTimestamp(),
                        actualizadoEn: serverTimestamp()
                    }
                );

                mostrarMensaje(
                    "Ahora están conectados.",
                    "success"
                );

                await cargarConexiones();

                actualizarInterfazConexiones();

                return true;
            }

            /*
               Si estaba rechazada, permitimos volver a conectar.
            */

            if (conexion.estado === "rechazada") {

                await setDoc(
                    referencia,
                    {
                        uid1: obtenerIdConexionBase(
                            usuarioActual.uid,
                            uidDestino
                        ).uid1,

                        uid2: obtenerIdConexionBase(
                            usuarioActual.uid,
                            uidDestino
                        ).uid2,

                        solicitanteUid: usuarioActual.uid,
                        receptorUid: uidDestino,
                        estado: "pendiente",
                        actualizadoEn: serverTimestamp(),
                        creadoEn: conexion.creadoEn || serverTimestamp()
                    }
                );

                mostrarMensaje(
                    "Solicitud enviada nuevamente.",
                    "success"
                );

                await cargarConexiones();

                actualizarInterfazConexiones();

                return true;
            }
        }

        const ids = obtenerIdConexionBase(
            usuarioActual.uid,
            uidDestino
        );

        await setDoc(
            referencia,
            {
                uid1: ids.uid1,
                uid2: ids.uid2,

                solicitanteUid: usuarioActual.uid,
                receptorUid: uidDestino,

                estado: "pendiente",

                creadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp()
            }
        );

        mostrarMensaje(
            "Solicitud de conexión enviada.",
            "success"
        );

        await cargarConexiones();

        actualizarInterfazConexiones();

        return true;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error enviando solicitud:",
            error
        );

        mostrarMensaje(
            obtenerMensajeErrorFirestore(error),
            "error"
        );

        return false;
    }
}


/* ============================================================
   OBTENER IDS BASE
   ============================================================ */

function obtenerIdConexionBase(uidA, uidB) {

    const ids = [
        String(uidA),
        String(uidB)
    ].sort();

    return {
        uid1: ids[0],
        uid2: ids[1]
    };
}


/* ============================================================
   ACEPTAR SOLICITUD
   ============================================================ */

export async function aceptarSolicitudConexion(idConexion) {

    if (!usuarioActual || !idConexion) {
        return false;
    }

    try {

        const referencia = doc(
            db,
            COLECCION_CONEXIONES,
            idConexion
        );

        const resultado = await getDoc(referencia);

        if (!resultado.exists()) {

            mostrarMensaje(
                "La solicitud ya no existe.",
                "error"
            );

            return false;
        }

        const conexion = resultado.data();

        if (conexion.receptorUid !== usuarioActual.uid) {

            mostrarMensaje(
                "No podés aceptar esta solicitud.",
                "error"
            );

            return false;
        }

        if (conexion.estado !== "pendiente") {

            mostrarMensaje(
                "Esta solicitud ya fue procesada.",
                "info"
            );

            return false;
        }

        await updateDoc(
            referencia,
            {
                estado: "aceptada",
                aceptadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp()
            }
        );

        mostrarMensaje(
            "Solicitud aceptada. Ahora están conectados.",
            "success"
        );

        await cargarConexiones();

        actualizarInterfazConexiones();

        return true;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error aceptando solicitud:",
            error
        );

        mostrarMensaje(
            obtenerMensajeErrorFirestore(error),
            "error"
        );

        return false;
    }
}


/* ============================================================
   RECHAZAR SOLICITUD
   ============================================================ */

export async function rechazarSolicitudConexion(idConexion) {

    if (!usuarioActual || !idConexion) {
        return false;
    }

    try {

        const referencia = doc(
            db,
            COLECCION_CONEXIONES,
            idConexion
        );

        const resultado = await getDoc(referencia);

        if (!resultado.exists()) {

            mostrarMensaje(
                "La solicitud ya no existe.",
                "error"
            );

            return false;
        }

        const conexion = resultado.data();

        if (conexion.receptorUid !== usuarioActual.uid) {

            mostrarMensaje(
                "No podés rechazar esta solicitud.",
                "error"
            );

            return false;
        }

        if (conexion.estado !== "pendiente") {

            mostrarMensaje(
                "Esta solicitud ya fue procesada.",
                "info"
            );

            return false;
        }

        await updateDoc(
            referencia,
            {
                estado: "rechazada",
                rechazadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp()
            }
        );

        mostrarMensaje(
            "Solicitud rechazada.",
            "success"
        );

        await cargarConexiones();

        actualizarInterfazConexiones();

        return true;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error rechazando solicitud:",
            error
        );

        mostrarMensaje(
            obtenerMensajeErrorFirestore(error),
            "error"
        );

        return false;
    }
}


/* ============================================================
   CANCELAR SOLICITUD ENVIADA
   ============================================================ */

export async function cancelarSolicitudConexion(idConexion) {

    if (!usuarioActual || !idConexion) {
        return false;
    }

    try {

        const referencia = doc(
            db,
            COLECCION_CONEXIONES,
            idConexion
        );

        const resultado = await getDoc(referencia);

        if (!resultado.exists()) {

            mostrarMensaje(
                "La solicitud ya no existe.",
                "error"
            );

            return false;
        }

        const conexion = resultado.data();

        if (conexion.solicitanteUid !== usuarioActual.uid) {

            mostrarMensaje(
                "No podés cancelar esta solicitud.",
                "error"
            );

            return false;
        }

        if (conexion.estado !== "pendiente") {

            mostrarMensaje(
                "Esta solicitud ya no está pendiente.",
                "info"
            );

            return false;
        }

        await deleteDoc(referencia);

        mostrarMensaje(
            "Solicitud cancelada.",
            "success"
        );

        await cargarConexiones();

        actualizarInterfazConexiones();

        return true;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error cancelando solicitud:",
            error
        );

        mostrarMensaje(
            obtenerMensajeErrorFirestore(error),
            "error"
        );

        return false;
    }
}


/* ============================================================
   CATEGORIZAR CONEXIONES
   ============================================================ */

function obtenerCategoriasConexiones() {

    const recibidas = [];
    const enviadas = [];
    const aceptadas = [];

    if (!usuarioActual) {

        return {
            recibidas,
            enviadas,
            aceptadas
        };
    }

    conexionesCache.forEach(conexion => {

        if (conexion.estado === "aceptada") {

            aceptadas.push(conexion);

            return;
        }

        if (conexion.estado !== "pendiente") {
            return;
        }

        if (conexion.receptorUid === usuarioActual.uid) {

            recibidas.push(conexion);

            return;
        }

        if (conexion.solicitanteUid === usuarioActual.uid) {

            enviadas.push(conexion);
        }

    });

    return {
        recibidas,
        enviadas,
        aceptadas
    };
}


/* ============================================================
   RENDER DE TARJETA DE PERFIL
   ============================================================ */

async function crearTarjetaConexion(conexion, tipo) {

    const otroUid = obtenerOtroUid(conexion);

    if (!otroUid) {
        return "";
    }

    const perfil = await obtenerPerfil(otroUid);

    const nombre = obtenerNombrePerfil(perfil);

    const tipoPerfil = perfil?.tipoPerfil || "persona";

    const actividad = perfil?.actividad || "";

    const localidad = perfil?.localidad || "";

    const provincia = perfil?.provincia || "";

    const descripcion = perfil?.descripcion || "";

    const foto = perfil?.fotoPerfil || "";

    let ubicacion = "";

    if (localidad && provincia) {

        ubicacion = `${localidad}, ${provincia}`;

    } else {

        ubicacion = localidad || provincia;
    }

    let avatar;

    if (foto) {

        avatar = `
            <img
                src="${escaparHTML(foto)}"
                alt="${escaparHTML(nombre)}"
                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;
                "
            >
        `;

    } else {

        avatar = `
            <span>
                ${escaparHTML(obtenerIniciales(perfil))}
            </span>
        `;
    }

    let acciones = "";

    if (tipo === "recibida") {

        acciones = `
            <button
                type="button"
                class="btn btn-principal"
                data-accion-conexion="aceptar"
                data-id-conexion="${escaparHTML(conexion.id)}"
            >
                ✓ Aceptar
            </button>

            <button
                type="button"
                class="btn btn-secundario"
                data-accion-conexion="rechazar"
                data-id-conexion="${escaparHTML(conexion.id)}"
            >
                ✕ Rechazar
            </button>
        `;

    } else if (tipo === "enviada") {

        acciones = `
            <span class="estado-conexion-inline">
                ⏳ Solicitud enviada
            </span>

            <button
                type="button"
                class="btn btn-secundario"
                data-accion-conexion="cancelar"
                data-id-conexion="${escaparHTML(conexion.id)}"
            >
                Cancelar
            </button>
        `;

    } else {

        acciones = `
            <span class="estado-conexion-inline conectado">
                ✓ Conectado
            </span>
        `;
    }

    return `
        <article class="conexion-card">

            <div class="conexion-avatar">
                ${avatar}
            </div>

            <div class="conexion-info">

                <strong class="conexion-nombre">
                    ${escaparHTML(nombre)}
                </strong>

                <span class="conexion-tipo">
                    ${escaparHTML(formatearTipoPerfil(tipoPerfil))}
                </span>

                ${
                    actividad
                        ? `
                            <span class="conexion-dato">
                                💼 ${escaparHTML(actividad)}
                            </span>
                        `
                        : ""
                }

                ${
                    ubicacion
                        ? `
                            <span class="conexion-dato">
                                📍 ${escaparHTML(ubicacion)}
                            </span>
                        `
                        : ""
                }

                ${
                    descripcion
                        ? `
                            <p class="conexion-descripcion">
                                ${escaparHTML(
                                    descripcion.length > 140
                                        ? descripcion.substring(0, 140) + "..."
                                        : descripcion
                                )}
                            </p>
                        `
                        : ""
                }

                <div class="conexion-acciones">
                    ${acciones}
                </div>

            </div>

        </article>
    `;
}


/* ============================================================
   FORMATEAR TIPO DE PERFIL
   ============================================================ */

function formatearTipoPerfil(tipo) {

    const valores = {
        persona: "Persona",
        profesional: "Profesional",
        trabajador: "Trabajador",
        empresa: "Empresa",
        comercio: "Comercio"
    };

    return valores[tipo] || (
        String(tipo || "Persona")
            .charAt(0)
            .toUpperCase() +
        String(tipo || "Persona")
            .slice(1)
    );
}


/* ============================================================
   RENDERIZAR LISTA
   ============================================================ */

async function renderizarListaConexiones(
    elemento,
    conexiones,
    tipo,
    mensajeVacio,
    emoji = "🤝"
) {

    if (!elemento) {
        return;
    }

    if (!conexiones.length) {

        elemento.innerHTML = `
            <div class="conexion-vacio">

                <div class="conexion-vacio-emoji">
                    ${emoji}
                </div>

                <strong>
                    ${escaparHTML(mensajeVacio)}
                </strong>

                <p>
                    Buscá personas, profesionales, trabajadores,
                    empresas y comercios para ampliar tu red.
                </p>

                <button
                    type="button"
                    class="btn btn-principal"
                    data-accion-conexion="ir-personas"
                >
                    Buscar perfiles
                </button>

            </div>
        `;

        return;
    }

    elemento.innerHTML = `
        <div class="conexiones-lista">
            ${await Promise.all(
                conexiones.map(conexion =>
                    crearTarjetaConexion(conexion, tipo)
                )
            ).then(lista => lista.join(""))}
        </div>
    `;
}


/* ============================================================
   ACTUALIZAR CONTADORES
   ============================================================ */

function actualizarContadoresConexiones() {

    const categorias = obtenerCategoriasConexiones();

    const contadorConectadas =
        obtenerElemento("contadorConectadas");

    const contadorRecibidas =
        obtenerElemento("contadorRecibidas");

    const contadorEnviadas =
        obtenerElemento("contadorEnviadas");

    if (contadorConectadas) {

        contadorConectadas.textContent =
            categorias.aceptadas.length;
    }

    if (contadorRecibidas) {

        contadorRecibidas.textContent =
            categorias.recibidas.length;
    }

    if (contadorEnviadas) {

        contadorEnviadas.textContent =
            categorias.enviadas.length;
    }

    /*
       También actualizamos badges si existen.
    */

    const badgeConexiones =
        obtenerElemento("badgeConexiones");

    if (badgeConexiones) {

        const total =
            categorias.recibidas.length;

        if (total > 0) {

            badgeConexiones.textContent = total;
            badgeConexiones.style.display = "inline-flex";

        } else {

            badgeConexiones.style.display = "none";
        }
    }
}


/* ============================================================
   ACTUALIZAR INTERFAZ
   ============================================================ */

export async function actualizarInterfazConexiones() {

    if (!usuarioActual) {
        return;
    }

    actualizarContadoresConexiones();

    const categorias = obtenerCategoriasConexiones();

    const listaConectadas =
        obtenerElemento("listaConexiones");

    const listaRecibidas =
        obtenerElemento("listaSolicitudesRecibidas");

    const listaEnviadas =
        obtenerElemento("listaSolicitudesEnviadas");

    await renderizarListaConexiones(
        listaConectadas,
        categorias.aceptadas,
        "aceptada",
        "Todavía no tenés conexiones.",
        "🤝"
    );

    await renderizarListaConexiones(
        listaRecibidas,
        categorias.recibidas,
        "recibida",
        "No tenés solicitudes pendientes.",
        "📨"
    );

    await renderizarListaConexiones(
        listaEnviadas,
        categorias.enviadas,
        "enviada",
        "No tenés solicitudes enviadas.",
        "📤"
    );
}


/* ============================================================
   LIMPIAR LISTAS
   ============================================================ */

function limpiarListasConexiones() {

    const ids = [
        "listaConexiones",
        "listaSolicitudesRecibidas",
        "listaSolicitudesEnviadas"
    ];

    ids.forEach(id => {

        const elemento = obtenerElemento(id);

        if (elemento) {
            elemento.innerHTML = "";
        }

    });

    actualizarContadoresConexiones();
}


/* ============================================================
   CAMBIAR PESTAÑA
   ============================================================ */

export function cambiarPanelConexiones(panel) {

    const paneles = [
        "conectadas",
        "recibidas",
        "enviadas"
    ];

    paneles.forEach(nombre => {

        const elemento =
            obtenerElemento(
                `panel-conexiones-${nombre}`
            );

        if (elemento) {

            elemento.classList.toggle(
                "activo",
                nombre === panel
            );
        }
    });

    document
        .querySelectorAll("[data-conexiones-tab]")
        .forEach(boton => {

            boton.classList.toggle(
                "activo",
                boton.dataset.conexionesTab === panel
            );

        });
}


/* ============================================================
   BUSCADOR DE PERSONAS
   ============================================================ */

export async function buscarPersonas(texto = "") {

    const lista =
        obtenerElemento("listaPersonas");

    if (!lista) {
        return;
    }

    const busqueda = normalizarTexto(texto);

    lista.innerHTML = `
        <div class="conexion-cargando">
            Buscando perfiles...
        </div>
    `;

    try {

        /*
           Limitamos la lectura inicial para no descargar
           cantidades innecesarias de perfiles.
        */

        const referencia =
            collection(
                db,
                COLECCION_USUARIOS
            );

        const consulta =
            query(
                referencia,
                limit(100)
            );

        const resultado =
            await getDocs(consulta);

        let perfiles = [];

        resultado.forEach(documento => {

            const perfil = {
                uid: documento.id,
                ...documento.data()
            };

            /*
               No mostramos al usuario actual.
            */

            if (
                usuarioActual &&
                perfil.uid === usuarioActual.uid
            ) {
                return;
            }

            /*
               Si el perfil está marcado como no visible,
               no lo mostramos.
            */

            if (perfil.visible === false) {
                return;
            }

            perfiles.push(perfil);
        });


        /*
           Si hay texto, filtramos localmente.
        */

        if (busqueda) {

            perfiles = perfiles.filter(perfil => {

                const textoPerfil = [
                    perfil.nombre,
                    perfil.apellido,
                    perfil.nombreCompleto,
                    perfil.nombreEmpresa,
                    perfil.tipoPerfil,
                    perfil.actividad,
                    perfil.servicios,
                    perfil.localidad,
                    perfil.provincia,
                    perfil.descripcion
                ]
                    .filter(Boolean)
                    .join(" ");

                return normalizarTexto(textoPerfil)
                    .includes(busqueda);
            });
        }


        /*
           Ordenamos por nombre.
        */

        perfiles.sort((a, b) => {

            return normalizarTexto(
                obtenerNombrePerfil(a)
            ).localeCompare(
                normalizarTexto(
                    obtenerNombrePerfil(b)
                ),
                "es"
            );

        });


        if (!perfiles.length) {

            lista.innerHTML = `
                <div class="conexion-vacio">

                    <div class="conexion-vacio-emoji">
                        🔎
                    </div>

                    <strong>
                        No encontramos perfiles.
                    </strong>

                    <p>
                        Probá con otro nombre, actividad,
                        localidad o empresa.
                    </p>

                </div>
            `;

            return;
        }


        /*
           Guardamos perfiles en cache.
        */

        perfiles.forEach(perfil => {

            perfilesCache.set(
                perfil.uid,
                perfil
            );

        });


        const html = [];

        for (const perfil of perfiles) {

            html.push(
                await crearTarjetaBusqueda(perfil)
            );
        }

        lista.innerHTML = `
            <div class="conexiones-lista">
                ${html.join("")}
            </div>
        `;

    } catch (error) {

        console.error(
            "GESBASE Conexiones - Error buscando perfiles:",
            error
        );

        lista.innerHTML = `
            <div class="conexion-vacio">

                <div class="conexion-vacio-emoji">
                    ⚠️
                </div>

                <strong>
                    No se pudo realizar la búsqueda.
                </strong>

                <p>
                    ${escaparHTML(
                        obtenerMensajeErrorFirestore(error)
                    )}
                </p>

            </div>
        `;
    }
}


/* ============================================================
   TARJETA DE RESULTADO DE BÚSQUEDA
   ============================================================ */

async function crearTarjetaBusqueda(perfil) {

    const nombre =
        obtenerNombrePerfil(perfil);

    const tipoPerfil =
        perfil.tipoPerfil || "persona";

    const actividad =
        perfil.actividad || "";

    const localidad =
        perfil.localidad || "";

    const provincia =
        perfil.provincia || "";

    const foto =
        perfil.fotoPerfil || "";

    const estado =
        await obtenerEstadoConexion(perfil.uid);

    let avatar;

    if (foto) {

        avatar = `
            <img
                src="${escaparHTML(foto)}"
                alt="${escaparHTML(nombre)}"
                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;
                "
            >
        `;

    } else {

        avatar = `
            <span>
                ${escaparHTML(obtenerIniciales(perfil))}
            </span>
        `;
    }


    let botonConexion = "";


    switch (estado.estado) {

        case "aceptada":

            botonConexion = `
                <button
                    type="button"
                    class="btn btn-secundario"
                    disabled
                >
                    ✓ Conectado
                </button>
            `;

            break;


        case "pendiente":

            if (
                estado.conexion &&
                estado.conexion.solicitanteUid ===
                    usuarioActual?.uid
            ) {

                botonConexion = `
                    <button
                        type="button"
                        class="btn btn-secundario"
                        disabled
                    >
                        ⏳ Solicitud enviada
                    </button>
                `;

            } else {

                botonConexion = `
                    <button
                        type="button"
                        class="btn btn-principal"
                        data-accion-conexion="aceptar-desde-busqueda"
                        data-id-conexion="${
                            escaparHTML(
                                estado.conexion?.id || ""
                            )
                        }"
                    >
                        ✓ Aceptar solicitud
                    </button>
                `;
            }

            break;


        default:

            botonConexion = `
                <button
                    type="button"
                    class="btn btn-principal"
                    data-accion-conexion="conectar"
                    data-uid-destino="${escaparHTML(perfil.uid)}"
                >
                    🤝 Conectar
                </button>
            `;

            break;
    }


    const ubicacion =
        localidad && provincia
            ? `${localidad}, ${provincia}`
            : localidad || provincia;


    return `
        <article class="conexion-card">

            <div class="conexion-avatar">
                ${avatar}
            </div>

            <div class="conexion-info">

                <strong class="conexion-nombre">
                    ${escaparHTML(nombre)}
                </strong>

                <span class="conexion-tipo">
                    ${escaparHTML(
                        formatearTipoPerfil(tipoPerfil)
                    )}
                </span>

                ${
                    actividad
                        ? `
                            <span class="conexion-dato">
                                💼 ${escaparHTML(actividad)}
                            </span>
                        `
                        : ""
                }

                ${
                    ubicacion
                        ? `
                            <span class="conexion-dato">
                                📍 ${escaparHTML(ubicacion)}
                            </span>
                        `
                        : ""
                }

                <div class="conexion-acciones">
                    ${botonConexion}
                </div>

            </div>

        </article>
    `;
}


/* ============================================================
   MANEJO DE BOTONES DE CONEXIONES
   ============================================================ */

function configurarEventosConexiones() {

    /*
       Eventos de pestañas.
    */

    document.addEventListener(
        "click",
        async evento => {

            const botonTab =
                evento.target.closest(
                    "[data-conexiones-tab]"
                );

            if (botonTab) {

                evento.preventDefault();

                const panel =
                    botonTab.dataset.conexionesTab;

                cambiarPanelConexiones(panel);

                return;
            }


            /*
               Botones de acciones.
            */

            const botonAccion =
                evento.target.closest(
                    "[data-accion-conexion]"
                );

            if (!botonAccion) {
                return;
            }

            const accion =
                botonAccion.dataset.accionConexion;


            if (accion === "conectar") {

                const uid =
                    botonAccion.dataset.uidDestino;

                botonAccion.disabled = true;

                await enviarSolicitudConexion(uid);

                /*
                   Volvemos a buscar si el buscador está visible.
                */

                const busqueda =
                    obtenerElemento("busquedaPersonas");

                if (busqueda) {

                    await buscarPersonas(
                        busqueda.value
                    );
                }

                return;
            }


            if (accion === "aceptar") {

                const id =
                    botonAccion.dataset.idConexion;

                botonAccion.disabled = true;

                await aceptarSolicitudConexion(id);

                return;
            }


            if (
                accion ===
                "aceptar-desde-busqueda"
            ) {

                const id =
                    botonAccion.dataset.idConexion;

                botonAccion.disabled = true;

                await aceptarSolicitudConexion(id);

                const busqueda =
                    obtenerElemento("busquedaPersonas");

                if (busqueda) {

                    await buscarPersonas(
                        busqueda.value
                    );
                }

                return;
            }


            if (accion === "rechazar") {

                const id =
                    botonAccion.dataset.idConexion;

                botonAccion.disabled = true;

                await rechazarSolicitudConexion(id);

                return;
            }


            if (accion === "cancelar") {

                const id =
                    botonAccion.dataset.idConexion;

                const confirmar =
                    window.confirm(
                        "¿Querés cancelar esta solicitud?"
                    );

                if (!confirmar) {
                    return;
                }

                botonAccion.disabled = true;

                await cancelarSolicitudConexion(id);

                return;
            }


            if (accion === "ir-personas") {

                /*
                   Intentamos utilizar cambiarVista()
                   que ya existe en red.html.
                */

                if (
                    typeof window.cambiarVista ===
                    "function"
                ) {

                    window.cambiarVista("personas");

                } else {

                    const vistaPersonas =
                        obtenerElemento("vista-personas");

                    const vistaConexiones =
                        obtenerElemento("vista-conexiones");

                    if (vistaPersonas) {
                        vistaPersonas.classList.add("activa");
                    }

                    if (vistaConexiones) {
                        vistaConexiones.classList.remove("activa");
                    }
                }

                return;
            }

        }
    );


    /*
       Botón buscar personas.
    */

    const botonBuscar =
        obtenerElemento("btnBuscarPersonas");

    if (botonBuscar) {

        botonBuscar.addEventListener(
            "click",
            async () => {

                const campo =
                    obtenerElemento("busquedaPersonas");

                await buscarPersonas(
                    campo?.value || ""
                );
            }
        );
    }


    /*
       Enter en el buscador.
    */

    const campoBusqueda =
        obtenerElemento("busquedaPersonas");

    if (campoBusqueda) {

        campoBusqueda.addEventListener(
            "keydown",
            async evento => {

                if (
                    evento.key ===
                    "Enter"
                ) {

                    evento.preventDefault();

                    await buscarPersonas(
                        campoBusqueda.value
                    );
                }
            }
        );
    }
}


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

export async function inicializarConexiones(usuario) {

    if (usuario) {
        establecerUsuarioConexiones(usuario);
    }

    if (!usuarioActual) {
        return;
    }

    if (!inicializado) {

        configurarEventosConexiones();

        inicializado = true;
    }

    await cargarConexiones();

    await actualizarInterfazConexiones();
}


/* ============================================================
   REFRESCAR
   ============================================================ */

export async function refrescarConexiones() {

    if (!usuarioActual) {
        return;
    }

    await cargarConexiones();

    await actualizarInterfazConexiones();
}


/* ============================================================
   FUNCIÓN PARA RED.HTML
   ============================================================ */

export async function abrirConexiones() {

    if (!usuarioActual) {

        mostrarMensaje(
            "Esperando autenticación...",
            "info"
        );

        return;
    }

    await inicializarConexiones();

    cambiarPanelConexiones("conectadas");
}


/* ============================================================
   ERROR FIRESTORE
   ============================================================ */

function obtenerMensajeErrorFirestore(error) {

    if (!error) {
        return "Ocurrió un error inesperado.";
    }

    const codigo =
        error.code || "";

    switch (codigo) {

        case "permission-denied":

            return (
                "Firebase rechazó la operación por permisos. " +
                "Hay que revisar las reglas de Firestore."
            );

        case "unauthenticated":

            return (
                "Tu sesión no está autenticada."
            );

        case "not-found":

            return (
                "El registro solicitado no existe."
            );

        case "failed-precondition":

            return (
                "Firestore requiere una configuración adicional."
            );

        case "unavailable":

            return (
                "Firestore no está disponible en este momento."
            );

        default:

            return (
                error.message ||
                "No se pudo completar la operación."
            );
    }
}


/* ============================================================
   ESTILOS DEL MÓDULO
   ============================================================ */

function insertarEstilosConexiones() {

    if (
        document.getElementById(
            "estilosConexionesGESBASE"
        )
    ) {
        return;
    }

    const estilo =
        document.createElement("style");

    estilo.id =
        "estilosConexionesGESBASE";

    estilo.textContent = `

        /* ============================================
           GESBASE - CONEXIONES
           ============================================ */

        .conexiones-lista {
            display: grid;
            gap: 12px;
            width: 100%;
        }

        .conexion-card {
            display: flex;
            align-items: center;
            gap: 14px;
            width: 100%;
            padding: 14px;
            border: 1px solid rgba(15, 23, 42, .10);
            border-radius: 16px;
            background: #ffffff;
            box-sizing: border-box;
            transition:
                transform .15s ease,
                box-shadow .15s ease,
                border-color .15s ease;
        }

        .conexion-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 22px rgba(15, 23, 42, .08);
            border-color: rgba(15, 118, 110, .20);
        }

        .conexion-avatar {
            width: 62px;
            height: 62px;
            min-width: 62px;
            border-radius: 50%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0f766e;
            color: #ffffff;
            font-size: 18px;
            font-weight: 800;
            box-shadow: 0 4px 12px rgba(15, 23, 42, .12);
        }

        .conexion-info {
            min-width: 0;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .conexion-nombre {
            color: #111827;
            font-size: 16px;
            line-height: 1.25;
            word-break: break-word;
        }

        .conexion-tipo {
            color: #0f766e;
            font-size: 13px;
            font-weight: 700;
        }

        .conexion-dato {
            color: #64748b;
            font-size: 13px;
            line-height: 1.3;
        }

        .conexion-descripcion {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.4;
        }

        .conexion-acciones {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 7px;
            margin-top: 7px;
        }

        .conexion-acciones .btn {
            min-height: 38px;
        }

        .estado-conexion-inline {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 36px;
            padding: 7px 11px;
            border-radius: 10px;
            background: #f1f5f9;
            color: #475569;
            font-size: 13px;
            font-weight: 700;
        }

        .estado-conexion-inline.conectado {
            background: #ecfdf5;
            color: #047857;
        }

        .conexion-vacio {
            width: 100%;
            min-height: 180px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 30px 20px;
            box-sizing: border-box;
            color: #64748b;
        }

        .conexion-vacio-emoji {
            font-size: 38px;
            margin-bottom: 10px;
        }

        .conexion-vacio strong {
            color: #111827;
            font-size: 16px;
            margin-bottom: 6px;
        }

        .conexion-vacio p {
            max-width: 520px;
            margin: 0 0 15px;
            font-size: 14px;
            line-height: 1.5;
        }

        .conexion-cargando {
            width: 100%;
            padding: 25px;
            text-align: center;
            color: #64748b;
        }

        @media (max-width: 520px) {

            .conexion-card {
                align-items: flex-start;
                padding: 12px;
            }

            .conexion-avatar {
                width: 50px;
                height: 50px;
                min-width: 50px;
                font-size: 15px;
            }

            .conexion-nombre {
                font-size: 15px;
            }

            .conexion-acciones {
                width: 100%;
            }

            .conexion-acciones .btn {
                flex: 1;
                min-width: 120px;
            }

        }

    `;

    document.head.appendChild(estilo);
}


/* ============================================================
   EXPONER FUNCIONES EN WINDOW
   Para facilitar integración con red.html.
   ============================================================ */

window.GESBASEConexiones = {

    inicializar: inicializarConexiones,

    abrir: abrirConexiones,

    refrescar: refrescarConexiones,

    buscar: buscarPersonas,

    enviar: enviarSolicitudConexion,

    aceptar: aceptarSolicitudConexion,

    rechazar: rechazarSolicitudConexion,

    cancelar: cancelarSolicitudConexion,

    estado: obtenerEstadoConexion,

    cambiarPanel: cambiarPanelConexiones,

    cargar: cargarConexiones

};


/* ============================================================
   INICIALIZACIÓN AUTOMÁTICA CUANDO EL DOM ESTÁ LISTO
   ============================================================ */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            insertarEstilosConexiones();

        },
        {
            once: true
        }
    );

} else {

    insertarEstilosConexiones();
}


/* ============================================================
   FIN conexiones.js
   ============================================================ */
