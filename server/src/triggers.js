// ============================================================
// GESBASE SERVER - TRIGGERS
// Port de functions/index.js (Firebase Cloud Functions)
//
//  - salas/{id} onCreate                 -> push de llamada
//  - notificacionesAlquiler/{id} onCreate -> SMS (Twilio) + email (Resend)
//  - soporte/{id} onCreate/onUpdate      -> emails de ticket de soporte
// ============================================================

import { docs, mongo } from "./db.js";
import { config } from "./config.js";
import { writeEvents } from "./events.js";
import { stripMeta } from "./firestore-internal.js";
import {
    enviarEmail, escaparHTML, plantillaEmail
} from "./mailer.js";
import twilio from "twilio";

// ============================================================
// HELPERS DE USUARIO
// ============================================================

async function obtenerUsuario(uid) {
    if (!uid) return null;
    const doc = await docs().findOne({ _id: `usuarios/${uid}` });
    if (!doc) return null;
    return { uid, ...stripMeta(doc) };
}

async function obtenerNombreUsuario(uid) {
    try {
        const usuario = await obtenerUsuario(uid);
        if (!usuario) return "Usuario GESBASE";
        const nombre = [usuario.nombre, usuario.apellido]
            .filter(Boolean)
            .join(" ")
            .trim();
        return nombre || usuario.displayName || usuario.email ||
            "Usuario GESBASE";
    } catch {
        return "Usuario GESBASE";
    }
}

async function obtenerTokensUsuario(uid) {
    const tokens = new Set();
    try {
        const usuario = await obtenerUsuario(uid);
        if (usuario) {
            for (const arr of [usuario.tokens, usuario.fcmTokens]) {
                if (Array.isArray(arr)) {
                    for (const t of arr) {
                        if (typeof t === "string" && t.trim()) {
                            tokens.add(t.trim());
                        }
                    }
                }
            }
            if (typeof usuario.fcmToken === "string" &&
                usuario.fcmToken.trim()) {
                tokens.add(usuario.fcmToken.trim());
            }
        }
        const tokensSnap = await docs()
            .find({ _parent: `usuarios/${uid}/tokens` })
            .toArray();
        for (const doc of tokensSnap) {
            const t = doc.token || doc.fcmToken ||
                doc._id.split("/").pop();
            if (typeof t === "string" && t.trim()) tokens.add(t.trim());
        }
    } catch (e) {
        console.error("Error obteniendo tokens:", e);
    }
    return [...tokens];
}

// ============================================================
// ENVÍO DE PUSH
// Fase local: registra en pushOutbox y loguea.
// Para entrega real: configurar Web Push (VAPID) o FCM legacy.
// ============================================================

async function enviarPush({
    uidDestino, titulo, cuerpo, tipo, usuario, mensajeId,
    llamadaId, url
}) {
    if (!uidDestino) return;
    const tokens = await obtenerTokensUsuario(uidDestino);
    const payload = {
        uidDestino,
        titulo: String(titulo || "GESBASE"),
        cuerpo: String(cuerpo || ""),
        tipo: String(tipo || "mensaje"),
        usuario: String(usuario || ""),
        mensajeId: String(mensajeId || ""),
        llamadaId: String(llamadaId || ""),
        salaId: String(llamadaId || ""),
        url: String(url || "/comunicacion.html"),
        tokens,
        estado: tokens.length ? "pendiente" : "sin-tokens",
        creadoEn: new Date()
    };

    await mongo.collection("pushOutbox").insertOne(payload);

    if (tokens.length === 0) {
        console.log(`Push: usuario ${uidDestino} sin tokens`);
    } else {
        console.log(
            `Push encolado -> ${uidDestino}: ${payload.titulo}`
        );
    }
}

// ============================================================
// TRIGGER: salas/{salaId} onCreate -> notificarLlamada
// ============================================================

