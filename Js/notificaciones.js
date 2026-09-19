// =========================================================
// GESBASE - NOTIFICACIONES Y LLAMADAS GLOBALES
// Disponible en todas las secciones de GESBASE
// =========================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    doc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    getMessaging,
    getToken,
    onMessage,
    isSupported
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js";


// =========================================================
// CONFIGURACIÓN
// =========================================================

const VAPID_KEY = "PEGAR_VAPID_KEY";

let usuarioActual = null;
let empresaIdActual = null;

let audioMensaje = null;
let audioLlamada = null;
let audioVideo = null;

let escuchandoSalas = false;


// =========================================================
// INICIAR
// =========================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    usuarioActual = user;

    try {

        empresaIdActual = await obtenerEmpresaId(user.uid);

        if (!empresaIdActual) {
            console.warn("GESBASE: no se encontró empresaId.");
            return;
        }

        crearSonidos();

        await iniciarNotificaciones();

        escucharLlamadas();

    } catch (error) {

        console.error(
            "GESBASE - Error iniciando comunicación:",
            error
        );

    }

});


// =========================================================
// OBTENER EMPRESA
// =========================================================

async function obtenerEmpresaId(uid) {

    const usuarioRef = doc(db, "usuarios", uid);
    const usuarioSnap = await getDoc(usuarioRef);

    if (usuarioSnap.exists()) {

        const datos = usuarioSnap.data();

        if (datos.empresaId) {
            return datos.empresaId;
        }

        if (datos.idEmpresa) {
            return datos.idEmpresa;
        }

        if (datos.empresa) {
            return datos.empresa;
        }
    }

    return null;
}


// =========================================================
// SONIDOS
// =========================================================

function crearSonidos() {

    audioMensaje = new Audio(
        "./sonidos/mensaje.mp3"
    );

    audioLlamada = new Audio(
        "./sonidos/llamada.mp3"
    );

    audioVideo = new Audio(
        "./sonidos/videollamada.mp3"
    );

    audioMensaje.volume = 0.8;
    audioLlamada.volume = 1;
    audioVideo.volume = 1;

}


// =========================================================
// ACTIVAR NOTIFICACIONES
// =========================================================

async function iniciarNotificaciones() {

    try {

        const soportado = await isSupported();

        if (!soportado) {
            console.warn(
                "Este navegador no soporta notificaciones push."
            );
            return;
        }

        const permiso =
            await Notification.requestPermission();

        if (permiso !== "granted") {

            console.warn(
                "El usuario no autorizó las notificaciones."
            );

            return;
        }


        const registro =
            await navigator.serviceWorker.register(
                "./firebase-messaging-sw.js"
            );


        const messaging =
            getMessaging();


        const token =
            await getToken(
                messaging,
                {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registro
                }
            );


        if (!token) {

            console.warn(
                "GESBASE: no se obtuvo token FCM."
            );

            return;
        }


        await guardarToken(token);


        onMessage(
            messaging,
            (payload) => {

                procesarNotificacion(payload);

            }
        );


        console.log(
            "GESBASE: notificaciones activadas."
        );


    } catch (error) {

        console.error(
            "GESBASE - Error FCM:",
            error
        );

    }

}


// =========================================================
// GUARDAR TOKEN
// =========================================================

async function guardarToken(token) {

    const referencia =
        doc(
            db,
            "tokensNotificaciones",
            usuarioActual.uid
        );


    await import(
        "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"
    ).then(async (firebaseFirestore) => {

        await firebaseFirestore.setDoc(
            referencia,
            {
                uid: usuarioActual.uid,
                empresaId: empresaIdActual,
                token: token,
                platform: "web",
                updatedAt:
                    firebaseFirestore.serverTimestamp()
            },
            {
                merge: true
            }
        );

    });

}


// =========================================================
// RECIBIR NOTIFICACIONES CON GESBASE ABIERTO
// =========================================================

