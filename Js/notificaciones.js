/* ============================================================
   GESBASE
   NOTIFICACIONES + LLAMADAS GLOBALES + FCM
   ============================================================ */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getMessaging,
    getToken,
    onMessage,
    isSupported
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js";

import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    where,
    updateDoc,
    setDoc,
    arrayUnion,
    serverTimestamp
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
   CLAVE PÚBLICA VAPID
   ============================================================ */

const VAPID_KEY =
    "BNZA69HMAMg5SO6SsnkQZuKy9lkPLHnUc525y54u4SuxLUlePyNt9A1pH-NlBGgMZ95taxj7rxJ5h1Vo5w7r9hI";


/* ============================================================
   VARIABLES
   ============================================================ */

let usuarioActual = null;

let empresaActual = null;

let salasEscuchadas =
    new Set();

let llamadaActual = null;

let intervaloContador = null;

let audioLlamada = null;

let audioContext = null;

let oscilador = null;

let gainNode = null;

let messaging = null;

let serviceWorkerRegistro = null;


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

        usuarioActual =
            usuario;

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
            await getDoc(
                usuarioRef
            );

        if (!usuarioSnap.exists()) {

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

        console.warn(
            "[GESBASE] No se pudo determinar empresa."
        );

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

    await prepararFCM();

}


/* ============================================================
   PREPARAR FCM
   ============================================================ */

async function prepararFCM() {

    try {

        console.log(
            "[GESBASE FCM] Preparando Firebase Cloud Messaging..."
        );


        /* ====================================================
           SERVICE WORKER
        ==================================================== */

        if (
            !("serviceWorker" in navigator)
        ) {

            console.warn(
                "[GESBASE FCM] Service Worker no disponible."
            );

            return false;
        }


        /* ====================================================
           COMPATIBILIDAD
        ==================================================== */

        const compatible =
            await isSupported();

        console.log(
            "[GESBASE FCM] Compatible:",
            compatible
        );


        if (!compatible) {

            console.warn(
                "[GESBASE FCM] FCM no es compatible con este navegador."
            );

            return false;
        }


        /* ====================================================
           REGISTRAR SERVICE WORKER
        ==================================================== */

        serviceWorkerRegistro =
            await navigator.serviceWorker.register(
                "/GESBASE/firebase-messaging-sw.js",
                {
                    scope:
                        "/GESBASE/"
                }
            );


        console.log(
            "[GESBASE FCM] Service Worker registrado:",
            serviceWorkerRegistro
        );


        /* ====================================================
           ESPERAR SERVICE WORKER READY
        ==================================================== */

        serviceWorkerRegistro =
            await navigator.serviceWorker.ready;


        console.log(
            "[GESBASE FCM] Service Worker listo."
        );


        /* ====================================================
           OBTENER MESSAGING
        ==================================================== */

        const app =
            getApp();

        messaging =
            getMessaging(app);


        console.log(
            "[GESBASE FCM] Messaging preparado."
        );


        /* ====================================================
           MENSAJES EN PRIMER PLANO
        ==================================================== */

        onMessage(
            messaging,
            payload => {

                console.log(
                    "[GESBASE FCM] Mensaje recibido en primer plano:",
                    payload
                );

                procesarNotificacionFCM(
                    payload
                );

            }
        );


        console.log(
            "[GESBASE FCM] FCM preparado correctamente."
        );

        return true;


    } catch (error) {

        console.error(
            "[GESBASE FCM] Error preparando FCM:",
            error
        );

        return false;
    }
}


/* ============================================================
   ACTIVAR NOTIFICACIONES
   ============================================================ */

