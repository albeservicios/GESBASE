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
            "GESBASE: usuario autenticado",
            usuarioActual.uid
        );


        try{

            await cargarClientes();

            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "Error inicializando Trabajos:",
                error
            );

            mostrarError(
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


    if(!clienteSelect){
        return;
    }


    try{

        clienteSelect.innerHTML = `
            <option value="">
                Cargando clientes...
            </option>
        `;


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
         * Si no encontró por uid,
         * probamos empresaId.
         */

        if(clientes.length === 0){

            try{

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

                        clientes.push({

                            id:
                                documento.id,

                            ...documento.data()

                        });

                    }
                );

            }
            catch(errorEmpresa){

                console.warn(
                    "No se pudo consultar empresaId:",
                    errorEmpresa
                );

            }

        }


        clientes.sort(
            function(a,b){

                return obtenerNombreCliente(a)
                    .localeCompare(
                        obtenerNombreCliente(b),
                        "es"
                    );

            }
        );


        mostrarClientes();


        console.log(
            "Clientes cargados:",
            clientes.length
        );

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
// NOMBRE DEL CLIENTE
// ==========================================

function obtenerNombreCliente(
    cliente
){

    if(!cliente){

        return "Cliente sin nombre";

    }


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


    if(cliente.empresa){

        return String(
            cliente.empresa
        );

    }


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
// CAMBIO DE CLIENTE
// ==========================================

if(clienteSelect){

    clienteSelect.addEventListener(
        "change",
        async function(){

            await cargarPresupuestos(
                clienteSelect.value
            );

        }
    );

}


// ==========================================
// PRESUPUESTOS
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


                opcion.textContent =
                    presupuesto.numero ||
                    presupuesto.titulo ||
                    presupuesto.descripcion ||
                    presupuesto.concepto ||
                    "Presupuesto";


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


    if(!listaTrabajos){
        return;
    }


    try{

        listaTrabajos.innerHTML = `
            <div class="message">
                Cargando trabajos...
            </div>
        `;


        const referencia =
            collection(
                db,
                "trabajos"
            );


        /*
         * IMPORTANTE:
         * No usamos orderBy aquí.
         * Ordenamos después en JavaScript.
         */

        const consulta =
            query(
                referencia,
                where(
                    "empresaId",
                    "==",
                    usuarioActual.uid
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


        /*
         * Ordenar por fecha de creación
         */

        trabajos.sort(
            function(a,b){

                const fechaA =
                    a.fechaCreacion?.seconds ||
                    0;


                const fechaB =
                    b.fechaCreacion?.seconds ||
                    0;


                return fechaB - fechaA;

            }
        );


        console.log(
            "Trabajos cargados:",
            trabajos.length
        );


        mostrarTrabajos(
            trabajos
        );

    }
    catch(error){

        console.error(
            "ERROR CARGANDO TRABAJOS:",
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
// FILTRAR
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


                return (

                    (
                        !texto ||
                        descripcion.includes(
                            texto
                        ) ||
                        lugar.includes(
                            texto
                        ) ||
                        nombreCliente.includes(
                            texto
                        )
                    )

                    &&

                    (
                        !estado ||
                        trabajo.estado === estado
                    )

                );

            }
        );


    mostrarTrabajos(
        filtrados
    );

};


// ==========================================
// ERROR
// ==========================================

function mostrarError(error){

    if(!listaTrabajos){
        return;
    }


    listaTrabajos.innerHTML = `
        <div class="message">

            Ocurrió un error al cargar Trabajos.

            <br><br>

            ${escapeHTML(
                error?.message ||
                "Error desconocido"
            )}

        </div>
    `;

}


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
    .
