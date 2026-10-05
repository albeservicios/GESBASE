/*
=========================================================
 GESBASE - REGISTRO DE TOKEN FCM
=========================================================
 Guarda el token del dispositivo en Firestore.
=========================================================
*/

(function () {

    "use strict";


    console.log(
        "GESBASE: módulo Firestore Push iniciado."
    );


    async function guardarTokenFCM(token) {

        try {

            if (!token) {

                console.log(
                    "GESBASE: token FCM vacío."
                );

                return;

            }


            if (
                typeof firebase === "undefined" ||
                !firebase.auth ||
                !firebase.firestore
            ) {

                console.log(
                    "GESBASE: Firebase todavía no está disponible."
                );

                return;

            }


            const usuario =
                firebase.auth().currentUser;


            if (!usuario) {

                console.log(
                    "GESBASE: usuario no autenticado."
                );

                return;

            }


            const db =
                firebase.firestore();


            await db
                .collection("usuarios")
                .doc(usuario.uid)
                .set(
                    {
                        fcmToken: token,

                        fcmTokenActualizado:
                            firebase.firestore.FieldValue.serverTimestamp(),

                        plataforma:
                            "android"

                    },
                    {
                        merge: true
                    }
                );


            console.log(
                "GESBASE: token FCM guardado correctamente."
            );

        } catch (error) {

            console.error(
                "GESBASE: error guardando token FCM:",
                error
            );

        }

    }


    window.addEventListener(
        "gesbaseFCMToken",
        function (event) {

            if (
                event &&
                event.detail &&
                event.detail.token
            ) {

                guardarTokenFCM(
                    event.detail.token
                );

            }

        }
    );


})();
