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
