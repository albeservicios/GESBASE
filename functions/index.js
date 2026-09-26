// ============================================================
// GESBASE - FIREBASE CLOUD FUNCTIONS
// ============================================================

// ============================================================
// IMPORTS
// ============================================================

const {
    onDocumentCreated
} = require("firebase-functions/v2/firestore");

const {
    defineSecret
} = require("firebase-functions/params");

const {
    setGlobalOptions
} = require("firebase-functions/v2");

const admin =
    require("firebase-admin");

const {
    getFirestore,
    FieldValue
} = require("firebase-admin/firestore");

const {
    getMessaging
} = require("firebase-admin/messaging");

const {
    Resend
} = require("resend");

const twilio =
    require("twilio");


// ============================================================
// FIREBASE ADMIN
// ============================================================

if (!admin.apps.length) {
    admin.initializeApp();
}

const db =
    getFirestore();


// ============================================================
// REGIÓN
// ============================================================

const REGION =
    "us-central1";


// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

setGlobalOptions({
    region: REGION,
    maxInstances: 10
});


// ============================================================
// SECRETOS
// ============================================================

const TWILIO_ACCOUNT_SID =
    defineSecret("TWILIO_ACCOUNT_SID");

const TWILIO_AUTH_TOKEN =
    defineSecret("TWILIO_AUTH_TOKEN");

const TWILIO_PHONE_NUMBER =
    defineSecret("TWILIO_PHONE_NUMBER");

const RESEND_API_KEY =
    defineSecret("RESEND_API_KEY");

const RESEND_FROM_EMAIL =
    defineSecret("RESEND_FROM_EMAIL");


// ============================================================
// OBTENER USUARIO
// ============================================================

async function obtenerUsuario(uid) {

    if (!uid) {
        return null;
    }

    try {

        const ref =
            db
                .collection("usuarios")
                .doc(uid);

        const snap =
            await ref.get();

        if (!snap.exists) {
            return null;
        }

        return {
            uid: uid,
            ...snap.data()
        };

    } catch (error) {

        console.error(
            "❌ Error obteniendo usuario:",
            error
        );

        return null;
    }
}


// ============================================================
// OBTENER NOMBRE DE USUARIO
// ============================================================

