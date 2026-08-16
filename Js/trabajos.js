import {
    auth,
    db
} from "./firebase.js";

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

        console.log(
            "GESBASE - Usuario:",
            usuarioActual.uid
        );

        await cargarClientes();

        await cargarTrabajos();

    }
);


// ==========================================
// CARGAR CLIENTES
// ==========================================

async function cargarClientes(){

    if(!usuarioActual){
        return;
    }

    if(!clienteSelect){
        return;
    }

    try{

        clienteSelect.innerHTML = `
            <option value="">
                Cargando clientes...
            </option>
        `;


        /*
         * Primero intentamos la misma estructura
         * que utiliza clientes.html:
         *
         * uid == usuarioActual.uid
         */

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


        /*
         * Si no encontró clientes mediante uid,
         * probamos empresaId.
         */

        if(clientes.length === 0){

            console.log(
                "No se encontraron clientes mediante uid. Probando empresaId..."
            );


            const consultaEmpresa =
                query(
                    referencia,
                    where(
                        "empresaId",
                        "==",
                        usuarioActual.uid
                    )
                );


            const resultadoEmpresa =
                await getDocs(
                    consultaEmpresa
                );


            resultadoEmpresa.forEach(
                function(documento){

                    const existe =
                        clientes.some(
                            function(cliente){

                                return (
                                    cliente.id ===
                                    documento.id
                                );

                            }
                        );


                    if(!existe){

                        clientes.push({

                            id:
                                documento.id,

                            ...documento.data()

                        });

                    }

                }
            );

        }


        /*
         * ORDEN ALFABÉTICO
         */

        clientes.sort(
            function(a,b){

                const nombreA =
                    obtenerNombreCliente(
                        a
                    ).toLowerCase();


                const nombreB =
                    obtenerNombreCliente(
                        b
                    ).toLowerCase();


                return nombreA.localeCompare(
                    nombreB,
                    "es"
                );

            }
        );


        console.log(
            "GESBASE - Clientes encontrados:",
            clientes
        );


        mostrarClientes();


    }
    catch(error){

        console.error(
            "ERROR CARGANDO CLIENTES:",
            error
        );


        clienteSelect.innerHTML = `
            <option value="">
                Error cargando clientes
            </option>
        `;


        alert(
            "No se pudieron cargar los clientes.\n\n" +
            error.message
        );

    }

}


// ==========================================
// NOMBRE DEL CLIENTE
// ==========================================

function obtenerNombreCliente(
    cliente
){

    if(!cliente){

        return "Cliente sin nombre";

    }


    /*
     * Nombre completo
     */

    const nombre =
        String(
            cliente.nombre ||
            ""
        ).trim();


    const apellido =
        String(
            cliente.apellido ||
            ""
        ).trim();


    if(nombre || apellido){

        return (
            nombre +
            (
                nombre &&
                apellido
                ? " "
                : ""
            ) +
            apellido
        ).trim();

    }


    /*
     * Empresa
     */

    if(cliente.empresa){

        return String(
            cliente.empresa
        );

    }


    /*
     * Razón social
     */

    if(cliente.razonSocial){

        return String(
            cliente.razonSocial
        );

    }


    if(cliente.razon_social){

        return String(
            cliente.razon_social
        );

    }


    return "Cliente sin nombre";

}


// ==========================================
// MOSTRAR CLIENTES
// ==========================================

function mostrarClientes(){

    if(!clienteSelect){
        return;
    }


    clienteSelect.innerHTML = `
        <option value="">
            Seleccionar cliente
        </option>
    `;


    if(clientes.length === 0){

        clienteSelect.innerHTML += `
            <option value="" disabled>
                No hay clientes registrados
            </option>
        `;

        return;
    }


    clientes.forEach(
        function(cliente){

            const opcion =
                document.createElement(
                    "option"
                );


            opcion.value =
                cliente.id;


            opcion.textContent =
                obtenerNombreCliente(
                    cliente
                );


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


            console.log(
                "Cliente seleccionado:",
                clienteId
            );


            await cargarPresupuestos(
                clienteId
            );

        }
    );

}


// ==========================================
// CARGAR PRESUPUESTOS
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


    }
    catch(error){

        console.error(
            "Error cargando presupuestos:",
            error
        );

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


    }
    catch(error){

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

            }
            catch(error){

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

function mostrarTrabajos(
    lista
){

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

                const cliente =
                    clientes.find(
                        function(item){

                            return (
                                item.id ===
                                trabajo.clienteId
                            );

                        }
                    );


                const nombreCliente =
                    obtenerNombreCliente(
                        cliente
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

                                📅 Inicio:

                                ${escapeHTML(
                                    trabajo.fechaInicio ||
                                    "Sin fecha"
                                )}

                            </div>


                            <div>

                                🧾 Presupuesto:

                                ${
                                    trabajo.presupuestoId
                                    ?
                                    "Asociado"
                                    :
                                    "Sin presupuesto"
                                }

                            </div>


                            <div>

                                📅 Fin:

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
// FILTRAR TRABAJOS
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
                    clientes.find(
                        function(item){

                            return (
                                item.id ===
                                trabajo.clienteId
                            );

                        }
                    );


                const nombreCliente =
                    obtenerNombreCliente(
                        cliente
                    ).toLowerCase();


                const coincideTexto =
                    !texto ||
                    descripcion.includes(
                        texto
                    ) ||
                    lugar.includes(
                        texto
                    ) ||
                    nombreCliente.includes(
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
// SEGURIDAD HTML
// ==========================================

function escapeHTML(
    valor
){

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


// ==========================================
// COMPATIBILIDAD
// ==========================================

window.mostrarTrabajos =
    mostrarTrabajos;
