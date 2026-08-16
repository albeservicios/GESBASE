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
// ==========================================

let usuarioActual = null;

let trabajos = [];

let clientes = [];

let presupuestos = [];


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


        try{

            await cargarClientes();

            await cargarTrabajos();

        }catch(error){

            console.error(
                "Error inicializando Trabajos:",
                error
            );

        }

    }
);


// ==========================================
// CARGAR CLIENTES
// ==========================================

async function cargarClientes(){

    if(!usuarioActual){
        return;
    }


    try{

        const referencia =
            collection(
                db,
                "clientes"
            );


        const consulta =
            query(
                referencia,
                where(
                    "uid",
                    "==",
                    usuarioActual.uid
                )
            );


        const resultado =
            await getDocs(
                consulta
            );


        clientes = [];


        resultado.forEach(
            function(documento){

                clientes.push({

                    id:
                        documento.id,

                    ...documento.data()

                });

            }
        );


        // ==================================
        // ORDENAR CLIENTES
        // ==================================

        clientes.sort(
            function(a,b){

                const nombreA =
                    String(
                        a.nombre ||
                        a.empresa ||
                        ""
                    ).toLowerCase();


                const nombreB =
                    String(
                        b.nombre ||
                        b.empresa ||
                        ""
                    ).toLowerCase();


                return nombreA.localeCompare(
                    nombreB,
                    "es"
                );

            }
        );


        cargarClientesEnSelect();


    }catch(error){

        console.error(
            "Error cargando clientes:",
            error
        );


        if(clienteSelect){

            clienteSelect.innerHTML = `
                <option value="">
                    Error cargando clientes
                </option>
            `;

        }

    }

}


// ==========================================
// MOSTRAR CLIENTES EN SELECT
// ==========================================

function cargarClientesEnSelect(){

    if(!clienteSelect){
        return;
    }


    clienteSelect.innerHTML = `

        <option value="">
            Seleccionar cliente
        </option>

    `;


    if(!clientes.length){

        clienteSelect.innerHTML += `

            <option value="" disabled>
                No hay clientes registrados
            </option>

        `;

        return;
    }


    clientes.forEach(
        function(cliente){

            const nombre =
                cliente.nombre ||
                cliente.empresa ||
                "Cliente sin nombre";


            const opcion =
                document.createElement(
                    "option"
                );


            opcion.value =
                cliente.id;


            opcion.textContent =
                nombre;


            clienteSelect.appendChild(
                opcion
            );

        }
    );

}


// ==========================================
// CAMBIO DE CLIENTE
// ==========================================

if(clienteSelect){

    clienteSelect.addEventListener(
        "change",
        async function(){

            const clienteId =
                clienteSelect.value;


            await cargarPresupuestos(
                clienteId
            );

        }
    );

}


// ==========================================
// CARGAR PRESUPUESTOS DEL CLIENTE
// ==========================================

async function cargarPresupuestos(
    clienteId
){

    if(!presupuestoSelect){
        return;
    }


    presupuestoSelect.innerHTML = `

        <option value="">
            Sin presupuesto asociado
        </option>

    `;


    if(!clienteId){

        return;

    }


    if(!usuarioActual){

        return;

    }


    try{

        const referencia =
            collection(
                db,
                "presupuestos"
            );


        const consulta =
            query(
                referencia,
                where(
                    "uid",
                    "==",
                    usuarioActual.uid
                ),
                where(
                    "clienteId",
                    "==",
                    clienteId
                )
            );


        const resultado =
            await getDocs(
                consulta
            );


        presupuestos = [];


        resultado.forEach(
            function(documento){

                presupuestos.push({

                    id:
                        documento.id,

                    ...documento.data()

                });

            }
        );


        // ==================================
        // ORDENAR
        // ==================================

        presupuestos.sort(
            function(a,b){

                const fechaA =
                    String(
                        a.fecha ||
                        a.fechaCreacion ||
                        ""
                    );


                const fechaB =
                    String(
                        b.fecha ||
                        b.fechaCreacion ||
                        ""
                    );


                return fechaB.localeCompare(
                    fechaA
                );

            }
        );


        presupuestos.forEach(
            function(presupuesto){

                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    presupuesto.id;


                const titulo =
                    presupuesto.numero ||
                    presupuesto.titulo ||
                    presupuesto.descripcion ||
                    presupuesto.concepto ||
                    "Presupuesto";


                opcion.textContent =
                    titulo;


                presupuestoSelect.appendChild(
                    opcion
                );

            }
        );


    }catch(error){

        console.error(
            "Error cargando presupuestos:",
            error
        );

        presupuestoSelect.innerHTML = `

            <option value="">
                Sin presupuesto asociado
            </option>

        `;

    }

}


