// ============================================================
// GESBASE SERVER - FUNCIONES INVOCABLES (reemplaza Cloud Functions)
// POST /api/functions/:name  body: {data:{...}} o directo {...}
// ============================================================

import { Router } from "express";
import crypto from "node:crypto";
import { docs, mongo } from "./db.js";
import { config } from "./config.js";
import { createUser } from "./auth.js";
import { stripMeta } from "./firestore-internal.js";
import { enviarEmail, escaparHTML, plantillaEmail } from "./mailer.js";

export const functionsRouter = Router();

const callables = {
    // ----------------------------------------------------------
    // geminiChat {mensaje, system} -> {respuesta}
    // ----------------------------------------------------------
    async geminiChat(data) {
        if (!config.geminiApiKey) {
            const err = new Error(
                "GEMINI_API_KEY no configurada en server/.env"
            );
            err.code = "failed-precondition";
            throw err;
        }
        const { GoogleGenerativeAI } = await import(
            "@google/generative-ai"
        );
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
            ...(data.system
                ? { systemInstruction: data.system }
                : {})
        });
        const result = await model.generateContent(data.mensaje);
        return { respuesta: result.response.text() };
    },

    // ----------------------------------------------------------
    // crearAccesoEmpleado {empleadoId} -> {passwordTemporal,email}
    // ----------------------------------------------------------
    async crearAccesoEmpleado(data, req) {
        const empleadoId = String(data.empleadoId || "");
        if (!empleadoId) {
            const err = new Error("empleadoId requerido");
            err.code = "invalid-argument";
            throw err;
        }

        const empleadoDoc = await docs().findOne({
            _id: `empleados/${empleadoId}`
        });
        if (!empleadoDoc) {
            const err = new Error("Empleado no encontrado");
            err.code = "not-found";
            throw err;
        }
        const empleado = stripMeta(empleadoDoc);

        if (empleado.uid || empleado.authUid || empleado.accesoUid) {
            const err = new Error(
                "Ese empleado ya tiene una cuenta de acceso."
            );
            err.code = "already-exists";
            throw err;
        }

        const email = (
            empleado.email ||
            empleado.correo ||
            `empleado.${empleadoId.toLowerCase()}@gesbase.local`
        ).toLowerCase();

        const existing = await mongo
            .collection("_auth_users")
            .findOne({ email });
        if (existing) {
            const err = new Error(
                "Ese email ya tiene una cuenta registrada."
            );
            err.code = "already-exists";
            throw err;
        }

        const passwordTemporal = crypto
            .randomBytes(5)
            .toString("base64url");

        const user = await createUser({
            email,
            password: passwordTemporal,
            displayName:
                [empleado.nombre, empleado.apellido]
                    .filter(Boolean)
                    .join(" ") || empleado.nombre || null
        });

        await docs().updateOne(
            { _id: `empleados/${empleadoId}` },
            {
                $set: {
                    accesoUid: user._id,
                    accesoEmail: email,
                    accesoCreadoEn: new Date()
                },
                $inc: { _v: 1 }
            }
        );

        return {
            passwordTemporal,
            email,
            uid: user._id
        };
    },

    // ----------------------------------------------------------
    // contacto {nombre, email, mensaje}
    // Formulario público del landing -> email al admin + auto-reply
    // ----------------------------------------------------------
    async contacto(data) {
        const nombre = String(data.nombre || "").trim();
        const email = String(data.email || "").trim();
        const mensaje = String(data.mensaje || "").trim();

        if (!nombre || !mensaje) {
            const err = new Error("Faltan nombre y mensaje.");
            err.code = "invalid-argument";
            throw err;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            const err = new Error("Email inválido.");
            err.code = "invalid-argument";
            throw err;
        }
        if (mensaje.length > 4000 || nombre.length > 200) {
            const err = new Error("Mensaje demasiado largo.");
            err.code = "invalid-argument";
            throw err;
        }

        const registro = {
            nombre, email, mensaje,
            origen: "landing",
            creadoEn: new Date()
        };
        await mongo.collection("contactos").insertOne(registro);

        try {
            await enviarEmail({
                to: config.adminEmail,
                subject: `📩 Contacto web: ${nombre}`,
                html: plantillaEmail({
                    titulo: "Nuevo contacto desde la web",
                    cuerpo:
                        `<p><strong>${escaparHTML(nombre)}</strong> ` +
                        `(${escaparHTML(email)}) escribió:</p>` +
                        `<div style="margin:15px 0;padding:15px;background:#f9fafb;border-radius:10px;white-space:pre-wrap;">${escaparHTML(mensaje)}</div>` +
                        `<p style="font-size:13px;color:#6b7280;">Respondé directamente a ` +
                        `<a href="mailto:${escaparHTML(email)}">${escaparHTML(email)}</a>.</p>`
                })
            });
            await enviarEmail({
                to: email,
                subject: "Recibimos tu consulta - GESBASE",
                html: plantillaEmail({
                    titulo: "Gracias por escribirnos",
                    cuerpo:
                        `<p>Hola <strong>${escaparHTML(nombre)}</strong>.</p>` +
                        `<p>Recibimos tu consulta y te responderemos a la brevedad.</p>` +
                        `<div style="margin:15px 0;padding:15px;background:#f9fafb;border-radius:10px;white-space:pre-wrap;">${escaparHTML(mensaje)}</div>`
                })
            });
            registro.emails = { admin: "enviado", usuario: "enviado" };
        } catch (e) {
            console.error("Contacto: error enviando emails:", e);
            registro.emails = {
                error: String(e?.message || e)
            };
            const err = new Error(
                "No se pudo enviar el email. " +
                "Revisá la configuración de Resend en el servidor."
            );
            err.code = "internal";
            throw err;
        }

        return { ok: true };
    }
};

functionsRouter.post("/:name", async (req, res) => {
    const handler = callables[req.params.name];
    if (!handler) {
        return res.status(404).json({
            error: { code: "not-found", message: "Función no existe" }
        });
    }
    // httpsCallable envía {data:{...}}; llamadas directas envían {...}
    const data =
        req.body && req.body.data !== undefined
            ? req.body.data
            : req.body || {};
    try {
        const result = await handler(data, req);
        // Formato compatible con httpsCallable: {result} y con
        // gemini.js que espera {respuesta} directo.
        res.json({ result, ...result });
    } catch (e) {
        console.error(`Error en función ${req.params.name}:`, e);
        res.status(500).json({
            error: {
                code: e.code || "internal",
                message: e.message || "Error interno"
            }
        });
    }
});
