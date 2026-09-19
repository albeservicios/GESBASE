/* ============================================================
   GESBASE
   NOTIFICACIONES + LLAMADAS GLOBALES
   ============================================================ */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    where,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

const RUTA_LLAMADA =
    "./llamada.html";

const RUTA_VIDEOLLAMADA =
    "./videollamada.html";

const SONIDO_LLAMADA =
    "./sonidos/llamada.mp3";

const SONIDO_VIDEOLLAMADA =
    "./sonidos/videollamada.mp3";

const SONIDO_MENSAJE =
    "./sonidos/mensaje.mp3";


/* ============================================================
   VARIABLES
   ============================================================ */

let usuarioActual = null;
let empresaActual = null;

let salasEscuchadas = new Set();

let llamadaActual = null;

let intervaloContador = null;

let audioLlamada = null;

let audioContext = null;
let oscilador = null;
let gainNode = null;

let ultimoEstadoLlamada = null;


/* ============================================================
   INICIO
   ============================================================ */

onAuthStateChanged(
    auth,
    async usuario => {

        if (!usuario) {
            console.log(
                "[GESBASE] No hay usuario autenticado."
            );
            return;
        }

        usuarioActual = usuario;

        console.log(
            "[GESBASE] Usuario conectado:",
            usuario.uid
        );

        await iniciarSistemaNotificaciones();
    }
);


/* ============================================================
   OBTENER EMPRESA
   ============================================================ */

async function obtenerEmpresa() {

    if (!usuarioActual) {
        return null;
    }

    try {

        const usuarioRef =
            doc(
                db,
                "usuarios",
                usuarioActual.uid
            );

        const usuarioSnap =
            await getDoc(usuarioRef);

        if (
            !usuarioSnap.exists()
        ) {

            console.warn(
                "[GESBASE] No existe documento de usuario."
            );

            return null;
        }

        const datos =
            usuarioSnap.data();

        const empresaId =
            datos.empresaId ||
            datos.idEmpresa ||
            datos.empresa ||
            null;

        if (!empresaId) {

            console.warn(
                "[GESBASE] El usuario no tiene empresaId."
            );

            return null;
        }

        return empresaId;

    } catch (error) {

        console.error(
            "[GESBASE] Error obteniendo empresa:",
            error
        );

        return null;
    }
}


/* ============================================================
   INICIAR SISTEMA
   ============================================================ */

async function iniciarSistemaNotificaciones() {

    empresaActual =
        await obtenerEmpresa();

    if (!empresaActual) {
        return;
    }

    console.log(
        "[GESBASE] Empresa:",
        empresaActual
    );

    crearEstilosGlobales();

    prepararAudio();

    escucharLlamadas();

    escucharCambiosDeLlamada();
}


/* ============================================================
   AUDIO
   ============================================================ */

function prepararAudio() {

    try {

        audioLlamada =
            new Audio(
                SONIDO_LLAMADA
            );

        audioLlamada.loop = true;

        audioLlamada.volume = 1;

        audioLlamada.preload = "auto";

        console.log(
            "[GESBASE] Audio de llamada preparado."
        );

    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo preparar el audio:",
            error
        );
    }
}


/* ============================================================
   REPRODUCIR TONO
   ============================================================ */

async function reproducirTono(tipo) {

    detenerTono();

    const archivo =
        tipo === "video"
            ? SONIDO_VIDEOLLAMADA
            : SONIDO_LLAMADA;

    try {

        const audio =
            new Audio(
                archivo
            );

        audio.loop = true;

        audio.volume = 1;

        audioLlamada = audio;

        await audio.play();

        console.log(
            "[GESBASE] Tono reproduciéndose."
        );

    } catch (error) {

        console.warn(
            "[GESBASE] El navegador bloqueó el audio:",
            error
        );

        /*
         * Intentamos además Web Audio.
         * Esto sirve como respaldo cuando el archivo
         * no puede reproducirse.
         */

        iniciarTonoWebAudio();
    }
}


/* ============================================================
   TONO WEB AUDIO DE RESPALDO
   ============================================================ */

function iniciarTonoWebAudio() {

    try {

        if (!audioContext) {

            audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();
        }

        if (
            audioContext.state === "suspended"
        ) {

            audioContext.resume()
                .catch(() => {});
        }

        detenerTonoWebAudio();

        oscilador =
            audioContext.createOscillator();

        gainNode =
            audioContext.createGain();

        oscilador.type =
            "sine";

        oscilador.frequency.value =
            700;

        gainNode.gain.value =
            0.15;

        oscilador.connect(
            gainNode
        );

        gainNode.connect(
            audioContext.destination
        );

        oscilador.start();

        console.log(
            "[GESBASE] Tono Web Audio iniciado."
        );

    } catch (error) {

        console.warn(
            "[GESBASE] Web Audio no disponible:",
            error
        );
    }
}