// ==========================================
// CARGAR TRABAJOS
// ==========================================

async function cargarTrabajos(){

    if(!usuarioActual){
        return;
    }


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
            await getDocs(
                consulta
            );


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


        mostrarTrabajos(
            trabajos
        );


    }catch(error){

        console.error(
            "Error cargando trabajos:",
            error
        );


        listaTrabajos.innerHTML = `

            <div class="message">

                No se pudieron cargar los trabajos.

                <br><br>

                ${escapeHTML(
                    error.message
                )}

            </div>

        `;

    }

}


// ==========================================
// OBTENER NOMBRE DEL CLIENTE
// ==========================================

function obtenerNombreCliente(
    clienteId
){

    if(!clienteId){

        return "Sin cliente";

    }


    const cliente =
        clientes.find(
            function(item){

                return item.id === clienteId;

            }
        );


    if(!cliente){

        return "Cliente";

    }


    return (
        cliente.nombre ||
        cliente.empresa ||
        "Cliente sin nombre"
    );

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


            if(!clienteId){

                alert(
                    "Seleccioná un cliente."
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
                            clienteId,

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


                // Limpiar presupuestos
                if(presupuestoSelect){

                    presupuestoSelect.innerHTML = `

                        <option value="">
                            Sin presupuesto asociado
                        </option>

                    `;

                }


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

                const nombreCliente =
                    obtenerNombreCliente(
                        trabajo.clienteId
                    );


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

                                    👤 Cliente:

                                    ${escapeHTML(
                                        nombreCliente
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

                                ${
                                    trabajo.presupuestoId
                                    ?
                                    "Presupuesto asociado"
                                    :
                                    "Sin presupuesto"
                                }

                            </div>


                            <div>

                                📅 Finalización:

                                ${escapeHTML(
                                    trabajo.fechaFin ||
                                    "Sin fecha"
                                )}

                            </div>

                        </div>


                        ${
                            trabajo.observaciones
                            ?
                            `
                            <div
                                style="
                                    margin-top:12px;
                                    padding-top:12px;
                                    border-top:1px solid #e5e7eb;
                                    color:#4b5563;
                                    font-size:14px;
                                "
                            >

                                📝

                                ${escapeHTML(
                                    trabajo.observaciones
                                )}

                            </div>
                            `
                            :
                            ""
                        }

                    </article>

                `;

            }
        ).join("");

}


// ==========================================
// SEGURIDAD HTML
// ==========================================

function escapeHTML(valor){

    return String(valor ?? "")
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


// ==========================================
// FILTRADO
// ==========================================

window.filtrarTrabajos =
function(){

    const texto =
        document
        .getElementById(
            "buscarTrabajo"
        )
        .value
        .toLowerCase()
        .trim();


    const estado =
        document
        .getElementById(
            "filtroEstado"
        )
        .value;


    const filtrados =
        trabajos.filter(
            function(trabajo){

                const descripcion =
                    String(
                        trabajo.descripcion ||
                        ""
                    ).toLowerCase();


                const lugar =
                    String(
                        trabajo.lugar ||
                        ""
                    ).toLowerCase();


                const cliente =
                    obtenerNombreCliente(
                        trabajo.clienteId
                    ).toLowerCase();


                const coincideTexto =
                    !texto ||
                    descripcion.includes(
                        texto
                    ) ||
                    lugar.includes(
                        texto
                    ) ||
                    cliente.includes(
                        texto
                    );


                const coincideEstado =
                    !estado ||
                    trabajo.estado === estado;


                return (
                    coincideTexto &&
                    coincideEstado
                );

            }
        );


    mostrarTrabajos(
        filtrados
    );

};


// ==========================================
// COMPATIBILIDAD CON EL HTML
// ==========================================

window.mostrarTrabajos =
    mostrarTrabajos;