async function activarNotificaciones() {

    try {

        console.log(
            "[GESBASE FCM] ========================="
        );

        console.log(
            "[GESBASE FCM] ACTIVANDO NOTIFICACIONES"
        );

        console.log(
            "[GESBASE FCM] ========================="
        );


        /* ====================================================
           USUARIO
        ==================================================== */

        if (!usuarioActual) {

            alert(
                "Primero tenés que iniciar sesión."
            );

            return null;
        }


        console.log(
            "[GESBASE FCM] Usuario:",
            usuarioActual.uid
        );


        /* ====================================================
           PREPARAR FCM SI TODAVÍA NO ESTÁ LISTO
        ==================================================== */

        if (!messaging) {

            const preparado =
                await prepararFCM();

            if (!preparado) {

                alert(
                    "❌ No se pudo preparar Firebase Cloud Messaging."
                );

                return null;
            }
        }


        /* ====================================================
           PERMISO DEL NAVEGADOR
        ==================================================== */

        if (
            !("Notification" in window)
        ) {

            alert(
                "❌ Este navegador no permite notificaciones."
            );

            return null;
        }


        const permiso =
            await Notification.requestPermission();


        console.log(
            "[GESBASE FCM] Permiso:",
            permiso
        );


        if (
            permiso !== "granted"
        ) {

            alert(
                "❌ Las notificaciones no fueron autorizadas.\n\n" +
                "Revisá los permisos de notificaciones de Chrome/GESBASE."
            );

            return null;
        }


        /* ====================================================
           ASEGURAR SERVICE WORKER
        ==================================================== */

        serviceWorkerRegistro =
            await navigator.serviceWorker.ready;


        console.log(
            "[GESBASE FCM] Service Worker listo para obtener token."
        );


        /* ====================================================
           OBTENER TOKEN FCM
        ==================================================== */

        console.log(
            "[GESBASE FCM] Solicitando token FCM..."
        );


        const token =
            await getToken(
                messaging,
                {
                    vapidKey:
                        VAPID_KEY,

                    serviceWorkerRegistration:
                        serviceWorkerRegistro
                }
            );


        if (!token) {

            console.error(
                "[GESBASE FCM] Firebase no devolvió token."
            );

            alert(
                "❌ Firebase no devolvió el token FCM."
            );

            return null;
        }


        console.log(
            "[GESBASE FCM] TOKEN FCM OBTENIDO:"
        );

        console.log(
            token
        );


        /* ====================================================
           GUARDAR TOKEN EN FIRESTORE
        ==================================================== */

        console.log(
            "[GESBASE FCM] Guardando token en Firestore..."
        );


        const usuarioRef =
            doc(
                db,
                "usuarios",
                usuarioActual.uid
            );


        await setDoc(
            usuarioRef,
            {

                fcmTokens:
                    arrayUnion(token),

                fechaActualizacionNotificaciones:
                    serverTimestamp()

            },
            {
                merge: true
            }
        );


        console.log(
            "[GESBASE FCM] TOKEN GUARDADO CORRECTAMENTE."
        );


        /* ====================================================
           GUARDAR ESTADO LOCAL
        ==================================================== */

        localStorage.setItem(
            "gesbaseFCMActivo",
            "true"
        );

        localStorage.setItem(
            "gesbaseFCMToken",
            token
        );


        /* ====================================================
           CONFIRMACIÓN
        ==================================================== */

        alert(
            "✅ NOTIFICACIONES ACTIVADAS\n\n" +
            "Este dispositivo quedó registrado correctamente para recibir mensajes y llamadas de GESBASE."
        );


        return token;


    } catch (error) {

        console.error(
            "[GESBASE FCM] ERROR COMPLETO:",
            error
        );

        console.error(
            "[GESBASE FCM] CÓDIGO:",
            error.code
        );

        console.error(
            "[GESBASE FCM] MENSAJE:",
            error.message
        );


        alert(
            "❌ ERROR ACTIVANDO NOTIFICACIONES\n\n" +
            "Código: " +
            (
                error.code ||
                "desconocido"
            ) +
            "\n\n" +
            "Mensaje:\n" +
            (
                error.message ||
                "Error desconocido"
            )
        );


        return null;
    }
}


/* ============================================================
   PROCESAR FCM EN PRIMER PLANO
   ============================================================ */

