// ==========================================
// GESBASE - TRABAJOS
// CLIENTE → PRESUPUESTO → TRABAJO
// VERSIÓN CORREGIDA
// ==========================================

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ==========================================
// VARIABLES
// ==========================================

let usuarioActual = null;

let empresaActual = "";

let clientes = [];

let presupuestos = [];

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
// FORMULARIO
// ==========================================

window.mostrarFormulario = function(){

    const formularioTrabajo =
        document.getElementById("formularioTrabajo");

    if(formularioTrabajo){

        formularioTrabajo.classList.remove("hidden");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

};


window.ocultarFormulario = function(){

    const formularioTrabajo =
        document.getElementById("formularioTrabajo");

    if(formularioTrabajo){

        formularioTrabajo.classList.add("hidden");

    }

};


// ==========================================
// VOLVER AL PANEL
// ==========================================

window.volverPanel = function(){

    window.location.href =
        "index.html";

};


// ==========================================
// MENSAJE
// ==========================================

function mostrarMensaje(texto){

    alert(texto);

}


// ==========================================
// ESCAPAR HTML
// ==========================================

function escapar(valor){

    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ==========================================
// OBTENER EMPRESA
// ==========================================

function obtenerEmpresaId(datos){

    return String(
        datos?.empresaId ||
        datos?.idEmpresa ||
        datos?.empresaID ||
        datos?.empresa ||
        ""
    ).trim();

}


// ==========================================
// COMPROBAR PROPIEDAD
// ==========================================

function perteneceAlUsuario(datos){

    if(!usuarioActual){
        return false;
    }

    const uid =
        usuarioActual.uid;

    const empresaId =
        empresaActual;


    // --------------------------------------
    // 1. PERTENECE DIRECTAMENTE AL USUARIO
    // --------------------------------------

    if(
        datos.usuarioId === uid ||
        datos.uid === uid ||
        datos.ownerId === uid ||
        datos.creadoPor === uid ||
        datos.usuario === uid
    ){

        return true;

    }


    // --------------------------------------
    // 2. PERTENECE A LA EMPRESA
    // --------------------------------------

    if(
        empresaId &&
        (
            datos.empresaId === empresaId ||
            datos.idEmpresa === empresaId ||
            datos.empresaID === empresaId
        )
    ){

        return true;

    }


    return false;

}


// ==========================================
// CARGAR CLIENTES
// ==========================================

async function cargarClientes(){

    clienteSelect.innerHTML = `
        <option value="">
            Cargando clientes...
        </option>
    `;

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "clientes"
                )
            );


        clientes = [];


        clienteSelect.innerHTML = `
            <option value="">
                Seleccionar cliente
            </option>
        `;


        snapshot.forEach(
            function(documento){

                const datos =
                    documento.data();


                if(
                    !perteneceAlUsuario(datos)
                ){

                    return;

                }


                const nombreCompleto =
                    [
                        datos.nombre,
                        datos.apellido
                    ]
                    .filter(Boolean)
                    .join(" ")
                    .trim();


                const nombreFinal =
                    nombreCompleto ||
                    datos.empresa ||
                    datos.nombreEmpresa ||
                    datos.razonSocial ||
                    datos.razon_social ||
                    "Cliente";


                clientes.push({

                    id:
                        documento.id,

                    nombre:
                        nombreFinal,

                    datos:
                        datos

                });


                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    documento.id;


                opcion.textContent =
                    nombreFinal;


                clienteSelect.appendChild(
                    opcion
                );

            }
        );


        if(!clientes.length){

            clienteSelect.innerHTML = `
                <option value="">
                    No hay clientes registrados
                </option>
            `;

        }

    }
    catch(error){

        console.error(
            "Error cargando clientes:",
            error
        );


        clienteSelect.innerHTML = `
            <option value="">
                Error cargando clientes
            </option>
        `;

    }

}


// ==========================================
// OBTENER NOMBRE CLIENTE
// ==========================================

function obtenerNombreCliente(clienteId){

    if(!clienteId){

        return "Sin cliente";

    }


    const cliente =
        clientes.find(
            function(item){

                return item.id === clienteId;

            }
        );


    return cliente
        ? cliente.nombre
        : "Cliente asociado";

}


// ==========================================
// FORMATO MONEDA
// ==========================================

