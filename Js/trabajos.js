// ==========================================
// GESBASE - TRABAJOS
// VERSIÓN CORREGIDA
// ==========================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ==========================================
// VARIABLES
// ==========================================

let usuarioActual = null;
let empresaIdActual = "";
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
// FUNCIONES DEL HTML
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


window.volverPanel = function(){

    window.location.href = "index.html";

};


window.filtrarTrabajos = function(){

    const input =
        document.getElementById("buscarTrabajo");

    const filtro =
        document.getElementById("filtroEstado");

    const texto =
        input
        ? input.value.toLowerCase().trim()
        : "";

    const estado =
        filtro
        ? filtro.value
        : "";

    const resultado =
        trabajos.filter(trabajo => {

            const descripcion =
                String(
                    trabajo.descripcion || ""
                ).toLowerCase();

            const lugar =
                String(
                    trabajo.lugar || ""
                ).toLowerCase();

            const coincideTexto =
                !texto ||
                descripcion.includes(texto) ||
                lugar.includes(texto);

            const coincideEstado =
                !estado ||
                trabajo.estado === estado;

            return (
                coincideTexto &&
                coincideEstado
            );

        });

    mostrarTrabajos(resultado);

};


// ==========================================
// ESCAPAR HTML
// ==========================================

function escapar(valor){

    return String(valor ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


// ==========================================
// OBTENER EMPRESA
// ==========================================

async function obtenerEmpresa(){

    if(!usuarioActual){
        return "";
    }

    try{

        const referencia =
            await getDocs(
                query(
                    collection(
                        db,
                        "usuarios"
                    ),
                    where(
                        "__name__",
                        "==",
                        usuarioActual.uid
                    )
                )
            );

        if(
            !referencia.empty
        ){

            const datos =
                referencia.docs[0].data();

            return String(
                datos.empresaId ||
                datos.idEmpresa ||
                datos.empresaID ||
                datos.empresa ||
                usuarioActual.uid
            ).trim();

        }

    }
    catch(error){

        console.warn(
            "No se pudo obtener empresa:",
            error
        );

    }

    return usuarioActual.uid;

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

    clientes = [];

    try{

        /*
         * Primero intentamos cargar
         * los clientes de la empresa.
         */

        let snapshot;

        try{

            snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            "clientes"
                        ),
                        where(
                            "empresaId",
                            "==",
                            empresaIdActual
                        )
                    )
                );

        }
        catch(error){

            console.warn(
                "Filtro empresaId falló. Cargando clientes generales.",
                error
            );

            snapshot =
                await getDocs(
                    collection(
                        db,
                        "clientes"
                    )
                );

        }


        clienteSelect.innerHTML = `
            <option value="">
                Seleccionar cliente
            </option>
        `;


        snapshot.forEach(documento => {

            const datos =
                documento.data();

            /*
             * Si el documento tiene empresaId,
             * verificamos que corresponda.
             *
             * Si no tiene empresaId,
             * también lo mostramos para no
             * perder clientes existentes.
             */

            if(
                datos.empresaId &&
                String(datos.empresaId) !==
                String(empresaIdActual)
            ){

                return;

            }


            const nombre =
                [
                    datos.nombre,
                    datos.apellido
                ]
                .filter(Boolean)
                .join(" ")
                .trim();


            const nombreFinal =
                nombre ||
                datos.nombreEmpresa ||
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
            "ERROR CLIENTES:",
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
// CARGAR PRESUPUESTOS
// ==========================================

async function cargarPresupuestos(){

    presupuestoSelect.innerHTML = `
        <option value="">
            Cargando presupuestos...
        </option>
    `;

    presupuestos = [];

    try{

        let snapshot;

        try{

            snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            "presupuestos"
                        ),
                        where(
                            "empresaId",
                            "==",
                            empresaIdActual
                        )
                    )
                );

        }
        catch(error){

            console.warn(
                "Filtro de presupuestos falló.",
                error
            );

            snapshot =
                await getDocs(
                    collection(
                        db,
                        "presupuestos"
                    )
                );

        }


        presupuestoSelect.innerHTML = `
            <option value="">
                Sin presupuesto asociado
            </option>
        `;


        snapshot.forEach(documento => {

            const datos =
                documento.data();


            if(
                datos.empresaId &&
                String(datos.empresaId) !==
                String(empresaIdActual)
            ){

                return;

            }


            const clienteId =
                datos.clienteId ||
                datos.idCliente ||
                datos.clienteID ||
                datos.cliente_id ||
                "";


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


            presupuestos.push({

                id: documento.id,

                clienteId: clienteId,

                numero: numero,

                descripcion: descripcion,

                total: total,

                datos: datos

            });


            let texto = "";


            if(numero){

                texto +=
                    "N.º " +
                    numero +
                    " — ";

            }


            texto += descripcion;


            if(total > 0){

                texto +=
                    " — " +
                    Number(total).toLocaleString(
                        "es-AR",
                        {
                            style:"currency",
                            currency:"ARS"
                        }
                    );

            }


            const opcion =
                document.createElement("option");


            opcion.value =
                documento.id;

            opcion.textContent =
                texto;

            opcion.dataset.clienteId =
                clienteId;


            presupuestoSelect.appendChild(
                opcion
            );

        });


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
            "ERROR PRESUPUESTOS:",
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
// PRESUPUESTO → CLIENTE
// ==========================================

presupuestoSelect.addEventListener(
    "change",
    function(){

        const presupuesto =
            presupuestos.find(
                item =>
                    item.id === this.value
            );


        if(
            presupuesto &&
            presupuesto.clienteId
        ){

            const existe =
                clientes.some(
                    cliente =>
                        cliente.id ===
                        presupuesto.clienteId
                );


            if(existe){

                clienteSelect.value =
                    presupuesto.clienteId;

            }

        }

    }
);


// ==========================================
// OBTENER NOMBRE CLIENTE
// ==========================================

function obtenerNombreCliente(
    clienteId
){

    if(!clienteId){

        return "Sin cliente";

    }


    const cliente =
        clientes.find(
            item =>
                item.id === clienteId
        );


    return cliente
        ? cliente.nombre
        : "Cliente asociado";

}


// ==========================================
// OBTENER NOMBRE PRESUPUESTO
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
// CARGAR TRABAJOS
// ==========================================

async function cargarTrabajos(){

    listaTrabajos.innerHTML = `
        <div class="message">
            Cargando trabajos...
        </div>
    `;

    trabajos = [];

    try{

        /*
         * IMPORTANTE:
         * collection() recibe directamente
         * db + nombre de colección.
         */

        const referencia =
            collection(
                db,
                "trabajos"
            );


        const snapshot =
            await getDocs(
                referencia
            );


        snapshot.forEach(documento => {

            const datos =
                documento.data();


            /*
             * Aceptamos trabajos antiguos
             * y nuevos.
             */

            const perteneceEmpresa =
                !datos.empresaId ||
                String(datos.empresaId) ===
                String(empresaIdActual);


            const perteneceUsuario =
                !datos.usuarioId ||
                String(datos.usuarioId) ===
                String(usuarioActual.uid);


            if(
                !perteneceEmpresa &&
                !perteneceUsuario
            ){

                return;

            }


            trabajos.push({

                id: documento.id,

                ...datos

            });

        });


        /*
         * Ordenar del más reciente
         * al más antiguo.
         */

        trabajos.sort(
            (a,b) => {

                const fechaA =
                    a.creado?.seconds ||
                    a.createdAt?.seconds ||
                    0;

                const fechaB =
                    b.creado?.seconds ||
                    b.createdAt?.seconds ||
                    0;

                return fechaB - fechaA;

            }
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
            <div class="message"
                 style="background:#fee2e2;color:#991b1b;">

                <strong>
                    No se pudieron cargar los trabajos.
                </strong>

                <br><br>

                Código:
                ${escapar(error.code || "sin código")}

                <br>

                ${escapar(error.message || "")}

            </div>
        `;

    }

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


    lista.forEach(trabajo => {

        const elemento =
            document.createElement("article");


        elemento.className =
            "job";


        const cliente =
            obtenerNombreCliente(
                trabajo.clienteId ||
                trabajo.idCliente ||
                ""
            );


        const presupuesto =
            obtenerNombrePresupuesto(
                trabajo.presupuestoId ||
                trabajo.idPresupuesto ||
                ""
            );


        elemento.innerHTML = `

            <div class="job-header">

                <div>

                    <div class="job-title">

                        ${escapar(
                            trabajo.descripcion ||
                            trabajo.titulo ||
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
                        trabajo.direccion ||
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

    });

}


// ==========================================
// GUARDAR TRABAJO
// ==========================================

if(formulario){

    formulario.addEventListener(
        "submit",
        async function(event){

            event.preventDefault();


            if(!usuarioActual){

                alert(
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
                .getElementById("descripcion")
                .value
                .trim();


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


            let clienteFinal =
                clienteId;


            if(presupuestoId){

                const presupuesto =
                    presupuestos.find(
                        item =>
                            item.id ===
                            presupuestoId
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

                    uid:
                        usuarioActual.uid,

                    empresaId:
                        empresaIdActual,

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


                await addDoc(
                    collection(
                        db,
                        "trabajos"
                    ),
                    datosTrabajo
                );


                alert(
                    "Trabajo guardado correctamente."
                );


                formulario.reset();


                window.ocultarFormulario();


                await cargarTrabajos();

            }
            catch(error){

                console.error(
                    "ERROR GUARDANDO TRABAJO:",
                    error
                );


                alert(
                    "No se pudo guardar el trabajo.\n\n" +
                    error.message
                );

            }

        }
    );

}


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
             * Obtenemos empresa.
             */

            empresaIdActual =
                await obtenerEmpresa();


            console.log(
                "GESBASE UID:",
                usuarioActual.uid
            );


            console.log(
                "GESBASE empresaId:",
                empresaIdActual
            );


            /*
             * Cargar información.
             */

            await cargarClientes();

            await cargarPresupuestos();

            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "ERROR INICIANDO TRABAJOS:",
                error
            );


            listaTrabajos.innerHTML = `
                <div class="message"
                     style="background:#fee2e2;color:#991b1b;">

                    <strong>
                        Error inicializando Trabajos
                    </strong>

                    <br><br>

                    ${escapar(
                        error.message ||
                        "Error desconocido"
                    )}

                </div>
            `;

        }

    }
);
