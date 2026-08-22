// ==========================================
// GESBASE - TRABAJOS
// Relación CLIENTE → PRESUPUESTO → TRABAJO
// ==========================================

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ==========================================
// VARIABLES
// ==========================================

let usuarioActual = null;

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

function mostrarFormulario(){

    const formularioTrabajo =
        document.getElementById("formularioTrabajo");

    if(formularioTrabajo){

        formularioTrabajo.classList.remove("hidden");

    }

}


function ocultarFormulario(){

    const formularioTrabajo =
        document.getElementById("formularioTrabajo");

    if(formularioTrabajo){

        formularioTrabajo.classList.add("hidden");

    }

}


// ==========================================
// MENSAJE
// ==========================================

function mostrarMensaje(texto, tipo = "info"){

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
                collection(db, "clientes")
            );

        clientes = [];

        clienteSelect.innerHTML = `
            <option value="">
                Seleccionar cliente
            </option>
        `;

        snapshot.forEach((documento) => {

            const datos =
                documento.data();

            /*
             * Solo clientes de la empresa
             */

            if(
                datos.uid !== usuarioActual.uid &&
                datos.empresaId !== usuarioActual.uid
            ){

                return;

            }

            const nombre =
                [
                    datos.nombre,
                    datos.apellido
                ]
                .filter(Boolean)
                .join(" ");

            const nombreFinal =
                nombre ||
                datos.empresa ||
                datos.razonSocial ||
                datos.razon_social ||
                "Cliente";


            clientes.push({

                id: documento.id,

                nombre: nombreFinal,

                datos: datos

            });


            const opcion =
                document.createElement("option");

            opcion.value =
                documento.id;

            opcion.textContent =
                nombreFinal;

            clienteSelect.appendChild(
                opcion
            );

        });

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
// NOMBRE DEL CLIENTE
// ==========================================

function obtenerNombreCliente(clienteId){

    const cliente =
        clientes.find(
            item =>
                item.id === clienteId
        );

    return cliente
        ? cliente.nombre
        : "Sin cliente";

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
                collection(db, "presupuestos")
            );

        presupuestos = [];

        presupuestoSelect.innerHTML = `
            <option value="">
                Sin presupuesto asociado
            </option>
        `;


        snapshot.forEach((documento) => {

            const datos =
                documento.data();


            /*
             * IMPORTANTE:
             *
             * Aceptamos las estructuras
             * que venimos utilizando.
             */

            if(
                datos.usuarioId !== usuarioActual.uid &&
                datos.empresaId !== usuarioActual.uid &&
                datos.uid !== usuarioActual.uid
            ){

                return;

            }


            const clienteId =
                datos.clienteId ||
                datos.cliente ||
                "";


            const numero =
                datos.numero ||
                datos.numeroPresupuesto ||
                datos.codigo ||
                "";


            const descripcion =
                datos.descripcion ||
                datos.titulo ||
                datos.concepto ||
                "Presupuesto";


            const total =
                Number(
                    datos.total ||
                    datos.totalFinal ||
                    datos.importe ||
                    datos.monto ||
                    0
                );


            const item = {

                id: documento.id,

                clienteId: clienteId,

                numero: numero,

                descripcion: descripcion,

                total: total,

                datos: datos

            };


            presupuestos.push(
                item
            );


            /*
             * Texto que aparece
             * en el selector.
             */

            let texto =
                "";


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
                document.createElement("option");

            opcion.value =
                documento.id;

            opcion.textContent =
                texto;

            /*
             * Guardamos también el cliente
             * como atributo para poder
             * relacionarlo automáticamente.
             */

            opcion.dataset.clienteId =
                clienteId;


            presupuestoSelect.appendChild(
                opcion
            );

        });


        if(
            presupuestos.length === 0
        ){

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
// RELACIONAR AUTOMÁTICAMENTE CLIENTE
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
                item =>
                    item.id === presupuestoId
            );


        if(
            !presupuesto ||
            !presupuesto.clienteId
        ){

            return;

        }


        /*
         * Si el presupuesto tiene cliente,
         * seleccionamos automáticamente
         * ese mismo cliente.
         */

        const existeCliente =
            clientes.some(
                item =>
                    item.id === presupuesto.clienteId
            );


        if(existeCliente){

            clienteSelect.value =
                presupuesto.clienteId;

        }

    }
);


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
                collection(db, "trabajos")
            );


        trabajos = [];


        snapshot.forEach((documento) => {

            const datos =
                documento.data();


            if(
                datos.empresaId !== usuarioActual.uid &&
                datos.usuarioId !== usuarioActual.uid &&
                datos.uid !== usuarioActual.uid
            ){

                return;

            }


            trabajos.push({

                id: documento.id,

                ...datos

            });

        });


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
            </div>
        `;

    }

}


// ==========================================
// NOMBRE DEL PRESUPUESTO
// ==========================================

function obtenerNombrePresupuesto(
    presupuestoId
){

    if(!presupuestoId){

        return "Sin presupuesto asociado";

    }


    const presupuesto =
        presupuestos.find(
            item =>
                item.id === presupuestoId
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

function mostrarTrabajos(
    lista
){

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
                document.createElement("article");


            elemento.className =
                "job";


            const cliente =
                obtenerNombreCliente(
                    trabajo.clienteId
                );


            const presupuesto =
                obtenerNombrePresupuesto(
                    trabajo.presupuestoId
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
                        <strong>Cliente:</strong>
                        ${escapar(cliente)}
                    </div>


                    <div>
                        <strong>Presupuesto:</strong>
                        ${escapar(presupuesto)}
                    </div>


                    <div>
                        <strong>Lugar:</strong>
                        ${escapar(
                            trabajo.lugar ||
                            "No indicado"
                        )}
                    </div>


                    <div>
                        <strong>Fecha inicio:</strong>
                        ${escapar(
                            trabajo.fechaInicio ||
                            "No indicada"
                        )}
                    </div>


                    <div>
                        <strong>Fecha fin:</strong>
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
                            <strong>Observaciones:</strong><br>
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
                    .toLowerCase();


                const coincideTexto =
                    !texto ||
                    contenido.includes(texto);


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


        /*
         * Si se seleccionó un presupuesto
         * y ese presupuesto tiene cliente,
         * usamos automáticamente ese cliente.
         */

        let clienteFinal =
            clienteId;


        if(presupuestoId){

            const presupuesto =
                presupuestos.find(
                    item =>
                        item.id === presupuestoId
                );


            if(
                presupuesto &&
                presupuesto.clienteId
            ){

                clienteFinal =
                    presupuesto.clienteId;

            }

        }


        try{

            const datosTrabajo = {

                usuarioId:
                    usuarioActual.uid,

                empresaId:
                    usuarioActual.uid,

                clienteId:
                    clienteFinal || "",

                /*
                 * ESTA ES LA RELACIÓN CLAVE
                 */

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


            /*
             * Volvemos a dejar
             * el selector de presupuesto
             * en su estado inicial.
             */

            presupuestoSelect.value =
                "";


            clienteSelect.value =
                "";


            ocultarFormulario();


            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "Error guardando trabajo:",
                error
            );


            mostrarMensaje(
                "No se pudo guardar el trabajo: " +
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


        try{

            /*
             * Primero clientes.
             */

            await cargarClientes();


            /*
             * Después presupuestos.
             */

            await cargarPresupuestos();


            /*
             * Finalmente trabajos.
             */

            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "Error inicializando Trabajos:",
                error
            );

            listaTrabajos.innerHTML = `
                <div class="message">
                    No se pudo inicializar el módulo Trabajos.
                </div>
            `;

        }

    }
);
