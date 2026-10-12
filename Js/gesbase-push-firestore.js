/*
=========================================================
 GESBASE - REGISTRO DE TOKEN PUSH
 Guarda el token del dispositivo en la base de datos local.
=========================================================
*/

import { doc, setDoc, serverTimestamp } from "./local/firebase-firestore.js";
import { auth, db } from "./firebase.js";

(function () {

    "use strict";

    console.log(
        "GESBASE: módulo Push iniciado."
    );


    async function guardarTokenPush(token) {

        try {

            if (!token) {
                console.log(
                    "GESBASE: token push vacío."
                );
                return;
            }


            const usuario = auth.currentUser;

            if (!usuario) {
                console.log(
                    "GESBASE: usuario no autenticado."
                );
                return;
            }


            await setDoc(
                doc(db, "usuarios", usuario.uid),
                {
                    fcmToken: token,
                    fcmTokenActualizado: serverTimestamp(),
                    plataforma: "android"
                },
                { merge: true }
            );


            console.log(
                "GESBASE: token push guardado correctamente."
            );

        } catch (error) {

            console.error(
                "GESBASE: error guardando token push:",
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

                guardarTokenPush(
                    event.detail.token
                );

            }

        }
    );


})();
