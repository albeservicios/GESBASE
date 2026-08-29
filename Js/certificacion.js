import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection, query, where, getDocs, getDoc, doc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const cliente = document.getElementById("cliente");
const presupuesto = document.getElementById("presupuesto");
const trabajo = document.getElementById("trabajo");

let empresaId = "";
let clientes = [];
let presupuestos = [];
let trabajos = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "login.html";
    return;
  }

  const us = await getDoc(doc(db, "usuarios", user.uid));
  empresaId = us.data().empresaId;

  await cargarClientes();
  await cargarPresupuestos();
  await cargarTrabajos();
});

async function cargarClientes() {
  clientes = [];
  cliente.innerHTML = '<option value="">Seleccioná un cliente</option>';

  const snap = await getDocs(
    query(collection(db, "clientes"),
    where("empresaId", "==", empresaId))
  );

  snap.forEach(d => {
    const c = { id: d.id, ...d.data() };
    clientes.push(c);

    cliente.innerHTML += `
      <option value="${c.id}">
        ${c.nombre || c.empresa || c.razonSocial}
      </option>`;
  });
}

async function cargarPresupuestos() {
  presupuestos = [];

  const snap = await getDocs(
    query(collection(db, "presupuestos"),
    where("empresaId", "==", empresaId))
  );

  snap.forEach(d => {
    presupuestos.push({ id: d.id, ...d.data() });
  });
}

async function cargarTrabajos() {
  trabajos = [];

  const snap = await getDocs(
    query(collection(db, "trabajos"),
    where("empresaId", "==", empresaId))
  );

  snap.forEach(d => {
    trabajos.push({ id: d.id, ...d.data() });
  });
}
let itemsActuales = [];

cliente.addEventListener("change", () => {
  presupuesto.innerHTML = '<option value="">Seleccioná un presupuesto</option>';
  trabajo.innerHTML = '<option value="">Seleccioná un trabajo</option>';
  presupuesto.disabled = true;
  trabajo.disabled = true;

  const lista = presupuestos.filter(p => p.clienteId === cliente.value);

  lista.forEach(p => {
    presupuesto.innerHTML += `<option value="${p.id}">${p.numeroPresupuesto || p.numero}</option>`;
  });

  presupuesto.disabled = lista.length === 0;
});

presupuesto.addEventListener("change", () => {
  trabajo.innerHTML = '<option value="">Seleccioná un trabajo</option>';
  trabajo.disabled = true;

  const lista = trabajos.filter(t => t.presupuestoId === presupuesto.value);

  lista.forEach(t => {
    trabajo.innerHTML += `<option value="${t.id}">${t.nombreTrabajo}</option>`;
  });

  trabajo.disabled = lista.length === 0;
});

trabajo.addEventListener("change", () => {
  const t = trabajos.find(x => x.id === trabajo.value);
  if (!t) return;

  itemsActuales = t.items || [];
  dibujarItems();
});

function dibujarItems() {
  const cont = document.getElementById("listaItems");
  const card = document.getElementById("cardItems");

  cont.innerHTML = "";
  card.style.display = "block";

  itemsActuales.forEach((i, index) => {
    cont.innerHTML += `
      <div class="item">
        <b>${i.nombre}</b><br>
        ${i.cantidad} ${i.unidad}

        <input type="number"
          id="ej${index}"
          min="0"
          max="${i.cantidad}"
          value="0"
          step="0.01"
          placeholder="Cantidad ejecutada">
        <div id="por${index}">0 %</div>
      </div>`;
  });

  itemsActuales.forEach((_, i) => {
    document.getElementById(`ej${i}`)
      .addEventListener("input", calcular);
  });
}

function calcular() {
  let total = 0;

  itemsActuales.forEach((it, i) => {
    const ejecutado = Number(document.getElementById(`ej${i}`).value) || 0;
    const porcentaje = (ejecutado / it.cantidad) * 100;
    const importe = ejecutado * it.precio;

    document.getElementById(`por${i}`).innerHTML =
      `${porcentaje.toFixed(1)} % — $${importe.toLocaleString("es-AR")}`;

    total += importe;
  });

  document.getElementById("total").innerText =
    "$" + total.toLocaleString("es-AR");
}