function formatoMoneda(valor){

    return Number(
        valor || 0
    ).toLocaleString(
        "es-AR",
        {
            style: "currency",
            currency: "ARS"
        }
    );

}


// ==========================================
// OBTENER CLIENTE DEL PRESUPUESTO
// ==========================================

function obtenerClienteDelPresupuesto(datos){

    return (
        datos.clienteId ||
        datos.idCliente ||
        datos.clienteID ||
        datos.cliente_id ||
        ""
    );

}


// ==========================================
// CARGAR PRESUPUESTOS
// ==========================================

async function cargarPresupuestos(){

    presupuestoSelect.innerHTML = `
        <option value="">
            Cargando presupuestos...
        </option>
    `;


    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "presupuestos"
                )
            );


        presupuestos = [];


        presupuestoSelect.innerHTML = `
            <option value="">
                Sin presupuesto asociado
            </option>
        `;


        snapshot.forEach(
            function(documento){

                const datos =
                    documento.data();


                if(
                    !perteneceAlUsuario(datos)
                ){

                    return;

                }


                const clienteId =
                    obtenerClienteDelPresupuesto(
                        datos
                    );


                const numero =
                    datos.numero ||
                    datos.numeroPresupuesto ||
                    datos.codigo ||
                    datos.nro ||
                    "";


                const descripcion =
                    datos.descripcion ||
                    datos.titulo ||
                    datos.concepto ||
                    datos.detalle ||
                    "Presupuesto";


                const total =
                    Number(
                        datos.total ??
                        datos.totalFinal ??
                        datos.importe ??
                        datos.monto ??
                        0
                    );


                const item = {

                    id:
                        documento.id,

                    clienteId:
                        clienteId,

                    numero:
                        numero,

                    descripcion:
                        descripcion,

                    total:
                        total,

                    datos:
                        datos

                };


                presupuestos.push(
                    item
                );


                let texto = "";


                if(numero){

                    texto +=
                        "N.º " +
                        numero +
                        " — ";

                }


                texto +=
                    descripcion;


                if(total > 0){

                    texto +=
                        " — " +
                        formatoMoneda(total);

                }


                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    documento.id;


                opcion.textContent =
                    texto;


                opcion.dataset.clienteId =
                    clienteId;


                presupuestoSelect.appendChild(
                    opcion
                );

            }
        );


        if(!presupuestos.length){

            presupuestoSelect.innerHTML = `
                <option value="">
                    No hay presupuestos disponibles
                </option>
            `;

        }

    }
    catch(error){

        console.error(
            "Error cargando presupuestos:",
            error
        );


        presupuestoSelect.innerHTML = `
            <option value="">
                Error cargando presupuestos
            </option>
        `;

    }

}


// ==========================================
// CAMBIO DE PRESUPUESTO
// ==========================================

presupuestoSelect.addEventListener(
    "change",
    function(){

        const presupuestoId =
            this.value;


        if(!presupuestoId){

            return;

        }


        const presupuesto =
            presupuestos.find(
                function(item){

                    return (
                        item.id ===
                        presupuestoId
                    );

                }
            );


        if(
            !presupuesto ||
            !presupuesto.clienteId
        ){

            return;

        }


        const clienteExiste =
            clientes.some(
                function(item){

                    return (
                        item.id ===
                        presupuesto.clienteId
                    );

                }
            );


        if(clienteExiste){

            clienteSelect.value =
                presupuesto.clienteId;

        }

    }
);


// ==========================================
// OBTENER CLIENTE ID DEL TRABAJO
// ==========================================

function obtenerClienteDelTrabajo(trabajo){

    return (
        trabajo.clienteId ||
        trabajo.idCliente ||
        trabajo.clienteID ||
        trabajo.cliente_id ||
        ""
    );

}


// ==========================================
// OBTENER PRESUPUESTO ID DEL TRABAJO
// ==========================================

function obtenerPresupuestoDelTrabajo(trabajo){

    return (
        trabajo.presupuestoId ||
        trabajo.idPresupuesto ||
        trabajo.presupuestoID ||
        trabajo.presupuesto_id ||
        ""
    );

}


// ==========================================
// CARGAR TRABAJOS
// ==========================================

