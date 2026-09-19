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
