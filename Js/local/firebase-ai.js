// ============================================================
// GESBASE - SHIM firebase-ai.js
// getGenerativeModel -> /api/functions/geminiChat (Gemini en
// el servidor, la API key nunca sale del backend)
// ============================================================

import { api } from "./shared.js";

export class GoogleAIBackend {}

export function getAI(_app, _options) {
    return { __type: "ai", app: _app || null };
}

export function getGenerativeModel(_ai, options = {}) {
    const systemInstruction = options.systemInstruction || "";
    return {
        model: options.model || "gemini",
        async generateContent(prompt) {
            const mensaje =
                typeof prompt === "string"
                    ? prompt
                    : prompt?.contents
                          ?.map(c =>
                              (c.parts || [])
                                  .map(p => p.text || "")
                                  .join("")
                          )
                          .join("\n") ||
                      JSON.stringify(prompt);
            const resp = await api("/api/functions/geminiChat", {
                mensaje,
                system:
                    typeof systemInstruction === "string"
                        ? systemInstruction
                        : systemInstruction?.parts
                              ?.map(p => p.text || "")
                              .join("") || ""
            });
            return {
                response: {
                    text: () => resp.respuesta || "",
                    candidates: [
                        { content: { parts: [{ text: resp.respuesta }] } }
                    ]
                }
            };
        }
    };
}