async function obtenerNombreUsuario(uid) {

    try {

        const usuario =
            await obtenerUsuario(uid);

        if (!usuario) {
            return "Usuario GESBASE";
        }

        const nombre =
            [
                usuario.nombre,
                usuario.apellido
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

        return (
            nombre ||
            usuario.displayName ||
            usuario.email ||
            "Usuario GESBASE"
        );

    } catch (error) {

        console.error(
            "❌ Error obteniendo nombre:",
            error
        );

        return "Usuario GESBASE";
    }
}


// ============================================================
// OBTENER TOKENS FCM
// ============================================================
//
// El sistema acepta:
// 1. usuario.tokens
// 2. usuario.fcmTokens
// 3. subcolección usuarios/{uid}/tokens
//
// ============================================================

async function obtenerTokensUsuario(uid) {

    const tokens =
        new Set();

    try {

        const usuario =
            await obtenerUsuario(uid);

        if (usuario) {

            if (
                Array.isArray(
                    usuario.tokens
                )
            ) {

                usuario.tokens.forEach(
                    token => {

                        if (
                            typeof token === "string" &&
                            token.trim()
                        ) {

                            tokens.add(
                                token.trim()
                            );

                        }

                    }
                );

            }

            if (
                Array.isArray(
                    usuario.fcmTokens
                )
            ) {

                usuario.fcmTokens.forEach(
                    token => {

                        if (
                            typeof token === "string" &&
                            token.trim()
                        ) {

                            tokens.add(
                                token.trim()
                            );

                        }

                    }
                );

            }

        }


        // =====================================================
        // SUBCOLECCIÓN DE TOKENS
        // =====================================================

        const tokensSnap =
            await db
                .collection("usuarios")
                .doc(uid)
                .collection("tokens")
                .get();

        tokensSnap.forEach(
            doc => {

                const data =
                    doc.data() || {};

                const token =
                    data.token ||
                    data.fcmToken ||
                    doc.id;

                if (
                    typeof token === "string" &&
                    token.trim()
                ) {

                    tokens.add(
                        token.trim()
                    );

                }

            }
        );

    } catch (error) {

        console.error(
            "❌ Error obteniendo tokens:",
            error
        );

    }

    return [
        ...tokens
    ];
}


// ============================================================
// ELIMINAR TOKENS INVÁLIDOS
// ============================================================

async function eliminarTokensInvalidos(
    uid,
    tokensInvalidos,
    errorOriginal
) {

    if (
        !uid ||
        !Array.isArray(tokensInvalidos)
    ) {
        return;
    }

    try {

        const usuarioRef =
            db
                .collection("usuarios")
                .doc(uid);

        const usuarioSnap =
            await usuarioRef.get();

        if (
            usuarioSnap.exists
        ) {

            const data =
                usuarioSnap.data() || {};

            // ================================================
            // ARRAY tokens
            // ================================================

            if (
                Array.isArray(
                    data.tokens
                )
            ) {

                const tokensLimpios =
                    data.tokens.filter(
                        token =>
                            !tokensInvalidos.includes(
                                token
                            )
                    );

                await usuarioRef.update({
                    tokens: tokensLimpios
                });

            }

            // ================================================
            // ARRAY fcmTokens
            // ================================================

            if (
                Array.isArray(
                    data.fcmTokens
                )
            ) {

                const tokensLimpios =
                    data.fcmTokens.filter(
                        token =>
                            !tokensInvalidos.includes(
                                token
                            )
                    );

                await usuarioRef.update({
                    fcmTokens: tokensLimpios
                });

            }

        }


        // =====================================================
        // SUBCOLECCIÓN
        // =====================================================

        for (
            const token
            of tokensInvalidos
        ) {

            const tokensSnap =
                await db
                    .collection("usuarios")
                    .doc(uid)
                    .collection("tokens")
                    .where(
                        "token",
                        "==",
                        token
                    )
                    .get();

            for (
                const doc
                of tokensSnap.docs
            ) {

                await doc.ref.delete();

            }

        }

    } catch (error) {

        console.error(
            "❌ Error eliminando tokens inválidos:",
            error
        );

    }
}


// ============================================================
// 📲 ENVÍO DE NOTIFICACIONES PUSH
// ============================================================

async function enviarPush({
    uidDestino,
    titulo,
    cuerpo,
    tipo,
    usuario,
    mensajeId,
    llamadaId,
    url
}) {

    try {

        if (!uidDestino) {

            console.warn(
                "❌ Push sin uidDestino"
            );

            return;

        }


        // =====================================================
        // USUARIO DESTINO
        // =====================================================

        const usuarioDestino =
            await obtenerUsuario(
                uidDestino
            );

        if (!usuarioDestino) {

            console.warn(
                "❌ Usuario destino no encontrado:",
                uidDestino
            );

            return;

        }


        // =====================================================
        // TOKENS
        // =====================================================

        const tokens =
            await obtenerTokensUsuario(
                uidDestino
            );

        if (
            !Array.isArray(tokens) ||
            tokens.length === 0
        ) {

            console.log(
                "ℹ️ Usuario sin tokens FCM:",
                uidDestino
            );

            return;

        }


        // =====================================================
        // DATOS
        // =====================================================

        const datos = {

            tipo:
                String(
                    tipo ||
                    "mensaje"
                ),

            titulo:
                String(
                    titulo ||
                    "GESBASE"
                ),

            cuerpo:
                String(
                    cuerpo ||
                    ""
                ),

            usuario:
                String(
                    usuario ||
                    ""
                ),

            mensajeId:
                String(
                    mensajeId ||
                    ""
                ),

            llamadaId:
                String(
                    llamadaId ||
                    ""
                ),

            salaId:
                String(
                    llamadaId ||
                    ""
                ),

            url:
                String(
                    url ||
                    "/GESBASE/comunicacion.html"
                )

        };


        // =====================================================
        // ENVIAR
        // =====================================================

        for (
            const token
            of tokens
        ) {

            if (!token) {
                continue;
            }

            try {

                await getMessaging().send({

                    token: token,

                    data: datos,

                    webpush: {

                        headers: {

                            Urgency:
                                (
                                    tipo === "llamada" ||
                                    tipo === "videollamada"
                                )
                                    ? "high"
                                    : "normal"

                        }

                    }

                });

                console.log(
                    "✅ Push enviado:",
                    uidDestino
                );

            } catch (error) {

                console.error(
                    "❌ Error enviando push:",
                    error
                );

                const codigo =
                    String(
                        error?.code ||
                        ""
                    );

                if (

                    codigo.includes(
                        "registration-token-not-registered"
                    )

                    ||

                    codigo.includes(
                        "invalid-registration-token"
                    )

                ) {

                    try {

                        await eliminarTokensInvalidos(
                            uidDestino,
                            [token],
                            error
                        );

                    } catch (
                        errorEliminar
                    ) {

                        console.error(
                            "❌ Error eliminando token:",
                            errorEliminar
                        );

                    }

                }

            }

        }

    } catch (error) {

        console.error(
            "❌ ERROR GENERAL EN enviarPush:",
            error
        );

    }

}


// ============================================================
// 📞 🎥 NOTIFICACIÓN DE LLAMADA
// ============================================================

exports.notificarLlamada =
    onDocumentCreated(

        {
            document:
                "salas/{salaId}",

            region:
                REGION
        },

        async event => {

            const snapshot =
                event.data;

            if (!snapshot) {
                return;
            }

            const sala =
                snapshot.data();

            if (!sala) {
                return;
            }


            // =================================================
            // SOLO LLAMADAS
            // =================================================

            const tipo =
                sala.type || "";

            if (

                tipo !== "audio" &&
                tipo !== "video" &&
                tipo !== "llamada" &&
                tipo !== "videollamada"

            ) {

                return;

            }


            // =================================================
            // SOLO RINGING
            // =================================================

            if (
                sala.status !== "ringing"
            ) {

                return;

            }


            // =================================================
            // EMPRESA
            // =================================================

            const empresaId =
                String(
                    sala.empresaId ||
                    ""
                ).trim();

            if (!empresaId) {

                console.log(
                    "Sala sin empresaId:",
                    snapshot.id
                );

                return;

            }


            // =================================================
            // CREADOR
            // =================================================

            const creador =
                sala.createdBy;

            if (!creador) {

                console.log(
                    "Sala sin createdBy:",
                    snapshot.id
                );

                return;

            }


            // =================================================
            // PARTICIPANTES
            // =================================================

            const participantes =
                Array.isArray(
                    sala.participants
                )
                    ? sala.participants
                    : [];

            if (
                participantes.length < 2
            ) {

                console.log(
                    "Sala sin suficientes participantes:",
                    snapshot.id
                );

                return;

            }


            // =================================================
            // DESTINATARIOS
            // =================================================

            const destinatarios =
                participantes.filter(
                    uid =>
                        uid &&
                        uid !== creador
                );

            if (
                !destinatarios.length
            ) {

                return;

            }


            // =================================================
            // NOMBRE
            // =================================================

            const nombreCaller =
                sala.createdByName ||
                await obtenerNombreUsuario(
                    creador
                );


            // =================================================
            // TIPO
            // =================================================

            const esVideo =
                tipo === "video" ||
                tipo === "videollamada";

            const titulo =
                esVideo
                    ? "🎥 Videollamada entrante"
                    : "📞 Llamada entrante";

            const cuerpo =
                esVideo
                    ? `${nombreCaller} te está llamando por videollamada.`
                    : `${nombreCaller} te está llamando.`;


            // =================================================
            // URL
            // =================================================

            const url =
                esVideo

                    ? `/GESBASE/videollamada.html?sala=${encodeURIComponent(
                        snapshot.id
                    )}`

                    : `/GESBASE/llamada.html?sala=${encodeURIComponent(
                        snapshot.id
                    )}`;


            // =================================================
            // ENVIAR
            // =================================================

            for (
                const uidDestino
                of destinatarios
            ) {

                const usuarioDestino =
                    await obtenerUsuario(
                        uidDestino
                    );

                if (!usuarioDestino) {

                    console.log(
                        "Usuario destinatario no encontrado:",
                        uidDestino
                    );

                    continue;

                }

                const empresaDestino =
                    String(
                        usuarioDestino.empresaId ||
                        usuarioDestino.idEmpresa ||
                        usuarioDestino.empresa ||
                        ""
                    ).trim();

                if (
                    empresaDestino !==
                    empresaId
                ) {

                    console.warn(
                        "Push bloqueado por empresa diferente:",
                        uidDestino
                    );

                    continue;

                }


                await enviarPush({

                    uidDestino:
                        uidDestino,

                    titulo:
                        titulo,

                    cuerpo:
                        cuerpo,

                    tipo:
                        esVideo
                            ? "videollamada"
                            : "llamada",

                    usuario:
                        creador,

                    llamadaId:
                        snapshot.id,

                    url:
                        url

                });

            }

        }

    );


// ============================================================
// 🏠 NORMALIZAR TELÉFONO
// ============================================================

function normalizarTelefono(
    telefono
) {

    if (!telefono) {
        return "";
    }

    let numero =
        String(
            telefono
        )
            .trim()
            .replace(
                /[\s().-]/g,
                ""
            );

    if (!numero) {
        return "";
    }


    // Ya internacional
    if (
        numero.startsWith("+")
    ) {

        return numero;

    }


    // Argentina
    if (
        numero.startsWith("54")
    ) {

        return "+" + numero;

    }


    // Eliminar 0 inicial
    if (
        numero.startsWith("0")
    ) {

        numero =
            numero.substring(1);

    }


    // Números argentinos
    if (
        numero.length === 10
    ) {

        return "+549" + numero;

    }


    return "+54" + numero;
}


// ============================================================
// 🔐 ESCAPAR HTML
// ============================================================

function escaparHTML(
    texto
) {

    return String(
        texto || ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// 📧 CONSTRUIR EMAIL
// ============================================================

function construirEmailSolicitudAprobada({
    nombre,
    solicitudId
}) {

    const nombreSeguro =
        escaparHTML(
            nombre ||
            "Cliente"
        );

    const idSeguro =
        escaparHTML(
            solicitudId ||
            ""
        );

    return `

<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
>

<title>
Solicitud aprobada - GESBASE
</title>

</head>

<body
style="
margin:0;
padding:0;
background:#f3f4f6;
font-family:Arial,sans-serif;
color:#111827;
"
>

<div
style="
max-width:600px;
margin:30px auto;
background:#ffffff;
border-radius:16px;
padding:30px;
"
>

<h1
style="
margin-top:0;
"
>
🏠 Solicitud aprobada
</h1>

<p>
Hola <strong>${nombreSeguro}</strong>.
</p>

<p>
Tu solicitud de alquiler fue
<strong>aprobada</strong>.
</p>

<p>
GESBASE registró correctamente
la aprobación de tu solicitud.
</p>

<div
style="
margin:25px 0;
padding:15px;
background:#f9fafb;
border-radius:10px;
"
>

<strong>
Número de solicitud:
</strong>

<br>

${idSeguro}

</div>

<p>
La empresa se pondrá en contacto
con vos para continuar con la
reserva y los detalles del alquiler.
</p>

<hr>

<p
style="
font-size:13px;
color:#6b7280;
"
>

Mensaje automático enviado por GESBASE.

</p>

</div>

</body>

</html>

`;

}


// ============================================================
// 📱 ENVIAR SMS
// ============================================================

async function enviarSMSAlquiler({
    nombre,
    telefono,
    solicitudId
}) {

    const numero =
        normalizarTelefono(
            telefono
        );

    if (!numero) {

        throw new Error(
            "El cliente no tiene un número de teléfono válido."
        );

    }


    const sid =
        TWILIO_ACCOUNT_SID.value();

    const token =
        TWILIO_AUTH_TOKEN.value();

    const from =
        TWILIO_PHONE_NUMBER.value();

    if (
        !sid ||
        !token ||
        !from
    ) {

        throw new Error(
            "Faltan las credenciales de Twilio."
        );

    }


    const client =
        twilio(
            sid,
            token
        );


    const mensaje =
        `GESBASE: Hola ${nombre || "cliente"}. Tu solicitud de alquiler fue aprobada. Solicitud: ${solicitudId}. La empresa se pondrá en contacto para continuar.`;

    const resultado =
        await client.messages.create({

            body:
                mensaje,

            from:
                from,

            to:
                numero

        });


    return {

        messageId:
            resultado.sid,

        telefono:
            numero,

        estadoProveedor:
            resultado.status || ""

    };

}


// ============================================================
// 📧 ENVIAR EMAIL
// ============================================================

async function enviarEmailAlquiler({
    nombre,
    email,
    solicitudId
}) {

    if (!email) {

        throw new Error(
            "El cliente no tiene un email."
        );

    }


    const apiKey =
        RESEND_API_KEY.value();

    const from =
        RESEND_FROM_EMAIL.value();

    if (
        !apiKey ||
        !from
    ) {

        throw new Error(
            "Faltan las credenciales de Resend."
        );

    }


    const resend =
        new Resend(
            apiKey
        );


    const resultado =
        await resend.emails.send({

            from:
                from,

            to:
                [email],

            subject:
                "🏠 Solicitud de alquiler aprobada - GESBASE",

            html:
                construirEmailSolicitudAprobada({

                    nombre:
                        nombre,

                    solicitudId:
                        solicitudId

                })

        });


    if (
        resultado?.error
    ) {

        throw new Error(
            resultado.error.message ||
            "Resend informó un error."
        );

    }


    return {

        messageId:
            resultado?.data?.id ||
            "",

        email:
            email

    };

}


// ============================================================
// 🏠 PROCESAR NOTIFICACIÓN DE ALQUILER
//
// ESCUCHA:
// notificacionesAlquiler/{notificacionId}
// ============================================================

exports.procesarNotificacionAlquiler =
    onDocumentCreated(

        {

            document:
                "notificacionesAlquiler/{notificacionId}",

            region:
                REGION,

            secrets: [

                TWILIO_ACCOUNT_SID,
                TWILIO_AUTH_TOKEN,
                TWILIO_PHONE_NUMBER,

                RESEND_API_KEY,
                RESEND_FROM_EMAIL

            ]

        },

        async event => {

            const snapshot =
                event.data;

            if (!snapshot) {
                return;
            }


            const ref =
                snapshot.ref;


            const data =
                snapshot.data() || {};


            // =================================================
            // SOLO SOLICITUDES APROBADAS
            // =================================================

            if (
                data.tipo !==
                "solicitud_aprobada"
            ) {

                return;

            }


            // =================================================
            // EVITAR PROCESAR DOS VECES
            // =================================================

            let procesar = false;

            await db.runTransaction(
                async transaction => {

                    const actual =
                        await transaction.get(
                            ref
                        );

                    if (!actual.exists) {
                        return;
                    }

                    const actualData =
                        actual.data() || {};

                    const estado =
                        actualData.estadoGeneral ||
                        "pendiente";

                    if (
                        estado === "enviado"
                    ) {

                        return;

                    }

                    if (
                        estado === "parcial"
                    ) {

                        return;

                    }

                    if (
                        estado === "enviando"
                    ) {

                        return;

                    }


                    transaction.update(
                        ref,
                        {

                            estadoGeneral:
                                "enviando",

                            iniciadoEn:
                                FieldValue.serverTimestamp(),

                            actualizadoEn:
                                FieldValue.serverTimestamp()

                        }
                    );

                    procesar = true;

                }
            );


            if (!procesar) {

                console.log(
                    "ℹ️ Notificación ya procesada o en proceso:",
                    snapshot.id
                );

                return;

            }


            // =================================================
            // DESTINATARIO
            // =================================================

            const destinatario =
                data.destinatario ||
                {};

            const nombre =
                String(
                    destinatario.nombre ||
                    "Cliente"
                ).trim();

            const telefono =
                String(
                    destinatario.telefono ||
                    ""
                ).trim();

            const email =
                String(
                    destinatario.email ||
                    ""
                ).trim();


            // =================================================
            // ESTADOS INICIALES
            // =================================================

            let smsEnviado =
                data.sms?.estado === "enviado";

            let emailEnviado =
                data.email?.estado === "enviado";


            // =================================================
            // 📱 SMS
            // =================================================

            if (!smsEnviado) {

                try {

                    await ref.update({

                        "sms.estado":
                            "enviando",

                        "sms.intentos":
                            FieldValue.increment(1),

                        "sms.ultimoIntentoEn":
                            FieldValue.serverTimestamp(),

                        actualizadoEn:
                            FieldValue.serverTimestamp()

                    });


                    const sms =
                        await enviarSMSAlquiler({

                            nombre:
                                nombre,

                            telefono:
                                telefono,

                            solicitudId:
                                data.solicitudId ||
                                snapshot.id

                        });


                    await ref.update({

                        "sms.estado":
                            "enviado",

                        "sms.proveedor":
                            "twilio",

                        "sms.messageId":
                            sms.messageId,

                        "sms.telefono":
                            sms.telefono,

                        "sms.estadoProveedor":
                            sms.estadoProveedor || "",

                        "sms.enviadoEn":
                            FieldValue.serverTimestamp(),

                        actualizadoEn:
                            FieldValue.serverTimestamp()

                    });


                    smsEnviado =
                        true;


                    console.log(
                        "✅ SMS enviado:",
                        snapshot.id
                    );

                } catch (error) {

                    console.error(
                        "❌ Error SMS:",
                        error
                    );


                    await ref.update({

                        "sms.estado":
                            "error",

                        "sms.proveedor":
                            "twilio",

                        "sms.error":
                            String(
                                error?.message ||
                                error
                            ),

                        "sms.errorEn":
                            FieldValue.serverTimestamp(),

                        actualizadoEn:
                            FieldValue.serverTimestamp()

                    });

                }

            }


            // =================================================
            // 📧 EMAIL
            // =================================================

            if (!emailEnviado) {

                try {

                    await ref.update({

                        "email.estado":
                            "enviando",

                        "email.intentos":
                            FieldValue.increment(1),

                        "email.ultimoIntentoEn":
                            FieldValue.serverTimestamp(),

                        actualizadoEn:
                            FieldValue.serverTimestamp()

                    });


                    const resultadoEmail =
                        await enviarEmailAlquiler({

                            nombre:
                                nombre,

                            email:
                                email,

                            solicitudId:
                                data.solicitudId ||
                                snapshot.id

                        });


                    await ref.update({

                        "email.estado":
                            "enviado",

                        "email.proveedor":
                            "resend",

                        "email.messageId":
                            resultadoEmail.messageId,

                        "email.destino":
                            resultadoEmail.email,

                        "email.enviadoEn":
                            FieldValue.serverTimestamp(),

                        actualizadoEn:
                            FieldValue.serverTimestamp()

                    });


                    emailEnviado =
                        true;


                    console.log(
                        "✅ Email enviado:",
                        snapshot.id
                    );

                } catch (error) {

                    console.error(
                        "❌ Error Email:",
                        error
                    );


                    await ref.update({

                        "email.estado":
                            "error",

                        "email.proveedor":
                            "resend",

                        "email.error":
                            String(
                                error?.message ||
                                error
                            ),

                        "email.errorEn":
                            FieldValue.serverTimestamp(),

                        actualizadoEn:
                            FieldValue.serverTimestamp()

                    });

                }

            }


            // =================================================
            // ESTADO GENERAL
            // =================================================

            let estadoGeneral =
                "error";


            if (
                smsEnviado &&
                emailEnviado
            ) {

                estadoGeneral =
                    "enviado";

            } else if (
                smsEnviado ||
                emailEnviado
            ) {

                estadoGeneral =
                    "parcial";

            }


            // =================================================
            // GUARDAR RESULTADO
            // =================================================

            await ref.update({

                estadoGeneral:
                    estadoGeneral,

                finalizadoEn:
                    FieldValue.serverTimestamp(),

                actualizadoEn:
                    FieldValue.serverTimestamp()

            });


            console.log(
                "✅ Notificación de alquiler finalizada:",
                snapshot.id,
                estadoGeneral
            );

        }

    );


// ============================================================
// FIN DE FUNCTIONS
// ============================================================
