// ==========================================
// GESBASE - TRABAJOS
// VERSIÓN CORREGIDA
// CLIENTE → PRESUPUESTO → TRABAJO
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
// FUNCIONES HTML
// ==========================================

window.mostrarFormulario = function(){

    const elemento =
        document.getElementById(
            "formularioTrabajo"
        );

    if(elemento){

        elemento.classList.remove(
            "hidden"
        );

        window.scrollTo({
            top:0,
            behavior:"smooth"
        });

    }

};


window.ocultarFormulario = function(){

    const elemento =
        document.getElementById(
            "formularioTrabajo"
        );

    if(elemento){

        elemento.classList.add(
            "hidden"
        );

    }

};


window.volverPanel = function(){

    window.location.href =
        "index.html";

};


// ==========================================
// ESCAPAR HTML
// ==========================================

function escapar(valor){

    return String(
        valor ?? ""
    )
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


// ==========================================
// OBTENER EMPRESA DEL USUARIO
// ==========================================

async function obtenerEmpresaId(){

    if(!usuarioActual){

        return "";

    }


    /*
     * Buscamos directamente el documento
     * del usuario autenticado.
     */

    try{

        const referencia =
            collection(
                db,
                "usuarios"
            );


        const snapshot =
            await getDocs(
                referencia
            );


        const documentoUsuario =
            snapshot.docs.find(
                documento =>
                    documento.id ===
                    usuarioActual.uid
            );


        if(documentoUsuario){

            const datos =
                documentoUsuario.data();


            const empresa =
                datos.empresaId ||
                datos.idEmpresa ||
                datos.empresaID ||
                datos.empresa ||
                datos.empresaUid ||
                "";


            if(empresa){

                return String(
                    empresa
                ).trim();

            }

        }

    }
    catch(error){

        console.warn(
            "No se pudo obtener empresa:",
            error
        );

    }


    /*
     * Si no existe empresaId,
     * usamos el UID como empresa.
     */

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

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "clientes"
                )
            );


        clienteSelect.innerHTML = `
            <option value="">
                Seleccionar cliente
            </option>
        `;


        snapshot.forEach(
            documento => {

                const datos =
                    documento.data();


                /*
                 * IMPORTANTE:
                 *
                 * No filtramos solamente por
                 * empresaId.
                 *
                 * Aceptamos las distintas
                 * estructuras que GESBASE
                 * pudo utilizar anteriormente.
                 */


                const pertenece =

                    !datos.empresaId && 
                    !datos.usuarioId &&
                    !datos.uid &&
                    !datos.ownerId &&
                    !datos.creadoPor

                    ||

                    String(
                        datos.empresaId || ""
                    ) ===
                    String(
                        empresaIdActual
                    )

                    ||

                    String(
                        datos.usuarioId || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.uid || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.ownerId || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.creadoPor || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    );


                if(!pertenece){

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


                const nombre =
                    nombreCompleto ||

                    datos.nombreEmpresa ||

                    datos.empresa ||

                    datos.razonSocial ||

                    datos.razon_social ||

                    datos.nombreCompleto ||

                    "Cliente";


                clientes.push({

                    id:
                        documento.id,

                    nombre:
                        nombre,

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
                    nombre;


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

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "presupuestos"
                )
            );


        presupuestoSelect.innerHTML = `
            <option value="">
                Sin presupuesto asociado
            </option>
        `;


        snapshot.forEach(
            documento => {

                const datos =
                    documento.data();


                /*
                 * Igual que Clientes:
                 * aceptamos estructuras antiguas
                 * y nuevas.
                 */


                const pertenece =

                    !datos.empresaId && 
                    !datos.usuarioId &&
                    !datos.uid &&
                    !datos.ownerId &&
                    !datos.creadoPor

                    ||

                    String(
                        datos.empresaId || ""
                    ) ===
                    String(
                        empresaIdActual
                    )

                    ||

                    String(
                        datos.usuarioId || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.uid || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.ownerId || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.creadoPor || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    );


                if(!pertenece){

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
                        total.toLocaleString(
                            "es-AR",
                            {
                                style:"currency",
                                currency:"ARS"
                            }
                        );

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

        const id =
            this.value;


        if(!id){

            return;

        }


        const presupuesto =
            presupuestos.find(
                item =>
                    item.id === id
            );


        if(
            !presupuesto ||
            !presupuesto.clienteId
        ){

            return;

        }


        const cliente =
            clientes.find(
                item =>
                    item.id ===
                    presupuesto.clienteId
            );


        if(cliente){

            clienteSelect.value =
                cliente.id;

        }

    }
);


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

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "trabajos"
                )
            );


        snapshot.forEach(
            documento => {

                const datos =
                    documento.data();


                /*
                 * Aceptamos todos los trabajos
                 * pertenecientes al usuario/empresa.
                 */


                const pertenece =

                    !datos.empresaId && 
                    !datos.usuarioId &&
                    !datos.uid &&
                    !datos.ownerId &&
                    !datos.creadoPor

                    ||

                    String(
                        datos.empresaId || ""
                    ) ===
                    String(
                        empresaIdActual
                    )

                    ||

                    String(
                        datos.usuarioId || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.uid || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.ownerId || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    )

                    ||

                    String(
                        datos.creadoPor || ""
                    ) ===
                    String(
                        usuarioActual.uid
                    );


                if(!pertenece){

                    return;

                }


                trabajos.push({

                    id:
                        documento.id,

                    ...datos

                });

            }
        );


        mostrarTrabajos(
            trabajos
        );

    }
    catch(error){

        console.error(
            "ERROR TRABAJOS:",
            error
        );


        listaTrabajos.innerHTML = `
            <div
                class="message"
                style="
                    background:#fee2e2;
                    color:#991b1b;
                "
            >

                <strong>
                    No se pudieron cargar los trabajos.
                </strong>

                <br><br>

                Código:
                ${escapar(error.code)}

                <br><br>

                ${escapar(error.message)}

            </div>
        `;

    }

}


