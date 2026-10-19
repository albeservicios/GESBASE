// ============================================================
// GESBASE SERVER - ENVÍO DE EMAIL
// SMTP (DreamHost, vía nodemailer) con fallback a Resend.
// Helper compartido por functions.js, triggers.js y auth.js
// ============================================================

import { config } from "./config.js";

export function escaparHTML(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function smtpConfigurado() {
    return !!(
        config.smtpHost && config.smtpUser && config.smtpPass
    );
}

export function emailConfigurado() {
    return smtpConfigurado() ||
        !!(config.resendApiKey && config.resendFromEmail);
}

// ------------------------------------------------------------
// SMTP (nodemailer) - transporter lazy, reutiliza conexión
// ------------------------------------------------------------

let transporter = null;
let transporterKey = "";

async function obtenerTransporter() {
    const key = [
        config.smtpHost, config.smtpPort,
        config.smtpUser, config.smtpSecure
    ].join("|");

    if (transporter && transporterKey === key) {
        return transporter;
    }

    const nodemailer = await import("nodemailer");
    transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
            user: config.smtpUser,
            pass: config.smtpPass
        }
    });
    transporterKey = key;
    return transporter;
}

async function enviarSMTP({ to, subject, html }) {
    const t = await obtenerTransporter();
    const from = config.smtpFrom || config.smtpUser;
    const info = await t.sendMail({
        from,
        to,
        subject,
        html
    });
    return {
        messageId: info.messageId || "",
        email: to
    };
}

// ------------------------------------------------------------
// Resend (fallback si no hay SMTP)
// ------------------------------------------------------------

async function enviarResend({ to, subject, html }) {
    const { Resend } = await import("resend");
    const resend = new Resend(config.resendApiKey);
    const resultado = await resend.emails.send({
        from: config.resendFromEmail,
        to: [to],
        subject,
        html
    });
    if (resultado?.error) {
        throw new Error(
            resultado.error.message || "Resend informó un error."
        );
    }
    return {
        messageId: resultado?.data?.id || "",
        email: to
    };
}

// ------------------------------------------------------------

export async function enviarEmail({ to, subject, html }) {
    if (!to) throw new Error("Falta el destinatario.");
    if (smtpConfigurado()) {
        return enviarSMTP({ to, subject, html });
    }
    if (config.resendApiKey && config.resendFromEmail) {
        return enviarResend({ to, subject, html });
    }
    throw new Error(
        "Email no configurado (faltan SMTP_* o RESEND_*)."
    );
}

// Plantilla base con el estilo de la marca
export function plantillaEmail({ titulo, cuerpo }) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escaparHTML(titulo)} - GESBASE</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;"><div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:16px;padding:30px;"><h1 style="margin-top:0;">${escaparHTML(titulo)}</h1>${cuerpo}<hr><p style="font-size:13px;color:#6b7280;">Mensaje automático enviado por GESBASE.</p></div></body></html>`;
}