async function notificarLlamada(salaId, sala) {
    const tipo = sala.type || "";
    if (!["audio", "video", "llamada", "videollamada"].includes(tipo)) {
        return;
    }
    if (sala.status !== "ringing") return;

    const empresaId = String(sala.empresaId || "").trim();
    const creador = sala.createdBy;
    if (!empresaId || !creador) return;

    const participantes = Array.isArray(sala.participants)
        ? sala.participants
        : [];
    const destinatarios = participantes.filter(
        uid => uid && uid !== creador
    );
    if (!destinatarios.length) return;

    const nombreCaller =
        sala.createdByName || (await obtenerNombreUsuario(creador));

    const esVideo = tipo === "video" || tipo === "videollamada";
    const titulo = esVideo
        ? "🎥 Videollamada entrante"
        : "📞 Llamada entrante";
    const cuerpo = esVideo
        ? `${nombreCaller} te está llamando por videollamada.`
        : `${nombreCaller} te está llamando.`;

    const url = esVideo
        ? `/videollamada.html?sala=${encodeURIComponent(salaId)}`
        : `/llamada.html?sala=${encodeURIComponent(salaId)}`;

    for (const uidDestino of destinatarios) {
        const usuarioDestino = await obtenerUsuario(uidDestino);
        if (!usuarioDestino) continue;

        const empresaDestino = String(
            usuarioDestino.empresaId ||
            usuarioDestino.idEmpresa ||
            usuarioDestino.empresa ||
            ""
        ).trim();

        if (empresaDestino !== empresaId) {
            console.warn(
                "Push bloqueado por empresa diferente:", uidDestino
            );
            continue;
        }

        await enviarPush({
            uidDestino,
            titulo,
            cuerpo,
            tipo: esVideo ? "videollamada" : "llamada",
            usuario: creador,
            llamadaId: salaId,
            url
        });
    }
}

// ============================================================
// TRIGGER: notificacionesAlquiler/{id} -> SMS + email
// ============================================================

function normalizarTelefono(telefono) {
    if (!telefono) return "";
    let numero = String(telefono).trim().replace(/[\s().-]/g, "");
    if (!numero) return "";
    if (numero.startsWith("+")) return numero;
    if (numero.startsWith("54")) return "+" + numero;
    if (numero.startsWith("0")) numero = numero.substring(1);
    if (numero.length === 10) return "+549" + numero;
    return "+54" + numero;
}

