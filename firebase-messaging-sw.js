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
        "AIzaSyDDQ7Wh9S8Gy8DwQGZ01VaFTmSgV2rjs9o",

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
   MENSAJES EN SEGUNDO PLANO
============================================================ */

messaging.onBackgroundMessage(
    payload => {

        console.log(
            "[GESBASE] Notificación recibida en segundo plano:",
            payload
        );


        const notification =
            payload.notification || {};

        const data =
            payload.data || {};


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
           CUERPO
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
            data.url ||
            "";


        /* ====================================================
           ID DE SALA
        ==================================================== */

        const salaId =
            data.salaId ||
            data.llamadaId ||
            "";


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


            if (
                !url &&
                salaId
            ) {

                url =
                    "/GESBASE/llamada.html?sala=" +
                    encodeURIComponent(
                        salaId
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


            if (
                !url &&
                salaId
            ) {

                url =
                    "/GESBASE/videollamada.html?sala=" +
                    encodeURIComponent(
                        salaId
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
                    "/GESBASE/comunicacion.html";

            }

        }


        /* ====================================================
           DATOS DE LA NOTIFICACIÓN
        ==================================================== */

        const datosNotificacion = {

            tipo:
                tipo,

            salaId:
                salaId,

            llamadaId:
                data.llamadaId ||
                salaId,

            mensajeId:
                data.mensajeId ||
                "",

            usuario:
                data.usuario ||
                "",

            empresaId:
                data.empresaId ||
                "",

            url:
                url ||
                "/GESBASE/comunicacion.html"

        };


        /* ====================================================
           OPCIONES
        ==================================================== */

        const opciones = {

            body:
                cuerpo,

            icon:
                icono,

            badge:
                icono,

            tag:
                data.tag ||
                (
                    "gesbase-" +
                    tipo +
                    "-" +
                    (
                        salaId ||
                        data.mensajeId ||
                        Date.now()
                    )
                ),

            renotify:
                true,

            requireInteraction:
                (
                    tipo === "llamada" ||
                    tipo === "audio" ||
                    tipo === "videollamada" ||
                    tipo === "video"
                ),

            data:
                datosNotificacion

        };


        /* ====================================================
           MOSTRAR NOTIFICACIÓN
        ==================================================== */

        return self.registration.showNotification(
            titulo,
            opciones
        );

    }
);


/* ============================================================
   CLICK EN NOTIFICACIÓN
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


        const tipo =
            data.tipo ||
            "";


        const salaId =
            data.salaId ||
            data.llamadaId ||
            "";


        /* ====================================================
           LLAMADA
        ==================================================== */

        if (
            (
                tipo === "llamada" ||
                tipo === "audio"
            ) &&
            salaId
        ) {

            url =
                "/GESBASE/llamada.html?sala=" +
                encodeURIComponent(
                    salaId
                );

        }


        /* ====================================================
           VIDEOLLAMADA
        ==================================================== */

        if (
            (
                tipo === "videollamada" ||
                tipo === "video"
            ) &&
            salaId
        ) {

            url =
                "/GESBASE/videollamada.html?sala=" +
                encodeURIComponent(
                    salaId
                );

        }


        /* ====================================================
           MENSAJE
        ==================================================== */

        if (
            tipo === "mensaje"
        ) {

            url =
                data.url ||
                "/GESBASE/comunicacion.html";

        }


        /* ====================================================
           ABRIR GESBASE
        ==================================================== */

        event.waitUntil(

            clients
                .matchAll({

                    type:
                        "window",

                    includeUncontrolled:
                        true

                })

                .then(
                    ventanas => {

                        for (
                            const ventana
                            of ventanas
                        ) {

                            if (
                                "focus" in ventana
                            ) {

                                return ventana
                                    .navigate(url)
                                    .then(
                                        () =>
                                            ventana.focus()
                                    );

                            }

                        }


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


/* ============================================================
   FETCH
   No interceptamos las páginas de GESBASE.
============================================================ */

self.addEventListener(
    "fetch",
    event => {

        /*
         * El Service Worker solamente se utiliza
         * para las notificaciones de Firebase.
         *
         * No modificamos las solicitudes normales
         * de GESBASE.
         */

    }
);


console.log(
    "[GESBASE] Firebase Messaging Service Worker cargado."
);
