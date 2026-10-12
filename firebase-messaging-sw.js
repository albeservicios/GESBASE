/* ============================================================
   GESBASE
   Service Worker de notificaciones push (Web Push estándar)

   Ubicación:
   /firebase-messaging-sw.js

   Recibe eventos "push" con payload JSON:
   {
     "title": "...", "body": "...",
     "data": { "tipo": "...", "url": "...", "salaId": "...", ... }
   }
   (también acepta el formato notification/data de FCM)
============================================================ */


/* ============================================================
   CONSTRUIR NOTIFICACIÓN DESDE PAYLOAD
============================================================ */

function construirNotificacion(payload) {

    const notification =
        payload.notification || {};

    const data =
        payload.data || payload || {};

    const tipo =
        data.tipo || "notificacion";

    let titulo =
        payload.title ||
        notification.title ||
        data.title ||
        "GESBASE";

    let cuerpo =
        payload.body ||
        notification.body ||
        data.body ||
        "Tenés una nueva actividad en GESBASE.";

    const icono =
        data.icon ||
        "/icon-192.png";

    let url =
        data.url ||
        "";

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

        if (!url && salaId) {
            url =
                "/llamada.html?sala=" +
                encodeURIComponent(salaId);
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

        if (!url && salaId) {
            url =
                "/videollamada.html?sala=" +
                encodeURIComponent(salaId);
        }

    }


    /* ====================================================
       MENSAJE
    ==================================================== */

    if (tipo === "mensaje") {

        titulo =
            notification.title ||
            data.title ||
            "💬 Nuevo mensaje";

        cuerpo =
            notification.body ||
            data.body ||
            "Tenés un nuevo mensaje.";

        if (!url) {
            url = "/comunicacion.html";
        }

    }


    /* ====================================================
       NUEVO REGISTRO DE EMPRESA
    ==================================================== */

    if (
        tipo === "nuevo_registro" ||
        tipo === "NUEVO_REGISTRO" ||
        tipo === "registro_empresa"
    ) {

        titulo =
            notification.title ||
            data.title ||
            "🔔 Nuevo registro en GESBASE";

        cuerpo =
            notification.body ||
            data.body ||
            "Una empresa solicitó acceso a GESBASE.";

        if (!url) {
            url = "/solicitudes-acceso.html";
        }

    }


    const datosNotificacion = {
        tipo: tipo,
        salaId: salaId,
        llamadaId: data.llamadaId || salaId,
        mensajeId: data.mensajeId || "",
        usuario: data.usuario || "",
        empresaId: data.empresaId || "",
        solicitudId: data.solicitudId || "",
        nombreEmpresa: data.nombreEmpresa || "",
        url: url || "/comunicacion.html"
    };


    const opciones = {
        body: cuerpo,
        icon: icono,
        badge: icono,
        tag:
            data.tag ||
            (
                "gesbase-" + tipo + "-" +
                (
                    salaId ||
                    data.mensajeId ||
                    data.solicitudId ||
                    Date.now()
                )
            ),
        renotify: true,
        requireInteraction:
            [
                "llamada", "audio",
                "videollamada", "video",
                "nuevo_registro", "NUEVO_REGISTRO",
                "registro_empresa"
            ].includes(tipo),
        data: datosNotificacion
    };

    return { titulo, opciones };
}


/* ============================================================
   EVENTO PUSH (Web Push estándar)
============================================================ */

self.addEventListener(
    "push",
    event => {

        let payload = {};

        try {
            payload = event.data ? event.data.json() : {};
        } catch {
            try {
                payload = {
                    body: event.data ? event.data.text() : ""
                };
            } catch {
                payload = {};
            }
        }

        const { titulo, opciones } =
            construirNotificacion(payload);

        event.waitUntil(
            self.registration.showNotification(
                titulo,
                opciones
            )
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
            event.notification.data || {};

        let url =
            data.url || "/comunicacion.html";

        const tipo = data.tipo || "";

        const salaId =
            data.salaId || data.llamadaId || "";


        if (
            (tipo === "llamada" || tipo === "audio") &&
            salaId
        ) {
            url =
                "/llamada.html?sala=" +
                encodeURIComponent(salaId);
        }

        if (
            (tipo === "videollamada" || tipo === "video") &&
            salaId
        ) {
            url =
                "/videollamada.html?sala=" +
                encodeURIComponent(salaId);
        }

        if (tipo === "mensaje") {
            url = data.url || "/comunicacion.html";
        }

        if (
            tipo === "nuevo_registro" ||
            tipo === "NUEVO_REGISTRO" ||
            tipo === "registro_empresa"
        ) {
            url = data.url || "/solicitudes-acceso.html";
        }


        event.waitUntil(

            clients
                .matchAll({
                    type: "window",
                    includeUncontrolled: true
                })
                .then(ventanas => {

                    for (const ventana of ventanas) {
                        if ("focus" in ventana) {
                            return ventana
                                .navigate(url)
                                .then(() => ventana.focus());
                        }
                    }

                    if (clients.openWindow) {
                        return clients.openWindow(url);
                    }

                })

        );

    }
);


/* ============================================================
   INSTALACIÓN / ACTIVACIÓN / FETCH
============================================================ */

self.addEventListener(
    "install",
    event => {
        self.skipWaiting();
    }
);

self.addEventListener(
    "activate",
    event => {
        event.waitUntil(self.clients.claim());
    }
);

self.addEventListener(
    "fetch",
    event => {
        /*
         * El Service Worker solamente se utiliza
         * para las notificaciones push.
         */
    }
);