function construirEmailSolicitudAprobada({ nombre, solicitudId }) {
    const nombreSeguro = escaparHTML(nombre || "Cliente");
    const idSeguro = escaparHTML(solicitudId || "");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Solicitud aprobada - GESBASE</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;"><div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:16px;padding:30px;"><h1 style="margin-top:0;">🏠 Solicitud aprobada</h1><p>Hola <strong>${nombreSeguro}</strong>.</p><p>Tu solicitud de alquiler fue <strong>aprobada</strong>.</p><p>GESBASE registró correctamente la aprobación de tu solicitud.</p><div style="margin:25px 0;padding:15px;background:#f9fafb;border-radius:10px;"><strong>Número de solicitud:</strong><br>${idSeguro}</div><p>La empresa se pondrá en contacto con vos para continuar con la reserva y los detalles del alquiler.</p><hr><p style="font-size:13px;color:#6b7280;">Mensaje automático enviado por GESBASE.</p></div></body></html>`;
}

async function enviarSMSAlquiler({ nombre, telefono, solicitudId }) {
    const numero = normalizarTelefono(telefono);
    if (!numero) {
        throw new Error(
            "El cliente no tiene un número de teléfono válido."
        );
    }
    if (!config.twilioAccountSid || !config.twilioAuthToken ||
        !config.twilioPhoneNumber) {
        throw new Error("Faltan las credenciales de Twilio.");
    }
    const client = twilio(
        config.twilioAccountSid,
        config.twilioAuthToken
    );
    const mensaje =
        `GESBASE: Hola ${nombre || "cliente"}. Tu solicitud de alquiler fue aprobada. Solicitud: ${solicitudId}. La empresa se pondrá en contacto para continuar.`;
    const resultado = await client.messages.create({
        body: mensaje,
        from: config.twilioPhoneNumber,
        to: numero
    });
    return {
        messageId: resultado.sid,
        telefono: numero,
        estadoProveedor: resultado.status || ""
    };
}

async function enviarEmailAlquiler({ nombre, email, solicitudId }) {
    if (!email) {
        throw new Error("El cliente no tiene un email.");
    }
    return enviarEmail({
        to: email,
        subject: "🏠 Solicitud de alquiler aprobada - GESBASE",
        html: construirEmailSolicitudAprobada({ nombre, solicitudId })
    });
}

async function procesarNotificacionAlquiler(notificacionId, data) {
    if (data.tipo !== "solicitud_aprobada") return;

    const path = `notificacionesAlquiler/${notificacionId}`;

    // Marcar como "enviando" de forma atómica para no procesar dos veces
    const claimed = await docs().findOneAndUpdate(
        {
            _id: path,
            $or: [
                { estadoGeneral: { $exists: false } },
                { estadoGeneral: { $nin: ["enviado", "parcial", "enviando"] } }
            ]
        },
        {
            $set: {
                estadoGeneral: "enviando",
                iniciadoEn: new Date(),
                actualizadoEn: new Date()
            },
            $inc: { _v: 1 }
        },
        { returnDocument: "after" }
    );
    if (!claimed) {
        console.log(
            "Notificación ya procesada o en proceso:", notificacionId
        );
        return;
    }

    const destinatario = data.destinatario || {};
    const nombre = String(destinatario.nombre || "Cliente").trim();
    const telefono = String(destinatario.telefono || "").trim();
    const email = String(destinatario.email || "").trim();

    let smsEnviado = data.sms?.estado === "enviado";
    let emailEnviado = data.email?.estado === "enviado";
    const solicitudId = data.solicitudId || notificacionId;

    // SMS
    if (!smsEnviado) {
        try {
            await docs().updateOne(
                { _id: path },
                {
                    $set: {
                        "sms.estado": "enviando",
                        "sms.ultimoIntentoEn": new Date(),
                        actualizadoEn: new Date()
                    },
                    $inc: { "sms.intentos": 1, _v: 1 }
                }
            );
            const sms = await enviarSMSAlquiler({
                nombre, telefono, solicitudId
            });
            await docs().updateOne(
                { _id: path },
                {
                    $set: {
                        "sms.estado": "enviado",
                        "sms.proveedor": "twilio",
                        "sms.messageId": sms.messageId,
                        "sms.telefono": sms.telefono,
                        "sms.estadoProveedor": sms.estadoProveedor || "",
                        "sms.enviadoEn": new Date(),
                        actualizadoEn: new Date()
                    },
                    $inc: { _v: 1 }
                }
            );
            smsEnviado = true;
            console.log("SMS enviado:", notificacionId);
        } catch (error) {
            console.error("Error SMS:", error);
            await docs().updateOne(
                { _id: path },
                {
                    $set: {
                        "sms.estado": "error",
                        "sms.proveedor": "twilio",
                        "sms.error": String(error?.message || error),
                        "sms.errorEn": new Date(),
                        actualizadoEn: new Date()
                    },
                    $inc: { _v: 1 }
                }
            );
        }
    }

    // Email
    if (!emailEnviado) {
        try {
            await docs().updateOne(
                { _id: path },
                {
                    $set: {
                        "email.estado": "enviando",
                        "email.ultimoIntentoEn": new Date(),
                        actualizadoEn: new Date()
                    },
                    $inc: { "email.intentos": 1, _v: 1 }
                }
            );
            const resultadoEmail = await enviarEmailAlquiler({
                nombre, email, solicitudId
            });
            await docs().updateOne(
                { _id: path },
                {
                    $set: {
                        "email.estado": "enviado",
                        "email.proveedor": "resend",
                        "email.messageId": resultadoEmail.messageId,
                        "email.destino": resultadoEmail.email,
                        "email.enviadoEn": new Date(),
                        actualizadoEn: new Date()
                    },
                    $inc: { _v: 1 }
                }
            );
            emailEnviado = true;
            console.log("Email enviado:", notificacionId);
        } catch (error) {
            console.error("Error Email:", error);
            await docs().updateOne(
                { _id: path },
                {
                    $set: {
                        "email.estado": "error",
                        "email.proveedor": "resend",
                        "email.error": String(error?.message || error),
                        "email.errorEn": new Date(),
                        actualizadoEn: new Date()
                    },
                    $inc: { _v: 1 }
                }
            );
        }
    }

    const estadoGeneral = smsEnviado && emailEnviado
        ? "enviado"
        : smsEnviado || emailEnviado
            ? "parcial"
            : "error";

    await docs().updateOne(
        { _id: path },
        {
            $set: {
                estadoGeneral,
                finalizadoEn: new Date(),
                actualizadoEn: new Date()
            },
            $inc: { _v: 1 }
        }
    );
    console.log(
        "Notificación de alquiler finalizada:",
        notificacionId,
        estadoGeneral
    );
}

// ============================================================
// TRIGGER: soporte/{id} -> emails de ticket
//  - create: confirmación al usuario + aviso al admin
//  - update con notificarUsuario/notificarAdmin: email al otro lado
// ============================================================

const linkTicket = id =>
    `${config.publicUrl}/soporte-admin.html?id=` +
    encodeURIComponent(id);

async function notificarTicketCreado(ticketId, ticket) {
    const nombre = escaparHTML(ticket.nombre || "Usuario");
    const asunto = escaparHTML(ticket.asunto || "Sin asunto");
    const mensaje = escaparHTML(ticket.mensaje || "");
    const emailUsuario = String(ticket.email || "").trim();
    const updates = { actualizadoEn: new Date() };

    try {
        if (emailUsuario) {
            await enviarEmail({
                to: emailUsuario,
                subject: `🎫 Ticket recibido: ${ticket.asunto || "soporte"} - GESBASE`,
                html: plantillaEmail({
                    titulo: "Recibimos tu ticket",
                    cuerpo:
                        `<p>Hola <strong>${nombre}</strong>.</p>` +
                        `<p>Tu consulta fue registrada como ticket ` +
                        `<strong>#${escaparHTML(ticketId)}</strong>. ` +
                        `Te responderemos a la brevedad.</p>` +
                        `<div style="margin:15px 0;padding:15px;background:#f9fafb;border-radius:10px;">` +
                        `<strong>${asunto}</strong><br>` +
                        `<span style="white-space:pre-wrap;">${mensaje}</span></div>`
                })
            });
            updates["emailUsuarioConfirmacion"] = "enviado";
        }
        await enviarEmail({
            to: config.adminEmail,
            subject: `🎫 Nuevo ticket: ${ticket.asunto || "soporte"} (${ticket.nombre || ticket.email || "usuario"})`,
            html: plantillaEmail({
                titulo: "Nuevo ticket de soporte",
                cuerpo:
                    `<p><strong>${nombre}</strong> ` +
                    `(${escaparHTML(ticket.email || "sin email")}) ` +
                    `abrió el ticket <strong>#${escaparHTML(ticketId)}</strong>:</p>` +
                    `<div style="margin:15px 0;padding:15px;background:#f9fafb;border-radius:10px;">` +
                    `<strong>${asunto}</strong><br>` +
                    `<span style="white-space:pre-wrap;">${mensaje}</span></div>` +
                    `<p><a href="${linkTicket(ticketId)}">Abrir en el panel de administración</a></p>`
            })
        });
        updates["emailAdminTicket"] = "enviado";
    } catch (e) {
        console.error("Soporte: error emails ticket nuevo:", e);
        updates["emailError"] = String(e?.message || e);
    }
    await docs().updateOne(
        { _id: `soporte/${ticketId}` },
        { $set: updates, $inc: { _v: 1 } }
    );
}

