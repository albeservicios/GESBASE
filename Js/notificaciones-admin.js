import {
    getMessaging,
    getToken,
    onMessage
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js";


import {
    doc,
    setDoc,
    serverTimestamp
}
from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


import {
    auth,
    db,
    app
}
from "./firebase.js";


const VAPID_KEY =
    "TU_CLAVE_VAPID";


export async function activarNotificacionesAdmin(){

    try{

        if(
            !("Notification" in window)
        ){

            console.log(
                "Este dispositivo no soporta notificaciones."
            );

            return false;

        }


        const permiso =
            await Notification.requestPermission();


        if(
            permiso !== "granted"
        ){

            console.log(
                "Permiso de notificaciones rechazado."
            );

            return false;

        }


        const messaging =
            getMessaging(app);


        const token =
            await getToken(
                messaging,
                {
                    vapidKey:
                        VAPID_KEY
                }
            );


        if(!token){

            console.log(
                "No se obtuvo token FCM."
            );

            return false;

        }


        const user =
            auth.currentUser;


        if(!user){

            return false;

        }


        const tokenId =
            btoa(token)
                .replaceAll("/","_")
                .replaceAll("+","-")
                .replaceAll("=","");


        await setDoc(

            doc(
                db,
                "dispositivos_admin",
                user.uid,
                "tokens",
                tokenId
            ),

            {

                token: token,

                uid: user.uid,

                email:
                    user.email || "",

                activo:
                    true,

                plataforma:
                    "web",

                actualizado:
                    serverTimestamp()

            },

            {
                merge:true
            }

        );


        console.log(
            "Dispositivo registrado para FCM."
        );


        onMessage(
            messaging,
            payload => {

                console.log(
                    "Mensaje recibido:",
                    payload
                );

            }
        );


        return true;


    }catch(error){

        console.error(
            "Error FCM:",
            error
        );

        return false;

    }

}
