import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const clienteSelect =
    document.getElementById("clienteId");

const listaTrabajos =
    document.getElementById("listaTrabajos");


onAuthStateChanged(
    auth,
    async (usuario) => {

        if (!usuario) {

            window.location.href =
                "login.html";

            return;
        }

        console.log(
            "USUARIO:",
            usuario.uid
        );

        try {

            // ==============================
            // CLIENTES
            // ==============================

            const clientesRef =
                collection(
                    db,
                    "clientes"
                );

            const clientesSnapshot =
                await getDocs(
                    clientesRef
                );

            console.log(
                "TOTAL CLIENTES FIRESTORE:",
                clientesSnapshot.size
            );


            clienteSelect.innerHTML = `
                <option value="">
                    Seleccionar cliente
                </option>
            `;


            clientesSnapshot.forEach(
                (documento) => {

                    const datos =
                        documento.data();

                    console.log(
                        "CLIENTE:",
                        documento.id,
                        datos
                    );


                    // Mostrar solamente los
                    // clientes del usuario

                    if(
                        datos.uid !==
                        usuario.uid
                        &&
                        datos.empresaId !==
                        usuario.uid
                    ){

                        return;

                    }


                    const opcion =
                        document.createElement(
                            "option"
                        );


                    opcion.value =
                        documento.id;


                    const nombre =
                        [
                            datos.nombre,
                            datos.apellido
                        ]
                        .filter(Boolean)
                        .join(" ");


                    opcion.textContent =
                        nombre ||
                        datos.empresa ||
                        datos.razonSocial ||
                        datos.razon_social ||
                        "Cliente";


                    clienteSelect.appendChild(
                        opcion
                    );

                }
            );


            // ==============================
            // TRABAJOS
            // ==============================

            const trabajosRef =
                collection(
                    db,
                    "trabajos"
                );


            const trabajosSnapshot =
                await getDocs(
                    trabajosRef
                );


            console.log(
                "TOTAL TRABAJOS FIRESTORE:",
                trabajosSnapshot.size
            );


            listaTrabajos.innerHTML = "";


            let cantidad =
                0;


            trabajosSnapshot.forEach(
                (documento) => {

                    const datos =
                        documento.data();


                    if(
                        datos.empresaId !==
                        usuario.uid
                    ){

                        return;

                    }


                    cantidad++;


                    const cliente =
                        datos.clienteId ||
                        "Sin cliente";


                    const tarjeta =
                        document.createElement(
                            "article"
                        );


                    tarjeta.className =
                        "job";


                    tarjeta.innerHTML = `

                        <div class="job-header">

                            <div>

                                <div class="job-title">

                                    ${escapeHTML(
                                        datos.descripcion ||
                                        "Trabajo"
                                    )}

                                </div>

                                <small>

                                    Cliente:
                                    ${escapeHTML(
                                        cliente
                                    )}

                                </small>

                            </div>

                            <span class="status">

                                ${escapeHTML(
                                    datos.estado ||
                                    "Pendiente"
                                )}

                            </span>

                        </div>

                        <div class="job-info">

                            <div>
                                📍
                                ${escapeHTML(
                                    datos.lugar ||
                                    "Sin ubicación"
                                )}
                            </div>

                            <div>
                                📅
                                ${escapeHTML(
                                    datos.fechaInicio ||
                                    "Sin fecha"
                                )}
                            </div>

                        </div>

                    `;


                    listaTrabajos.appendChild(
                        tarjeta
                    );

                }
            );


            if(
                cantidad === 0
            ){

                listaTrabajos.innerHTML = `
                    <div class="message">
                        Todavía no hay trabajos cargados.
                    </div>
                `;

            }


        }
        catch(error){

            console.error(
                "ERROR GESBASE:",
                error
            );


            listaTrabajos.innerHTML = `
                <div class="message">

                    <strong>
                        Error GESBASE
                    </strong>

                    <br><br>

                    ${escapeHTML(
                        error.message
                    )}

                </div>
            `;

        }

    }
);


// ==========================================
// SEGURIDAD
// ==========================================

function escapeHTML(valor){

    return String(
        valor ?? ""
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );

}