function procesarNotificacionFCM(
    payload
) {

    console.log(
        "[GESBASE FCM] Procesando:",
        payload
    );


    const data =
        payload.data || {};

    const notification =
        payload.notification || {};

    const tipo =
        data.tipo || "";


    /* ========================================================
       LLAMADA DE AUDIO
    ======================================================== */

    if (
        tipo === "llamada" ||
        tipo === "audio"
    ) {

        const salaId =
            data.salaId ||
            data.llamadaId;

        if (salaId) {

            console.log(
                "[GESBASE] Llamada de audio:",
                salaId
            );

        }

        return;
    }


    /* ========================================================
       VIDEOLLAMADA
    ======================================================== */

    if (
        tipo === "videollamada" ||
        tipo === "video"
    ) {

        const salaId =
            data.salaId ||
            data.llamadaId;

        if (salaId) {

            console.log(
                "[GESBASE] Videollamada:",
                salaId
            );

        }

        return;
    }


    /* ========================================================
       MENSAJE
    ======================================================== */

    if (
        tipo === "mensaje"
    ) {

        reproducirSonidoMensaje();

        console.log(
            "[GESBASE] Nuevo mensaje:",
            notification.body ||
            data.body ||
            ""
        );

    }

}


/* ============================================================
   SONIDO MENSAJE
   ============================================================ */

function reproducirSonidoMensaje() {

    try {

        const audio =
            new Audio(
                SONIDO_MENSAJE
            );

        audio.volume =
            1;

        audio.play()
            .catch(
                error => {

                    console.warn(
                        "[GESBASE] Sonido bloqueado:",
                        error
                    );

                }
            );

    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo reproducir sonido de mensaje."
        );
    }
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

        audioLlamada.loop =
            true;

        audioLlamada.volume =
            1;

        audioLlamada.preload =
            "auto";

        console.log(
            "[GESBASE] Audio de llamada preparado."
        );

    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo preparar audio:",
            error
        );

    }
}


/* ============================================================
   REPRODUCIR TONO
   ============================================================ */

async function reproducirTono(
    tipo
) {

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

        audio.loop =
            true;

        audio.volume =
            1;

        audioLlamada =
            audio;


        await audio.play();


        console.log(
            "[GESBASE] Tono reproduciéndose."
        );


    } catch (error) {

        console.warn(
            "[GESBASE] El navegador bloqueó el audio:",
            error
        );

        iniciarTonoWebAudio();
    }
}


/* ============================================================
   TONO WEB AUDIO
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
            audioContext.state ===
            "suspended"
        ) {

            audioContext
                .resume()
                .catch(
                    () => {}
                );

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


    } catch (error) {

        console.warn(
            "[GESBASE] Web Audio no disponible."
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


    oscilador =
        null;

    gainNode =
        null;

}


/* ============================================================
   ESCUCHAR LLAMADAS
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


                        if (
                            salasEscuchadas.has(
                                salaId
                            )
                        ) {

                            return;

                        }


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
   ESCUCHAR CAMBIOS DE LLAMADA
   ============================================================ */

function escucharCambiosDeLlamada() {

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
   CREAR VENTANA DE LLAMADA
   ============================================================ */

function crearVentanaLlamada(
    llamada
) {

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


    document
        .getElementById(
            "gesbase-aceptar-llamada"
        )
        .addEventListener(
            "click",
            aceptarLlamada
        );


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


    sessionStorage.setItem(
        "gesbaseSalaLlamada",
        salaId
    );


    cerrarLlamadaEntrante();


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
            "[GESBASE] No se pudo rechazar:",
            error
        );

    }


    cerrarLlamadaEntrante();

}


/* ============================================================
   CERRAR LLAMADA ENTRANTE
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
   ESTILOS GLOBALES
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

function escapeHTML(
    texto
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        texto || "";


    return div.innerHTML;

}


/* ============================================================
   ACTIVAR AUDIO CON INTERACCIÓN
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

                audioContext
                    .resume()
                    .catch(
                        () => {}
                    );

            }

        } catch (error) {}

    },

    {
        once: false,
        passive: true
    }

);


/* ============================================================
   FUNCIONES PÚBLICAS
   ============================================================ */

window.GESBASE_NOTIFICACIONES = {

    aceptarLlamada,

    rechazarLlamada,

    cerrarLlamadaEntrante,

    detenerTono,

    activarNotificaciones

};


console.log(
    "[GESBASE] Sistema global de notificaciones + FCM cargado."
);
