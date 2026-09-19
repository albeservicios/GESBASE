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
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
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

/*
 * IMPORTANTE:
 *
 * No dejamos una VAPID falsa.
 *
 * Si todavía no configuraste la Web Push certificate key
 * de Firebase, el sistema continuará funcionando para
 * detectar llamadas mediante Firestore, pero FCM Push
 * necesitará la VAPID KEY para las notificaciones cuando
 * GESBASE esté en segundo plano.
 */

const VAPID_KEY = "";


let usuarioActual = null;

let empresaIdActual = null;

let audioMensaje = null;

let audioLlamada = null;

let audioVideo = null;

let escuchandoSalas = false;

let salaMostrada = null;


// =========================================================
// INICIAR GESBASE
// =========================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            return;

        }


        usuarioActual = user;


        try {

            empresaIdActual =
                await obtenerEmpresaId(
                    user.uid
                );


            if (!empresaIdActual) {

                console.warn(
                    "[GESBASE] No se encontró empresaId."
                );

                return;

            }


            crearSonidos();


            /*
             * Primero escuchamos las salas.
             *
             * Esto permite detectar una llamada
             * aunque el usuario esté en otra sección
             * de GESBASE.
             */

            escucharLlamadas();


            /*
             * Después intentamos activar FCM.
             */

            await iniciarNotificaciones();


        } catch (error) {

            console.error(
                "[GESBASE] Error iniciando comunicación:",
                error
            );

        }

    }
);


// =========================================================
// OBTENER EMPRESA DEL USUARIO
// =========================================================