async function cargarTrabajos(){

    listaTrabajos.innerHTML = `
        <div class="message">
            Cargando trabajos...
        </div>
    `;


    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "trabajos"
                )
            );


        trabajos = [];


        snapshot.forEach(
            function(documento){

                const datos =
                    documento.data();


                console.log(
                    "Trabajo encontrado:",
                    documento.id,
                    datos
                );


                if(
                    !perteneceAlUsuario(datos)
                ){

                    return;

                }


                trabajos.push({

                    id:
                        documento.id,

                    ...datos,

                    clienteId:
                        obtenerClienteDelTrabajo(
                            datos
                        ),

                    presupuestoId:
                        obtenerPresupuestoDelTrabajo(
                            datos
                        )

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
                ${escapar(
                    error.message
                )}
            </div>
        `;

    }

}


// ==========================================
// NOMBRE PRESUPUESTO
// ==========================================

function obtenerNombrePresupuesto(
    presupuestoId
){

    if(!presupuestoId){

        return "Sin presupuesto asociado";

    }


    const presupuesto =
        presupuestos.find(
            function(item){

                return (
                    item.id ===
                    presupuestoId
                );

            }
        );


    if(!presupuesto){

        return "Presupuesto asociado";

    }


    let texto = "";


    if(presupuesto.numero){

        texto =
            "N.º " +
            presupuesto.numero +
            " — ";

    }


    texto +=
        presupuesto.descripcion;


    return texto;

}


// ==========================================
// MOSTRAR TRABAJOS
// ==========================================

function mostrarTrabajos(lista){

    if(!lista.length){

        listaTrabajos.innerHTML = `
            <div class="message">
                Todavía no hay trabajos registrados.
            </div>
        `;

        return;

    }


    listaTrabajos.innerHTML = "";


    lista.forEach(
        function(trabajo){

            const elemento =
                document.createElement(
                    "article"
                );


            elemento.className =
                "job";


            const clienteId =
                trabajo.clienteId;


            const presupuestoId =
                trabajo.presupuestoId;


            const cliente =
                obtenerNombreCliente(
                    clienteId
                );


            const presupuesto =
                obtenerNombrePresupuesto(
                    presupuestoId
                );


            elemento.innerHTML = `

                <div class="job-header">

                    <div>

                        <div class="job-title">

                            ${escapar(
                                trabajo.descripcion ||
                                "Trabajo sin descripción"
                            )}

                        </div>

                    </div>


                    <span class="status">

                        ${escapar(
                            trabajo.estado ||
                            "Pendiente"
                        )}

                    </span>

                </div>


                <div class="job-info">

                    <div>

                        <strong>
                            Cliente:
                        </strong>

                        ${escapar(cliente)}

                    </div>


                    <div>

                        <strong>
                            Presupuesto:
                        </strong>

                        ${escapar(presupuesto)}

                    </div>


                    <div>

                        <strong>
                            Lugar:
                        </strong>

                        ${escapar(
                            trabajo.lugar ||
                            "No indicado"
                        )}

                    </div>


                    <div>

                        <strong>
                            Fecha inicio:
                        </strong>

                        ${escapar(
                            trabajo.fechaInicio ||
                            "No indicada"
                        )}

                    </div>


                    <div>

                        <strong>
                            Fecha fin:
                        </strong>

                        ${escapar(
                            trabajo.fechaFin ||
                            "No indicada"
                        )}

                    </div>

                </div>


                ${
                    trabajo.observaciones
                    ? `
                        <div style="
                            margin-top:12px;
                            color:#6b7280;
                            font-size:14px;
                        ">

                            <strong>
                                Observaciones:
                            </strong>

                            <br>

                            ${escapar(
                                trabajo.observaciones
                            )}

                        </div>
                    `
                    : ""
                }

            `;


            listaTrabajos.appendChild(
                elemento
            );

        }
    );

}


// ==========================================
// FILTROS
// ==========================================

window.filtrarTrabajos =
function(){

    const input =
        document.getElementById(
            "buscarTrabajo"
        );


    const filtro =
        document.getElementById(
            "filtroEstado"
        );


    const texto =
        input
        ? input.value
            .toLowerCase()
            .trim()
        : "";


    const estado =
        filtro
        ? filtro.value
        : "";


    const resultado =
        trabajos.filter(
            function(item){

                const contenido =
                    (
                        item.descripcion ||
                        ""
                    )
                    .toLowerCase() +
                    " " +
                    (
                        item.lugar ||
                        ""
                    )
                    .toLowerCase() +
                    " " +
                    (
                        obtenerNombreCliente(
                            item.clienteId
                        ) || ""
                    )
                    .toLowerCase();


                const coincideTexto =
                    !texto ||
                    contenido.includes(
                        texto
                    );


                const coincideEstado =
                    !estado ||
                    item.estado === estado;


                return (
                    coincideTexto &&
                    coincideEstado
                );

            }
        );


    mostrarTrabajos(
        resultado
    );

};


// ==========================================
// GUARDAR TRABAJO
// ==========================================

formulario.addEventListener(
    "submit",
    async function(event){

        event.preventDefault();


        if(!usuarioActual){

            mostrarMensaje(
                "No hay una sesión activa."
            );

            return;

        }


        const clienteId =
            clienteSelect.value;


        const presupuestoId =
            presupuestoSelect.value;


        const descripcion =
            document
            .getElementById(
                "descripcion"
            )
            .value
            .trim();


        const lugar =
            document
            .getElementById(
                "lugar"
            )
            .value
            .trim();


        const estado =
            document
            .getElementById(
                "estado"
            )
            .value;


        const fechaInicio =
            document
            .getElementById(
                "fechaInicio"
            )
            .value;


        const fechaFin =
            document
            .getElementById(
                "fechaFin"
            )
            .value;


        const observaciones =
            document
            .getElementById(
                "observaciones"
            )
            .value
            .trim();


        if(!descripcion){

            mostrarMensaje(
                "Ingresá la descripción del trabajo."
            );

            return;

        }


        // --------------------------------------
        // CLIENTE DEL PRESUPUESTO
        // --------------------------------------

        let clienteFinal =
            clienteId;


        if(presupuestoId){

            const presupuesto =
                presupuestos.find(
                    function(item){

                        return (
                            item.id ===
                            presupuestoId
                        );

                    }
                );


            if(
                presupuesto &&
                presupuesto.clienteId
            ){

                clienteFinal =
                    presupuesto.clienteId;

            }

        }


        // --------------------------------------
        // DATOS DEL TRABAJO
        // --------------------------------------

        const datosTrabajo = {

            usuarioId:
                usuarioActual.uid,

            uid:
                usuarioActual.uid,

            ownerId:
                usuarioActual.uid,

            creadoPor:
                usuarioActual.uid,

            empresaId:
                empresaActual,

            clienteId:
                clienteFinal || "",

            presupuestoId:
                presupuestoId || "",

            descripcion:
                descripcion,

            lugar:
                lugar,

            estado:
                estado,

            fechaInicio:
                fechaInicio,

            fechaFin:
                fechaFin,

            observaciones:
                observaciones,

            creado:
                serverTimestamp()

        };


        try{

            await addDoc(
                collection(
                    db,
                    "trabajos"
                ),
                datosTrabajo
            );


            mostrarMensaje(
                "Trabajo guardado correctamente."
            );


            formulario.reset();


            clienteSelect.value =
                "";


            presupuestoSelect.value =
                "";


            window.ocultarFormulario();


            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "Error guardando trabajo:",
                error
            );


            mostrarMensaje(
                "No se pudo guardar el trabajo:\n\n" +
                error.message
            );

        }

    }
);


// ==========================================
// INICIO
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


        usuarioActual =
            usuario;


        /*
         * IMPORTANTE:
         *
         * En GESBASE la empresa principal
         * está vinculada al usuario.
         *
         * Por eso usamos el UID como
         * empresaId cuando corresponde.
         */

        empresaActual =
            usuario.uid;


        console.log(
            "GESBASE usuario:",
            usuarioActual.uid
        );


        console.log(
            "GESBASE empresa actual:",
            empresaActual
        );


        try{

            // ------------------------------
            // 1. CLIENTES
            // ------------------------------

            await cargarClientes();


            // ------------------------------
            // 2. PRESUPUESTOS
            // ------------------------------

            await cargarPresupuestos();


            // ------------------------------
            // 3. TRABAJOS
            // ------------------------------

            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "Error inicializando Trabajos:",
                error
            );


            listaTrabajos.innerHTML = `
                <div class="message">
                    No se pudo inicializar
                    el módulo Trabajos.
                    <br><br>
                    ${escapar(
                        error.message
                    )}
                </div>
            `;

        }

    }
);