// ==========================================
// NOMBRE CLIENTE
// ==========================================

function nombreCliente(id){

    if(!id){

        return "Sin cliente";

    }


    const cliente =
        clientes.find(
            item =>
                item.id === id
        );


    return cliente
        ? cliente.nombre
        : "Cliente asociado";

}


// ==========================================
// NOMBRE PRESUPUESTO
// ==========================================

function nombrePresupuesto(id){

    if(!id){

        return "Sin presupuesto asociado";

    }


    const presupuesto =
        presupuestos.find(
            item =>
                item.id === id
        );


    if(!presupuesto){

        return "Presupuesto asociado";

    }


    return (

        presupuesto.numero
        ? "N.º " +
          presupuesto.numero +
          " — "
        : ""

    ) + presupuesto.descripcion;

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
        trabajo => {

            const elemento =
                document.createElement(
                    "article"
                );


            elemento.className =
                "job";


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

                        ${escapar(
                            nombreCliente(
                                trabajo.clienteId ||
                                trabajo.idCliente ||
                                ""
                            )
                        )}

                    </div>


                    <div>

                        <strong>
                            Presupuesto:
                        </strong>

                        ${escapar(
                            nombrePresupuesto(
                                trabajo.presupuestoId ||
                                trabajo.idPresupuesto ||
                                ""
                            )
                        )}

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
            trabajo => {

                const descripcion =
                    String(
                        trabajo.descripcion ||
                        trabajo.titulo ||
                        ""
                    ).toLowerCase();


                const lugar =
                    String(
                        trabajo.lugar ||
                        trabajo.direccion ||
                        ""
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

            }
        );


    mostrarTrabajos(
        resultado
    );

};


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


            const descripcion =
                document
                .getElementById(
                    "descripcion"
                )
                .value
                .trim();


            if(!descripcion){

                alert(
                    "Ingresá la descripción del trabajo."
                );

                return;

            }


            const clienteId =
                clienteSelect.value || "";


            const presupuestoId =
                presupuestoSelect.value || "";


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


            /*
             * Si el presupuesto tiene cliente,
             * usamos ese cliente.
             */

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

                await addDoc(
                    collection(
                        db,
                        "trabajos"
                    ),
                    {

                        usuarioId:
                            usuarioActual.uid,

                        uid:
                            usuarioActual.uid,

                        empresaId:
                            empresaIdActual,

                        clienteId:
                            clienteFinal,

                        presupuestoId:
                            presupuestoId,

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

                    }
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
                    "ERROR GUARDANDO:",
                    error
                );


                alert(
                    "No se pudo guardar el trabajo:\n\n" +
                    error.message
                );

            }

        }
    );

}


// ==========================================
// INICIAR
// ==========================================

onAuthStateChanged(
    auth,
    async usuario => {

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
             * Primero obtenemos empresa.
             */

            empresaIdActual =
                await obtenerEmpresaId();


            console.log(
                "GESBASE UID:",
                usuarioActual.uid
            );


            console.log(
                "GESBASE EMPRESA:",
                empresaIdActual
            );


            /*
             * Después cargamos:
             *
             * CLIENTES
             * PRESUPUESTOS
             * TRABAJOS
             */

            await cargarClientes();

            await cargarPresupuestos();

            await cargarTrabajos();

        }
        catch(error){

            console.error(
                "ERROR INICIAL:",
                error
            );


            listaTrabajos.innerHTML = `
                <div class="message">

                    Error iniciando Trabajos:

                    <br><br>

                    ${escapar(
                        error.message
                    )}

                </div>
            `;

        }

    }
);
