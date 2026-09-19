/* ============================================================
   GESBASE
   Firebase Cloud Messaging - Service Worker

   Ubicación:
   /GESBASE/firebase-messaging-sw.js
============================================================ */


/* ============================================================
   FIREBASE
============================================================ */

importScripts(
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js"
);


/* ============================================================
   CONFIGURACIÓN FIREBASE
============================================================ */

firebase.initializeApp({

    apiKey:
        "AIzaSyDDCQ7WhS9G8Dw8QGZ01VaFTmSgV2rjs9o",

    authDomain:
        "gesbase-4bf94.firebaseapp.com",

    projectId:
        "gesbase-4bf94",

    storageBucket:
        "gesbase-4bf94.firebasestorage.app",

    messagingSenderId:
        "64959788774",

    appId:
        "1:64959788774:web:c3bc129c3cee8cb77d6503",

    measurementId:
        "G-CCKGSRVGEX"

});


/* ============================================================
   FIREBASE MESSAGING
============================================================ */

const messaging =
    firebase.messaging();


/* ============================================================
   NOTIFICACIONES EN SEGUNDO PLANO
============================================================ */

messaging.onBackgroundMessage(
    payload => {

        console.log(
            "[GESBASE] Push recibida:",
            payload
        );


        const notification =
            payload.notification || {};


        const data =
            payload.data || {};


        /* ====================================================
           TIPO DE NOTIFICACIÓN
        ==================================================== */

        const tipo =
            data.tipo || "notificacion";


        /* ====================================================
           TÍTULO
        ==================================================== */

        let titulo =
            notification.title ||
            data.title ||
            "GESBASE";


        /* ====================================================
           MENSAJE
        ==================================================== */

        let cuerpo =
            notification.body ||
            data.body ||
            "Tenés una nueva actividad en GESBASE.";


        /* ====================================================
           ICONO
        ==================================================== */

        const icono =
            data.icon ||
            "/GESBASE/icon-192.png";


        /* ====================================================
           URL
        ==================================================== */

        let url =
            data.url || "";


        /* ====================================================
           LLAMADA DE AUDIO
        ==================================================== */

        if (
            tipo === "llamada" ||
            tipo === "audio"
        ) {

            titulo =
                notification.title ||
                data.title ||
                "📞 Llamada entrante";

            cuerpo =
                notification.body ||
                data.body ||
                "Tenés una llamada entrante.";

            if (!url && data.llamadaId) {

                url =
                    "/GESBASE/llamada.html?sala=" +
                    encodeURIComponent(
                        data.llamadaId
                    );

            }

        }


        /* ====================================================
           VIDEOLLAMADA
        ==================================================== */

        if (
            tipo === "videollamada" ||
            tipo === "video"
        ) {

            titulo =
                notification.title ||
                data.title ||
                "📹 Videollamada entrante";

            cuerpo =
                notification.body ||
                data.body ||
                "Tenés una videollamada entrante.";

            if (!url && data.llamadaId) {

                url =
                    "/GESBASE/videollamada.html?sala=" +
                    encodeURIComponent(
                        data.llamadaId
                    );

            }

        }


        /* ====================================================
           MENSAJE
        ==================================================== */

        if (
            tipo === "mensaje"
        ) {

            titulo =
                notification.title ||
                data.title ||
                "💬 Nuevo mensaje";

            cuerpo =
                notification.body ||
                data.body ||
                "Tenés un nuevo mensaje.";

            if (!url) {

                url =
                    "/GESBASE/chat.html";

            }

        }


        /* ====================================================
           OPCIONES DE NOTIFICACIÓN
        ==================================================== */

        const options = {

            body:
                cuerpo,

            icon:
                icono,

            badge:
                icono,

            tag:
                data.tag ||
                "gesbase-" + tipo,

            renotify:
                true,

            requireInteraction:
                tipo === "llamada" ||
                tipo === "audio" ||
                tipo === "videollamada" ||
                tipo === "video",

            data: {

                tipo:
                    tipo,

                usuario:
                    data.usuario ||
                    "",

                llamadaId:
                    data.llamadaId ||
                    "",

                mensajeId:
                    data.mensajeId ||
                    "",

                empresaId:
                    data.empresaId ||
                    "",

                url:
                    url ||
                    "/GESBASE/comunicacion.html"

            }

        };


        /* ====================================================
           MOSTRAR NOTIFICACIÓN
        ==================================================== */

        self.registration.showNotification(
            titulo,
            options
        );

    }
);


/* ============================================================
   CLICK EN UNA NOTIFICACIÓN
============================================================ */

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        const data =
            event.notification.data ||
            {};


        let url =
            data.url ||
            "/GESBASE/comunicacion.html";


        /* ====================================================
           SI ES LLAMADA DE AUDIO
        ==================================================== */

        if (
            (
                data.tipo === "llamada" ||
                data.tipo === "audio"
            ) &&
            data.llamadaId
        ) {

            url =
                "/GESBASE/llamada.html?sala=" +
                encodeURIComponent(
                    data.llamadaId
                );

        }


        /* ====================================================
           SI ES VIDEOLLAMADA
        ==================================================== */

        if (
            (
                data.tipo === "videollamada" ||
                data.tipo === "video"
            ) &&
            data.llamadaId
        ) {

            url =
                "/GESBASE/videollamada.html?sala=" +
                encodeURIComponent(
                    data.llamadaId
                );

        }


        /* ====================================================
           SI ES MENSAJE
        ==================================================== */

        if (
            data.tipo === "mensaje"
        ) {

            url =
                data.url ||
                "/GESBASE/chat.html";

        }


        /* ====================================================
           ABRIR O REUTILIZAR GESBASE
        ==================================================== */

        event.waitUntil(

            clients
                .matchAll({
                    type: "window",
                    includeUncontrolled: true
                })
                .then(
                    windowClients => {

                        /* ------------------------------------
                           BUSCAR UNA VENTANA DE GESBASE
                        ------------------------------------ */

                        for (
                            const client
                            of windowClients
                        ) {

                            if (
                                "focus" in client
                            ) {

                                client.navigate(
                                    url
                                );

                                return client.focus();

                            }

                        }


                        /* ------------------------------------
                           SI NO HAY VENTANA ABIERTA
                        ------------------------------------ */

                        if (
                            clients.openWindow
                        ) {

                            return clients.openWindow(
                                url
                            );

                        }

                    }
                )

        );

    }
);


/* ============================================================
   INSTALACIÓN
============================================================ */

self.addEventListener(
    "install",
    event => {

        console.log(
            "[GESBASE] Service Worker instalado."
        );

        self.skipWaiting();

    }
);


/* ============================================================
   ACTIVACIÓN
============================================================ */

self.addEventListener(
    "activate",
    event => {

        console.log(
            "[GESBASE] Service Worker activado."
        );

        event.waitUntil(
            self.clients.claim()
        );

    }
);