/* ============================================================
   DETENER TONO
   ============================================================ */

function detenerTono() {

    if (audioLlamada) {

        try {

            audioLlamada.pause();

            audioLlamada.currentTime =
                0;

        } catch (error) {}
    }

    detenerTonoWebAudio();
}


/* ============================================================
   DETENER WEB AUDIO
   ============================================================ */

function detenerTonoWebAudio() {

    if (oscilador) {

        try {

            oscilador.stop();

        } catch (error) {}
    }

    oscilador = null;
    gainNode = null;
}


/* ============================================================
   ESCUCHAR LLAMADAS ENTRANTES
   ============================================================ */

function escucharLlamadas() {

    if (!empresaActual) {
        return;
    }

    const salasRef =
        collection(
            db,
            "salas"
        );

    const consulta =
        query(
            salasRef,
            where(
                "empresaId",
                "==",
                empresaActual
            ),
            where(
                "status",
                "==",
                "ringing"
            )
        );

    onSnapshot(
        consulta,
        snapshot => {

            snapshot.docChanges()
                .forEach(
                    cambio => {

                        const sala =
                            cambio.doc.data();

                        const salaId =
                            cambio.doc.id;

                        /*
                         * Evitar procesar dos veces
                         */

                        if (
                            salasEscuchadas.has(
                                salaId
                            )
                        ) {
                            return;
                        }

                        /*
                         * Verificar que el usuario
                         * realmente participe.
                         */

                        const participantes =
                            Array.isArray(
                                sala.participants
                            )
                                ? sala.participants
                                : [];

                        if (
                            !participantes.includes(
                                usuarioActual.uid
                            )
                        ) {
                            return;
                        }

                        /*
                         * No mostrar la propia llamada.
                         */

                        if (
                            sala.createdBy ===
                            usuarioActual.uid
                        ) {
                            return;
                        }

                        salasEscuchadas.add(
                            salaId
                        );

                        console.log(
                            "[GESBASE] Llamada entrante:",
                            salaId
                        );

                        mostrarLlamadaEntrante(
                            salaId,
                            sala
                        );
                    }
                );

        },
        error => {

            console.error(
                "[GESBASE] Error escuchando llamadas:",
                error
            );
        }
    );
}


/* ============================================================
   ESCUCHAR CAMBIOS EN LA LLAMADA ACTUAL
   ============================================================ */

function escucharCambiosDeLlamada() {

    /*
     * Esta función queda preparada para detectar
     * cuando la otra persona acepta o finaliza.
     */

    const salasRef =
        collection(
            db,
            "salas"
        );

    const consulta =
        query(
            salasRef,
            where(
                "empresaId",
                "==",
                empresaActual
            )
        );

    onSnapshot(
        consulta,
        snapshot => {

            snapshot.docChanges()
                .forEach(
                    cambio => {

                        const datos =
                            cambio.doc.data();

                        const id =
                            cambio.doc.id;

                        if (
                            !llamadaActual ||
                            llamadaActual.salaId !== id
                        ) {
                            return;
                        }

                        /*
                         * Si la llamada terminó,
                         * quitar la ventana.
                         */

                        if (
                            datos.status ===
                            "ended"
                        ) {

                            cerrarLlamadaEntrante();

                        }

                    }
                );

        },
        error => {

            console.warn(
                "[GESBASE] Error monitoreando salas:",
                error
            );
        }
    );
}


/* ============================================================
   MOSTRAR LLAMADA ENTRANTE
   ============================================================ */

function mostrarLlamadaEntrante(
    salaId,
    sala
) {

    /*
     * Si ya hay una llamada visible,
     * no crear otra.
     */

    if (
        llamadaActual
    ) {
        return;
    }

    const esVideo =
        sala.type === "video" ||
        sala.type === "videollamada";

    const nombre =
        sala.createdByName ||
        "Usuario de GESBASE";

    llamadaActual = {

        salaId,

        tipo:
            esVideo
                ? "video"
                : "audio",

        nombre,

        inicio:
            Date.now()

    };

    crearVentanaLlamada(
        llamadaActual
    );

    iniciarContador();

    reproducirTono(
        llamadaActual.tipo
    );
}