async function obtenerEmpresaId(uid) {

    try {

        const usuarioRef =
            doc(
                db,
                "usuarios",
                uid
            );


        const usuarioSnap =
            await getDoc(
                usuarioRef
            );


        if (
            usuarioSnap.exists()
        ) {

            const datos =
                usuarioSnap.data();


            /*
             * Orden de prioridad:
             */

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


    } catch (error) {

        console.error(
            "[GESBASE] Error obteniendo empresa:",
            error
        );

        return null;

    }

}


// =========================================================
// CREAR SONIDOS
// =========================================================

function crearSonidos() {

    try {

        audioMensaje =
            new Audio(
                "./sonidos/mensaje.mp3"
            );


        audioLlamada =
            new Audio(
                "./sonidos/llamada.mp3"
            );


        audioVideo =
            new Audio(
                "./sonidos/videollamada.mp3"
            );


        audioMensaje.volume =
            0.8;


        audioLlamada.volume =
            1;


        audioVideo.volume =
            1;


        /*
         * No hacemos loop permanente todavía.
         * Lo controlaremos en la pantalla de llamada.
         */

        audioMensaje.loop = false;

        audioLlamada.loop = false;

        audioVideo.loop = false;


    } catch (error) {

        console.warn(
            "[GESBASE] No se pudieron preparar los sonidos.",
            error
        );

    }

}


// =========================================================
// FIREBASE CLOUD MESSAGING
// =========================================================

async function iniciarNotificaciones() {

    try {

        const soportado =
            await isSupported();


        if (!soportado) {

            console.warn(
                "[GESBASE] Este navegador no soporta FCM."
            );

            return;

        }


        /*
         * Comprobar permiso.
         */

        let permiso =
            Notification.permission;


        /*
         * No pedimos permiso automáticamente
         * si todavía no fue solicitado.
         *
         * Esto evita que cada página de GESBASE
         * muestre el cartel de permisos.
         */

        if (
            permiso !== "granted"
        ) {

            console.log(
                "[GESBASE] Notificaciones pendientes de autorización."
            );

            return;

        }


        /*
         * Usamos el Service Worker que YA EXISTE.
         */

        const registro =
            await navigator.serviceWorker.register(
                "./firebase-messaging-sw.js"
            );


        console.log(
            "[GESBASE] Service Worker registrado."
        );


        const messaging =
            getMessaging();


        /*
         * Si todavía no tenemos VAPID KEY,
         * no intentamos generar el token.
         */

        if (!VAPID_KEY) {

            console.warn(
                "[GESBASE] Falta configurar VAPID KEY."
            );

            /*
             * Las llamadas mediante Firestore
             * continúan funcionando.
             */

            return;

        }


        /*
         * Obtener token FCM.
         */

        const token =
            await getToken(
                messaging,
                {
                    vapidKey:
                        VAPID_KEY,

                    serviceWorkerRegistration:
                        registro
                }
            );


        if (!token) {

            console.warn(
                "[GESBASE] No se obtuvo token FCM."
            );

            return;

        }


        /*
         * Guardar token.
         */

        await guardarToken(
            token
        );


        /*
         * Mensajes recibidos mientras
         * GESBASE está abierta.
         */

        onMessage(
            messaging,
            (payload) => {

                console.log(
                    "[GESBASE] FCM recibido:",
                    payload
                );


                procesarNotificacion(
                    payload
                );

            }
        );


        console.log(
            "[GESBASE] Notificaciones FCM activadas."
        );


    } catch (error) {

        console.error(
            "[GESBASE] Error FCM:",
            error
        );

    }

}


// =========================================================
// GUARDAR TOKEN FCM
// =========================================================

async function guardarToken(token) {

    if (
        !usuarioActual ||
        !empresaIdActual
    ) {

        return;

    }


    try {

        const referencia =
            doc(
                db,
                "tokensNotificaciones",
                usuarioActual.uid
            );


        await setDoc(
            referencia,
            {

                uid:
                    usuarioActual.uid,

                empresaId:
                    empresaIdActual,

                token:
                    token,

                platform:
                    "web",

                updatedAt:
                    serverTimestamp()

            },

            {
                merge: true
            }

        );


        console.log(
            "[GESBASE] Token guardado."
        );


    } catch (error) {

        console.error(
            "[GESBASE] Error guardando token:",
            error
        );

    }

}


// =========================================================
// PROCESAR NOTIFICACIONES
// =========================================================

function procesarNotificacion(
    payload
) {

    const datos =
        payload.data || {};


    const tipo =
        datos.tipo ||
        datos.type ||
        "mensaje";


    /*
     * -------------------------------------------------------
     * MENSAJE
     * -------------------------------------------------------
     */

    if (
        tipo === "mensaje"
    ) {

        reproducirSonido(
            audioMensaje
        );


        mostrarNotificacionLocal(
            payload.notification?.title ||
            datos.title ||
            "Nuevo mensaje",

            payload.notification?.body ||
            datos.body ||
            "Tenés un nuevo mensaje."
        );


        return;

    }


    /*
     * -------------------------------------------------------
     * LLAMADA
     * -------------------------------------------------------
     */

    if (
        tipo === "llamada"
    ) {

        reproducirSonido(
            audioLlamada
        );


        mostrarLlamadaEntrante(
            datos,
            "audio"
        );


        return;

    }


    /*
     * -------------------------------------------------------
     * VIDEOLLAMADA
     * -------------------------------------------------------
     */

    if (
        tipo === "videollamada" ||
        tipo === "video"
    ) {

        reproducirSonido(
            audioVideo
        );


        mostrarLlamadaEntrante(
            datos,
            "video"
        );


        return;

    }

}


// =========================================================
// ESCUCHAR LLAMADAS EN FIRESTORE
// =========================================================

function escucharLlamadas() {

    if (
        escuchandoSalas
    ) {

        return;

    }


    if (
        !empresaIdActual ||
        !usuarioActual
    ) {

        return;

    }


    escuchandoSalas =
        true;


    console.log(
        "[GESBASE] Escuchando llamadas de empresa:",
        empresaIdActual
    );


    try {

        const salasRef =
            collection(
                db,
                "salas"
            );


        /*
         * Solo salas de la empresa actual
         * y que estén sonando.
         */

        const consulta =
            query(

                salasRef,

                where(
                    "empresaId",
                    "==",
                    empresaIdActual
                ),

                where(
                    "status",
                    "==",
                    "ringing"
                )

            );


        onSnapshot(
            consulta,

            (snapshot) => {

                snapshot.docChanges()
                    .forEach(
                        (change) => {

                            if (
                                change.type !==
                                "added"
                            ) {

                                return;

                            }


                            const sala =
                                change.doc.data();


                            /*
                             * Seguridad:
                             *
                             * La llamada debe incluir
                             * al usuario actual.
                             */

                            if (
                                !Array.isArray(
                                    sala.participants
                                )
                            ) {

                                return;

                            }


                            if (
                                !sala.participants.includes(
                                    usuarioActual.uid
                                )
                            ) {

                                return;

                            }


                            /*
                             * No mostrar nuestra
                             * propia llamada.
                             */

                            if (
                                sala.createdBy ===
                                usuarioActual.uid
                            ) {

                                return;

                            }


                            /*
                             * Evitar duplicados.
                             */

                            if (
                                salaMostrada ===
                                change.doc.id
                            ) {

                                return;

                            }


                            salaMostrada =
                                change.doc.id;


                            const tipo =
                                sala.type ===
                                "video"

                                    ? "video"

                                    : "audio";


                            console.log(
                                "[GESBASE] Llamada entrante:",
                                change.doc.id
                            );


                            if (
                                tipo ===
                                "video"
                            ) {

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

                        }
                    );

            },

            (error) => {

                console.error(
                    "[GESBASE] Error escuchando salas:",
                    error
                );

            }

        );


    } catch (error) {

        console.error(
            "[GESBASE] Error creando escucha:",
            error
        );

    }

}


// =========================================================
// LLAMADA ENTRANTE
// =========================================================

function mostrarLlamadaEntrante(
    datos,
    tipo
) {

    /*
     * Si ya hay una llamada visible,
     * no crear otra ventana.
     */

    if (
        document.getElementById(
            "gesbase-llamada-entrante"
        )
    ) {

        return;

    }


    /*
     * Si no tenemos sala,
     * no podemos contestar.
     */

    if (
        !datos.salaId
    ) {

        console.warn(
            "[GESBASE] Llamada sin salaId."
        );

        return;

    }


    const fondo =
        document.createElement(
            "div"
        );


    fondo.id =
        "gesbase-llamada-entrante";


    fondo.innerHTML = `

        <div class="gesbase-llamada-box">

            <div class="gesbase-llamada-icono">

                ${
                    tipo === "video"
                        ? "📹"
                        : "📞"
                }

            </div>


            <div class="gesbase-llamada-titulo">

                ${
                    tipo === "video"
                        ? "Videollamada entrante"
                        : "Llamada entrante"
                }

            </div>


            <div class="gesbase-llamada-nombre">

                ${escapeHTML(
                    datos.callerName ||
                    "Usuario GESBASE"
                )}

            </div>


            <div class="gesbase-llamada-botones">

                <button
                    type="button"
                    id="gesbase-rechazar"
                    class="gesbase-btn-rechazar">

                    ❌ Rechazar

                </button>


                <button
                    type="button"
                    id="gesbase-aceptar"
                    class="gesbase-btn-aceptar">

                    ${
                        tipo === "video"
                            ? "📹 Aceptar"
                            : "📞 Aceptar"
                    }

                </button>

            </div>

        </div>

    `;


    agregarEstilosLlamada();


    document.body.appendChild(
        fondo
    );


    /*
     * RECHAZAR
     */

    const botonRechazar =
        document.getElementById(
            "gesbase-rechazar"
        );


    if (
        botonRechazar
    ) {

        botonRechazar.onclick =
            () => {

                detenerSonidos();


                fondo.remove();


                salaMostrada =
                    null;

            };

    }


    /*
     * ACEPTAR
     */

    const botonAceptar =
        document.getElementById(
            "gesbase-aceptar"
        );


    if (
        botonAceptar
    ) {

        botonAceptar.onclick =
            () => {

                detenerSonidos();


                const salaId =
                    datos.salaId;


                if (!salaId) {

                    fondo.remove();

                    return;

                }


                /*
                 * La página de llamada
                 * se encargará de WebRTC.
                 */

                const pagina =
                    tipo === "video"

                        ? "videollamada.html"

                        : "llamada.html";


                window.location.href =
                    pagina +
                    "?sala=" +
                    encodeURIComponent(
                        salaId
                    );

            };

    }

}


// =========================================================
// NOTIFICACIÓN LOCAL
// =========================================================

function mostrarNotificacionLocal(
    titulo,
    cuerpo
) {

    try {

        if (
            typeof Notification ===
            "undefined"
        ) {

            return;

        }


        if (
            Notification.permission !==
            "granted"
        ) {

            return;

        }


        /*
         * Evitar mostrar notificación
         * si la página no está disponible.
         */

        new Notification(
            titulo,
            {

                body:
                    cuerpo,

                icon:
                    "/GESBASE/icon-192.png",

                badge:
                    "/GESBASE/icon-192.png"

            }
        );


    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo mostrar notificación.",
            error
        );

    }

}


// =========================================================
// ESTILOS DE LLAMADA
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
        document.createElement(
            "style"
        );


    style.id =
        "gesbase-estilos-llamada";


    style.textContent = `

        #gesbase-llamada-entrante {

            position: fixed;

            inset: 0;

            z-index: 999999;

            background:
                rgba(0, 0, 0, 0.78);

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

            background:
                #111827;

            color:
                white;

            border-radius:
                24px;

            padding:
                30px 20px;

            text-align:
                center;

            box-shadow:
                0 20px 60px
                rgba(0,0,0,.45);

        }


        .gesbase-llamada-icono {

            font-size:
                64px;

            margin-bottom:
                12px;

            animation:
                gesbase-pulso
                1.2s
                infinite;

        }


        .gesbase-llamada-titulo {

            font-size:
                22px;

            font-weight:
                800;

            margin-bottom:
                8px;

        }


        .gesbase-llamada-nombre {

            font-size:
                18px;

            opacity:
                .85;

            margin-bottom:
                28px;

        }


        .gesbase-llamada-botones {

            display:
                flex;

            gap:
                12px;

        }


        .gesbase-llamada-botones button {

            flex:
                1;

            border:
                0;

            border-radius:
                14px;

            padding:
                14px 10px;

            font-size:
                15px;

            font-weight:
                700;

            cursor:
                pointer;

        }


        .gesbase-btn-rechazar {

            background:
                #dc2626;

            color:
                white;

        }


        .gesbase-btn-aceptar {

            background:
                #16a34a;

            color:
                white;

        }


        @keyframes gesbase-pulso {

            0% {

                transform:
                    scale(1);

            }

            50% {

                transform:
                    scale(1.12);

            }

            100% {

                transform:
                    scale(1);

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

function reproducirSonido(
    audio
) {

    if (!audio) {

        return;

    }


    try {

        audio.currentTime =
            0;


        const promesa =
            audio.play();


        if (
            promesa &&
            promesa.catch
        ) {

            promesa.catch(
                () => {

                    console.warn(
                        "[GESBASE] El navegador bloqueó el sonido."
                    );

                }
            );

        }


    } catch (error) {

        console.warn(
            "[GESBASE] No se pudo reproducir el sonido."
        );

    }

}


// =========================================================
// DETENER SONIDOS
// =========================================================

function detenerSonidos() {

    const sonidos = [

        audioMensaje,

        audioLlamada,

        audioVideo

    ];


    sonidos.forEach(
        (audio) => {

            if (!audio) {

                return;

            }


            try {

                audio.pause();

                audio.currentTime =
                    0;

            } catch (error) {

                // Ignorar

            }

        }
    );

}


// =========================================================
// ESCAPAR HTML
// =========================================================

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