function procesarNotificacion(payload) {

    console.log(
        "GESBASE - Notificación:",
        payload
    );


    const datos =
        payload.data || {};

    const tipo =
        datos.type || "mensaje";


    // -----------------------------------------------------
    // MENSAJE
    // -----------------------------------------------------

    if (tipo === "mensaje") {

        reproducirSonido(audioMensaje);

        mostrarNotificacionLocal(
            payload.notification?.title ||
            "Nuevo mensaje",
            payload.notification?.body ||
            "Tenés un nuevo mensaje."
        );

        return;
    }


    // -----------------------------------------------------
    // LLAMADA
    // -----------------------------------------------------

    if (tipo === "llamada") {

        reproducirSonido(audioLlamada);

        mostrarLlamadaEntrante(
            datos,
            "audio"
        );

        return;
    }


    // -----------------------------------------------------
    // VIDEOLLAMADA
    // -----------------------------------------------------

    if (tipo === "videollamada") {

        reproducirSonido(audioVideo);

        mostrarLlamadaEntrante(
            datos,
            "video"
        );

        return;
    }

}


// =========================================================
// ESCUCHAR SALAS DE LLAMADAS
// =========================================================

function escucharLlamadas() {

    if (escuchandoSalas) return;

    escuchandoSalas = true;


    /*
       Esta escucha permite detectar una llamada
       aunque el usuario esté en:

       - Fichaje
       - Presupuestos
       - Trabajos
       - Gastos
       - Clientes
       - Facturas
       - etc.
    */


    const salasRef =
        import(
            "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"
        );


    salasRef.then((firebaseFirestore) => {

        const consulta =
            firebaseFirestore.query(
                firebaseFirestore.collection(
                    db,
                    "salas"
                ),
                firebaseFirestore.where(
                    "empresaId",
                    "==",
                    empresaIdActual
                ),
                firebaseFirestore.where(
                    "status",
                    "==",
                    "ringing"
                )
            );


        onSnapshot(
            consulta,
            (snapshot) => {

                snapshot.docChanges()
                    .forEach((change) => {

                        if (
                            change.type !== "added"
                        ) {
                            return;
                        }


                        const sala =
                            change.doc.data();


                        if (
                            !sala.participants ||
                            !sala.participants.includes(
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


                        const tipo =
                            sala.type === "video"
                                ? "video"
                                : "audio";


                        if (tipo === "video") {

                            reproducirSonido(
                                audioVideo
                            );

                        } else {

                            reproducirSonido(
                                audioLlamada
                            );

                        }


                        mostrarLlamadaEntrante(
                            {
                                salaId:
                                    change.doc.id,

                                callerUid:
                                    sala.createdBy,

                                callerName:
                                    sala.createdByName ||
                                    "Usuario GESBASE",

                                empresaId:
                                    sala.empresaId
                            },
                            tipo
                        );

                    });

            }
        );

    });

}


// =========================================================
// MOSTRAR LLAMADA ENTRANTE
// =========================================================

function mostrarLlamadaEntrante(
    datos,
    tipo
) {

    // Evitar dos ventanas iguales

    if (
        document.getElementById(
            "gesbase-llamada-entrante"
        )
    ) {
        return;
    }


    const fondo =
        document.createElement("div");

    fondo.id =
        "gesbase-llamada-entrante";


    fondo.innerHTML = `

        <div class="gesbase-llamada-box">

            <div class="gesbase-llamada-icono">
                ${tipo === "video" ? "📹" : "📞"}
            </div>

            <div class="gesbase-llamada-titulo">
                ${tipo === "video"
                    ? "Videollamada entrante"
                    : "Llamada entrante"}
            </div>

            <div class="gesbase-llamada-nombre">
                ${escapeHTML(
                    datos.callerName ||
                    "Usuario GESBASE"
                )}
            </div>

            <div class="gesbase-llamada-botones">

                <button
                    id="gesbase-rechazar"
                    class="gesbase-btn-rechazar">
                    ❌ Rechazar
                </button>

                <button
                    id="gesbase-aceptar"
                    class="gesbase-btn-aceptar">
                    ${tipo === "video"
                        ? "📹 Aceptar"
                        : "📞 Aceptar"}
                </button>

            </div>

        </div>
    `;


    agregarEstilosLlamada();


    document.body.appendChild(
        fondo
    );


    document
        .getElementById(
            "gesbase-rechazar"
        )
        .onclick = () => {

            detenerSonidos();

            fondo.remove();

        };


    document
        .getElementById(
            "gesbase-aceptar"
        )
        .onclick = () => {

            detenerSonidos();


            const salaId =
                datos.salaId;


            if (!salaId) {

                fondo.remove();

                return;
            }


            const pagina =
                tipo === "video"
                    ? "videollamada.html"
                    : "llamada.html";


            window.location.href =
                `${pagina}?sala=${encodeURIComponent(
                    salaId
                )}`;

        };

}


// =========================================================
// ESTILOS
// =========================================================

function agregarEstilosLlamada() {

    if (
        document.getElementById(
            "gesbase-estilos-llamada"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");


    style.id =
        "gesbase-estilos-llamada";


    style.textContent = `

        #gesbase-llamada-entrante {

            position: fixed;

            inset: 0;

            z-index: 999999;

            background:
                rgba(0,0,0,.78);

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 20px;

        }


        .gesbase-llamada-box {

            width: min(
                420px,
                100%
            );

            background: #111827;

            color: white;

            border-radius: 24px;

            padding: 30px 20px;

            text-align: center;

            box-shadow:
                0 20px 60px
                rgba(0,0,0,.45);

        }


        .gesbase-llamada-icono {

            font-size: 64px;

            margin-bottom: 12px;

            animation:
                gesbase-pulso
                1.2s
                infinite;

        }


        .gesbase-llamada-titulo {

            font-size: 22px;

            font-weight: 800;

            margin-bottom: 8px;

        }


        .gesbase-llamada-nombre {

            font-size: 18px;

            opacity: .85;

            margin-bottom: 28px;

        }


        .gesbase-llamada-botones {

            display: flex;

            gap: 12px;

        }


        .gesbase-llamada-botones button {

            flex: 1;

            border: 0;

            border-radius: 14px;

            padding: 14px 10px;

            font-size: 15px;

            font-weight: 700;

            cursor: pointer;

        }


        .gesbase-btn-rechazar {

            background: #dc2626;

            color: white;

        }


        .gesbase-btn-aceptar {

            background: #16a34a;

            color: white;

        }


        @keyframes gesbase-pulso {

            0% {
                transform: scale(1);
            }

            50% {
                transform: scale(1.12);
            }

            100% {
                transform: scale(1);
            }

        }

    `;


    document.head.appendChild(
        style
    );

}


// =========================================================
// REPRODUCIR SONIDO
// =========================================================

function reproducirSonido(audio) {

    if (!audio) return;


    try {

        audio.currentTime = 0;

        const promesa =
            audio.play();

        if (
            promesa &&
            promesa.catch
        ) {

            promesa.catch(
                () => {
                    console.warn(
                        "El navegador bloqueó el sonido."
                    );
                }
            );

        }

    } catch (error) {

        console.warn(
            "No se pudo reproducir el sonido."
        );

    }

}


// =========================================================
// DETENER SONIDOS
// =========================================================

function detenerSonidos() {

    [
        audioMensaje,
        audioLlamada,
        audioVideo
    ].forEach(
        (audio) => {

            if (!audio) return;

            audio.pause();

            audio.currentTime = 0;

        }
    );

}


// =========================================================
// SEGURIDAD HTML
// =========================================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text || "";

    return div.innerHTML;

}