/* ============================================================
   CREAR VENTANA GLOBAL
   ============================================================ */

function crearVentanaLlamada(
    llamada
) {

    /*
     * Eliminar ventana anterior
     */

    const anterior =
        document.getElementById(
            "gesbase-llamada-entrante"
        );

    if (anterior) {
        anterior.remove();
    }


    const fondo =
        document.createElement(
            "div"
        );

    fondo.id =
        "gesbase-llamada-entrante";


    const caja =
        document.createElement(
            "div"
        );

    caja.className =
        "gesbase-llamada-caja";


    const icono =
        llamada.tipo === "video"
            ? "🎥"
            : "📞";


    const titulo =
        llamada.tipo === "video"
            ? "Videollamada entrante"
            : "Llamada entrante";


    caja.innerHTML = `

        <div class="gesbase-llamada-icono">
            ${icono}
        </div>

        <div class="gesbase-llamada-titulo">
            ${titulo}
        </div>

        <div class="gesbase-llamada-nombre">
            ${escapeHTML(
                llamada.nombre
            )}
        </div>

        <div
            id="gesbase-contador-llamada"
            class="gesbase-contador"
        >
            00:00
        </div>

        <div class="gesbase-llamada-texto">
            Te está llamando...
        </div>

        <div class="gesbase-llamada-botones">

            <button
                id="gesbase-rechazar-llamada"
                class="gesbase-btn-rechazar"
            >
                ❌ Rechazar
            </button>

            <button
                id="gesbase-aceptar-llamada"
                class="gesbase-btn-aceptar"
            >
                ${
                    llamada.tipo === "video"
                        ? "🎥 Aceptar"
                        : "📞 Aceptar"
                }
            </button>

        </div>

    `;


    fondo.appendChild(
        caja
    );

    document.body.appendChild(
        fondo
    );


    /*
     * Botón aceptar
     */

    document
        .getElementById(
            "gesbase-aceptar-llamada"
        )
        .addEventListener(
            "click",
            aceptarLlamada
        );


    /*
     * Botón rechazar
     */

    document
        .getElementById(
            "gesbase-rechazar-llamada"
        )
        .addEventListener(
            "click",
            rechazarLlamada
        );
}


/* ============================================================
   CONTADOR
   ============================================================ */

function iniciarContador() {

    detenerContador();

    intervaloContador =
        setInterval(
            () => {

                if (!llamadaActual) {
                    return;
                }

                const segundos =
                    Math.floor(
                        (
                            Date.now() -
                            llamadaActual.inicio
                        ) / 1000
                    );

                const minutos =
                    Math.floor(
                        segundos / 60
                    );

                const segundosRestantes =
                    segundos % 60;

                const texto =
                    String(
                        minutos
                    ).padStart(
                        2,
                        "0"
                    ) +
                    ":" +
                    String(
                        segundosRestantes
                    ).padStart(
                        2,
                        "0"
                    );

                const contador =
                    document.getElementById(
                        "gesbase-contador-llamada"
                    );

                if (contador) {

                    contador.textContent =
                        texto;
                }

            },
            1000
        );
}


/* ============================================================
   DETENER CONTADOR
   ============================================================ */

function detenerContador() {

    if (
        intervaloContador
    ) {

        clearInterval(
            intervaloContador
        );

        intervaloContador =
            null;
    }
}


/* ============================================================
   ACEPTAR LLAMADA
   ============================================================ */

async function aceptarLlamada() {

    if (!llamadaActual) {
        return;
    }

    const salaId =
        llamadaActual.salaId;

    const tipo =
        llamadaActual.tipo;

    detenerTono();

    detenerContador();


    try {

        /*
         * Marcar llamada como aceptada.
         */

        await updateDoc(
            doc(
                db,
                "salas",
                salaId
            ),
            {
                status:
                    "accepted"
            }
        );

    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo actualizar estado:",
            error
        );
    }


    /*
     * Guardar sala antes de salir.
     */

    sessionStorage.setItem(
        "gesbaseSalaLlamada",
        salaId
    );


    /*
     * Eliminar ventana.
     */

    cerrarLlamadaEntrante();


    /*
     * Abrir directamente la llamada.
     */

    if (
        tipo === "video"
    ) {

        window.location.href =
            RUTA_VIDEOLLAMADA +
            "?sala=" +
            encodeURIComponent(
                salaId
            );

    } else {

        window.location.href =
            RUTA_LLAMADA +
            "?sala=" +
            encodeURIComponent(
                salaId
            );
    }
}


/* ============================================================
   RECHAZAR LLAMADA
   ============================================================ */

