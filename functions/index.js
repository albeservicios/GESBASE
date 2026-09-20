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
            console.warn("❌ Push sin uidDestino");
            return;
        }

        // =====================================================
        // USUARIO DESTINO
        // =====================================================

        const usuarioDestino =
            await obtenerUsuario(uidDestino);

        if (!usuarioDestino) {

            console.warn(
                "❌ Usuario destino no encontrado:",
                uidDestino
            );

            return;
        }

        // =====================================================
        // TOKENS FCM
        // =====================================================

        const tokens =
            await obtenerTokensUsuario(uidDestino);

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

            tipo: String(
                tipo || "mensaje"
            ),

            titulo: String(
                titulo || "GESBASE"
            ),

            cuerpo: String(
                cuerpo || ""
            ),

            usuario: String(
                usuario || ""
            ),

            mensajeId: String(
                mensajeId || ""
            ),

            llamadaId: String(
                llamadaId || ""
            ),

            salaId: String(
                llamadaId || ""
            ),

            url: String(
                url ||
                "/GESBASE/comunicacion.html"
            )
        };

        // =====================================================
        // ENVIAR A TODOS LOS DISPOSITIVOS DEL USUARIO
        // =====================================================

        for (
            const token of tokens
        ) {

            if (!token) {
                continue;
            }

            try {

                await getMessaging().send({

                    token: token,

                    // DATA ONLY
                    // El Service Worker crea la notificación
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
                    "✅ Push enviado correctamente a:",
                    uidDestino
                );

            } catch (error) {

                console.error(
                    "❌ Error enviando push:",
                    error
                );

                const codigo =
                    String(
                        error?.code || ""
                    );

                // =================================================
                // ELIMINAR TOKEN INVÁLIDO
                // =================================================

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

                    } catch (errorEliminar) {

                        console.error(
                            "❌ Error eliminando token inválido:",
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
// ESCUCHA: salas/{salaId}
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
            // SOLO LLAMADAS RINGING
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
                    sala.empresaId || ""
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
            // NOMBRE DEL QUE LLAMA
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
            // URL DIRECTA
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
            // ENVIAR A CADA PARTICIPANTE
            // =================================================

            for (
                const uidDestino
                of destinatarios
            ) {

                // =============================================
                // VERIFICAR QUE PERTENEZCA A LA MISMA EMPRESA
                // =============================================

                const usuarioDestino =
                    await obtenerUsuario(
                        uidDestino
                    );

                if (
                    !usuarioDestino
                ) {

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

                // =============================================
                // PUSH
                // =============================================

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
