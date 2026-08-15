import {
    auth,
    db
} from "./Firebase/firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ==========================================
// GESBASE — TRABAJOS
// ETAPA 7
// ==========================================

let usuarioActual = null;
let trabajos = [];


// ==========================================
// ELEMENTOS
// ==========================================

const formulario =
    document.getElementById("trabajoForm");

const listaTrabajos =
    document.getElementById("listaTrabajos");

const clienteSelect =
    document.getElementById("clienteId");

const presupuestoSelect =
    document.getElementById("presupuestoId");


// ==========================================
// AUTENTICACIÓN
// ==========================================

onAuthStateChanged(
    auth,
    async function(usuario){

        if(!usuario){

            window.location.replace(
                "login.html"
            );

            return;
        }

        usuarioActual = usuario;

        await cargarTrabajos();

    }
);


// ==========================================
// CARGAR TRABAJOS
// ==========================================

async function cargarTrabajos(){

    try{

        const referencia =
            collection(
                db,
                "trabajos"
            );


        const consulta =
            query(
                referencia,
                where(
                    "empresaId",
                    "==",
                    usuarioActual.uid
                ),
                orderBy(
                    "fechaCreacion",
                    "desc"
                )
            );


        const resultado =
            await getDocs(consulta);


        trabajos = [];


        resultado.forEach(
            function(documento){

                trabajos.push({

                    id:
                        documento.id,

                    ...documento.data()

                });

            }
        );


        mostrarTrabajos(trabajos);


    }catch(error){

        console.error(
            "Error cargando trabajos:",
            error
        );


        listaTrabajos.innerHTML = `
            <div class="message">
                No se pudieron cargar los trabajos.
                <br><br>
                ${error.message}
            </div>
        `;

    }

}


// ==========================================
// GUARDAR TRABAJO
// ==========================================

if(formulario){

    formulario.addEventListener(
        "submit",
        async function(evento){

            evento.preventDefault();


            if(!usuarioActual){

                alert(
                    "No hay un usuario autenticado."
                );

                return;
            }


            const descripcion =
                document
                .getElementById("descripcion")
                .value
                .trim();


            const clienteId =
                document
                .getElementById("clienteId")
                .value;


            const presupuestoId =
                document
                .getElementById("presupuestoId")
                .value;


            const lugar =
                document
                .getElementById("lugar")
                .value
                .trim();


            const estado =
                document
                .getElementById("estado")
                .value;


            const fechaInicio =
                document
                .getElementById("fechaInicio")
                .value;


            const fechaFin =
                document
                .getElementById("fechaFin")
                .value;


            const observaciones =
                document
                .getElementById("observaciones")
                .value
                .trim();


            if(!descripcion){

                alert(
                    "Ingresá la descripción del trabajo."
                );

                return;
            }


            try{

                const boton =
                    formulario.querySelector(
                        "button[type='submit']"
                    );


                if(boton){

                    boton.disabled = true;

                    boton.textContent =
                        "Guardando...";

                }


                await addDoc(
                    collection(
                        db,
                        "trabajos"
                    ),
                    {

                        empresaId:
                            usuarioActual.uid,

                        creadoPor:
                            usuarioActual.uid,

                        clienteId:
                            clienteId || null,

                        presupuestoId:
                            presupuestoId || null,

                        descripcion:
                            descripcion,

                        lugar:
                            lugar,

                        estado:
                            estado,

                        fechaInicio:
                            fechaInicio || null,

                        fechaFin:
                            fechaFin || null,

                        observaciones:
                            observaciones,

                        fechaCreacion:
                            serverTimestamp()

                    }
                );


                alert(
                    "✅ Trabajo guardado correctamente."
                );


                formulario.reset();


                if(
                    typeof ocultarFormulario ===
                    "function"
                ){

                    ocultarFormulario();

                }


                await cargarTrabajos();


                if(boton){

                    boton.disabled = false;

                    boton.textContent =
                        "Guardar trabajo";

                }


            }catch(error){

                console.error(
                    "Error guardando trabajo:",
                    error
                );


                alert(
                    "❌ No se pudo guardar el trabajo.\n\n" +
                    error.message
                );


                const boton =
                    formulario.querySelector(
                        "button[type='submit']"
                    );


                if(boton){

                    boton.disabled = false;

                    boton.textContent =
                        "Guardar trabajo";

                }

            }

        }
    );

}


// ==========================================
// MOSTRAR TRABAJOS
// ==========================================

function mostrarTrabajos(lista){

    if(!lista.length){

        listaTrabajos.innerHTML = `
            <div class="message">
                Todavía no hay trabajos cargados.
            </div>
        `;

        return;
    }


    listaTrabajos.innerHTML =
        lista.map(
            function(trabajo){

                return `

                    <article class="job">

                        <div class="job-header">

                            <div>

                                <div class="job-title">
                                    ${escapeHTML(
                                        trabajo.descripcion ||
                                        "Trabajo sin descripción"
                                    )}
                                </div>

                                <small>
                                    Cliente:
                                    ${escapeHTML(
                                        trabajo.clienteId ||
                                        "Sin cliente"
                                    )}
                                </small>

                            </div>

                            <span class="status">
                                ${escapeHTML(
                                    trabajo.estado ||
                                    "Pendiente"
                                )}
                            </span>

                        </div>


                        <div class="job-info">

                            <div>
                                📍
                                ${escapeHTML(
                                    trabajo.lugar ||
                                    "Sin ubicación"
                                )}
                            </div>

                            <div>
                                📅
                                ${escapeHTML(
                                    trabajo.fechaInicio ||
                                    "Sin fecha"
                                )}
                            </div>

                            <div>
                                🧾
                                ${escapeHTML(
                                    trabajo.presupuestoId ||
                                    "Sin presupuesto"
                                )}
                            </div>

                            <div>
                                👤
                                Trabajo de tu empresa
                            </div>

                        </div>

                    </article>

                `;

            }
        ).join("");

}


// ==========================================
// SEGURIDAD HTML
// ==========================================

function escapeHTML(valor){

    return String(valor)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


// ==========================================
// FILTRADO
// ==========================================

window.filtrarTrabajos =
function(){

    const texto =
        document
        .getElementById("buscarTrabajo")
        .value
        .toLowerCase();


    const estado =
        document
        .getElementById("filtroEstado")
        .value;


    const filtrados =
        trabajos.filter(
            function(trabajo){

                const descripcion =
                    (
                        trabajo.descripcion ||
                        ""
                    ).toLowerCase();


                const lugar =
                    (
                        trabajo.lugar ||
                        ""
                    ).toLowerCase();


                const cliente =
                    (
                        trabajo.clienteId ||
                        ""
                    ).toLowerCase();


                const coincideTexto =
                    !texto ||
                    descripcion.includes(texto) ||
                    lugar.includes(texto) ||
                    cliente.includes(texto);


                const coincideEstado =
                    !estado ||
                    trabajo.estado === estado;


                return (
                    coincideTexto &&
                    coincideEstado
                );

            }
        );


    mostrarTrabajos(filtrados);

};


// ==========================================
// COMPATIBILIDAD CON EL HTML
// ==========================================

window.mostrarTrabajos =
    mostrarTrabajos;