async function notificarRespuestaTicket(ticketId, ticket) {
    const path = `soporte/${ticketId}`;
    const ultima = (ticket.respuestas || []).slice(-1)[0];
    if (!ultima) return;

    const texto = escaparHTML(ultima.texto || "");
    const updates = { actualizadoEn: new Date() };

    try {
        if (ticket.notificarUsuario && ticket.email) {
            await enviarEmail({
                to: String(ticket.email).trim(),
                subject: `💬 Respuesta a tu ticket: ${ticket.asunto || "soporte"} - GESBASE`,
                html: plantillaEmail({
                    titulo: "Tenés una respuesta",
                    cuerpo:
                        `<p>Hola <strong>${escaparHTML(ticket.nombre || "Usuario")}</strong>.</p>` +
                        `<p>Respondimos tu ticket <strong>#${escaparHTML(ticketId)}</strong> ` +
                        `(${escaparHTML(ticket.asunto || "")}):</p>` +
                        `<div style="margin:15px 0;padding:15px;background:#f9fafb;border-radius:10px;white-space:pre-wrap;">${texto}</div>` +
                        `<p>Podés responder desde tu panel en GESBASE.</p>`
                })
            });
            updates.notificarUsuario = false;
            updates["ultimoEmailUsuarioEn"] = new Date();
        }
        if (ticket.notificarAdmin) {
            await enviarEmail({
                to: config.adminEmail,
                subject: `💬 Respuesta en ticket #${ticketId} (${ticket.nombre || ticket.email || "usuario"})`,
                html: plantillaEmail({
                    titulo: "Respuesta en ticket de soporte",
                    cuerpo:
                        `<p><strong>${escaparHTML(ticket.nombre || "Usuario")}</strong> ` +
                        `respondió el ticket <strong>#${escaparHTML(ticketId)}</strong> ` +
                        `(${escaparHTML(ticket.asunto || "")}):</p>` +
                        `<div style="margin:15px 0;padding:15px;background:#f9fafb;border-radius:10px;white-space:pre-wrap;">${texto}</div>` +
                        `<p><a href="${linkTicket(ticketId)}">Abrir en el panel de administración</a></p>`
                })
            });
            updates.notificarAdmin = false;
            updates["ultimoEmailAdminEn"] = new Date();
        }
    } catch (e) {
        console.error("Soporte: error email respuesta:", e);
        updates["emailError"] = String(e?.message || e);
    }
    await docs().updateOne(
        { _id: path },
        { $set: updates, $inc: { _v: 1 } }
    );
}

