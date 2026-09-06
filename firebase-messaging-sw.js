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
   CONFIGURACIÓN FIREBASE GESBASE
============================================================ */

firebase.initializeApp({

    apiKey:
        "AIzaSyDDCQ7Wh9S8Gy8DwQGZ01VaFTmSgV2rjs9o",

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
   MESSAGING
============================================================ */

const messaging =
    firebase.messaging();


/* ============================================================
   NOTIFICACIÓN EN SEGUNDO PLANO
============================================================ */

messaging.onBackgroundMessage(
    payload => {

        console.log(
            "[GESBASE] Notificación recibida:",
            payload
        );


        const notification =
            payload.notification || {};


        const data =
            payload.data || {};


        let titulo =
            notification.title ||
            data.title ||
            "GESBASE";


        let cuerpo =
            notification.body ||
            data.body ||
            "Tenés una nueva actividad en GESBASE.";


        let icono =
            data.icon ||
            "/GESBASE/icon-192.png";


        const options = {

            body:
                cuerpo,

            icon:
                icono,

            badge:
                icono,

            tag:
                data.tag ||
                "gesbase-notificacion",

            renotify:
                true,

            data:{

                tipo:
                    data.tipo || "",

                usuario:
                    data.usuario || "",

                llamadaId:
                    data.llamadaId || "",

                url:
                    data.url ||
                    "/GESBASE/mensajes.html"

            }

        };


        self.registration.showNotification(
            titulo,
            options
        );

    }
);


/* ============================================================
   CLICK SOBRE LA NOTIFICACIÓN
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
            "/GESBASE/mensajes.html";


        if(
            !data.url &&
            data.usuario
        ){

            url =
                "/GESBASE/mensajes.html?usuario=" +
                encodeURIComponent(
                    data.usuario
                );

        }


        event.waitUntil(

            clients
                .matchAll({
                    type:"window",
                    includeUncontrolled:true
                })
                .then(
                    windowClients => {

                        /*
                         * Si GESBASE ya está abierta,
                         * reutilizamos esa ventana.
                         */

                        for(
                            const client
                            of windowClients
                        ){

                            if(
                                "focus" in client
                            ){

                                client.navigate(
                                    url
                                );

                                return client.focus();

                            }

                        }


                        /*
                         * Si no está abierta,
                         * abrimos GESBASE.
                         */

                        if(
                            clients.openWindow
                        ){

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
    () => {

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

        event.waitUntil(
            self.clients.claim()
        );

    }
);