async function rechazarLlamada() {

    if (!llamadaActual) {
        return;
    }

    const salaId =
        llamadaActual.salaId;

    detenerTono();

    detenerContador();


    try {

        await updateDoc(
            doc(
                db,
                "salas",
                salaId
            ),
            {
                status:
                    "rejected"
            }
        );

    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo rechazar la llamada:",
            error
        );
    }


    cerrarLlamadaEntrante();
}


/* ============================================================
   CERRAR VENTANA
   ============================================================ */

function cerrarLlamadaEntrante() {

    detenerTono();

    detenerContador();

    const ventana =
        document.getElementById(
            "gesbase-llamada-entrante"
        );

    if (ventana) {
        ventana.remove();
    }

    llamadaActual =
        null;
}


/* ============================================================
   ESTILOS
   ============================================================ */

function crearEstilosGlobales() {

    if (
        document.getElementById(
            "gesbase-estilos-notificaciones"
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            "style"
        );

    style.id =
        "gesbase-estilos-notificaciones";


    style.textContent = `

        #gesbase-llamada-entrante {

            position: fixed;

            inset: 0;

            z-index: 2147483647;

            background:
                rgba(0,0,0,.72);

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 20px;

            font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;

        }


        .gesbase-llamada-caja {

            width: 100%;

            max-width: 390px;

            background:
                #111827;

            color: white;

            border-radius: 28px;

            padding: 30px 22px;

            text-align: center;

            box-shadow:
                0 25px 70px
                rgba(0,0,0,.55);

            animation:
                gesbaseEntrada
                .25s ease;

        }


        @keyframes gesbaseEntrada {

            from {

                opacity: 0;

                transform:
                    scale(.88)
                    translateY(20px);

            }

            to {

                opacity: 1;

                transform:
                    scale(1)
                    translateY(0);

            }

        }


        .gesbase-llamada-icono {

            width: 90px;

            height: 90px;

            margin:
                0 auto 18px;

            border-radius: 50%;

            display: flex;

            align-items: center;

            justify-content: center;

            font-size: 42px;

            background:
                rgba(255,255,255,.10);

            animation:
                gesbasePulso
                1.2s infinite;

        }


        @keyframes gesbasePulso {

            0% {

                transform:
                    scale(1);

            }

            50% {

                transform:
                    scale(1.10);

            }

            100% {

                transform:
                    scale(1);

            }

        }


        .gesbase-llamada-titulo {

            font-size: 22px;

            font-weight: 700;

            margin-bottom: 8px;

        }


        .gesbase-llamada-nombre {

            font-size: 20px;

            font-weight: 600;

            margin-bottom: 10px;

        }


        .gesbase-contador {

            font-size: 30px;

            font-weight: 700;

            letter-spacing: 2px;

            margin:
                8px 0;

        }


        .gesbase-llamada-texto {

            color:
                #cbd5e1;

            font-size: 15px;

            margin-bottom: 24px;

        }


        .gesbase-llamada-botones {

            display: flex;

            gap: 12px;

        }


        .gesbase-llamada-botones button {

            flex: 1;

            border: 0;

            border-radius: 15px;

            padding: 15px 10px;

            font-size: 15px;

            font-weight: 700;

            cursor: pointer;

        }


        .gesbase-btn-rechazar {

            background:
                #dc2626;

            color: white;

        }


        .gesbase-btn-aceptar {

            background:
                #16a34a;

            color: white;

        }


        .gesbase-llamada-botones button:active {

            transform:
                scale(.96);

        }

    `;


    document.head.appendChild(
        style
    );
}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(texto) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        texto || "";

    return div.innerHTML;
}


/* ============================================================
   ACTIVAR AUDIO DESPUÉS DE UNA INTERACCIÓN
   ============================================================ */

document.addEventListener(
    "click",
    () => {

        try {

            if (!audioContext) {

                audioContext =
                    new (
                        window.AudioContext ||
                        window.webkitAudioContext
                    )();

            }

            if (
                audioContext.state ===
                "suspended"
            ) {

                audioContext.resume()
                    .catch(() => {});
            }

        } catch (error) {}

    },
    {
        once: false,
        passive: true
    }
);


/* ============================================================
   EXPONER FUNCIONES
   ============================================================ */

window.GESBASE_NOTIFICACIONES = {

    aceptarLlamada,

    rechazarLlamada,

    cerrarLlamadaEntrante,

    detenerTono

};


console.log(
    "[GESBASE] Sistema global de notificaciones cargado."
);