// ============================================================
// CABLEADO DE TRIGGERS
// ============================================================

export function initTriggers() {
    writeEvents.on("write", async ({ path, parent, op }) => {
        try {
            const id = path.split("/").pop();
            if (op === "create") {
                if (parent === "salas") {
                    const doc = await docs().findOne({ _id: path });
                    if (doc) {
                        await notificarLlamada(id, stripMeta(doc));
                    }
                } else if (parent === "notificacionesAlquiler") {
                    const doc = await docs().findOne({ _id: path });
                    if (doc) {
                        await procesarNotificacionAlquiler(
                            id,
                            stripMeta(doc)
                        );
                    }
                } else if (parent === "soporte") {
                    const doc = await docs().findOne({ _id: path });
                    if (doc) {
                        await notificarTicketCreado(id, stripMeta(doc));
                    }
                }
            } else if (op === "update" && parent === "soporte") {
                const doc = await docs().findOne({ _id: path });
                if (doc && (doc.notificarUsuario || doc.notificarAdmin)) {
                    await notificarRespuestaTicket(id, stripMeta(doc));
                }
            }
        } catch (e) {
            console.error("Error en trigger:", e);
        }
    });
    console.log(
        "Triggers registrados (salas, notificacionesAlquiler, soporte)"
    );
}
