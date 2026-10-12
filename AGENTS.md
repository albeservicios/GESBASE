# GESBASE

Gestión de presupuestos, trabajos y gastos para empresas y profesionales.

## Arquitectura (post-migración, sin Firebase)

- **Frontend**: ~100 HTML estáticos en la raíz + `Js/`. Sin build.
- **Shims**: `Js/local/firebase-*.js` reimplementan la API del SDK de
  Firebase (auth, firestore, storage, messaging, functions, ai) sobre
  el backend local. Los HTML importan `./Js/local/...` en vez del CDN.
- **Backend**: `server/` (Node 20 + Express + MongoDB + ws).
  - `src/firestore-api.js` — API compatible con Firestore REST
  - `src/realtime.js` — WebSocket para `onSnapshot`
  - `src/auth.js` — JWT (reemplaza Firebase Auth)
  - `src/storage.js` — archivos en `server/uploads/` (`/uploads/*`)
  - `src/triggers.js` — ex Cloud Functions (push llamadas, SMS/email alquiler)
  - `src/functions.js` — callables (`geminiChat`, `crearAccesoEmpleado`)
- **DB**: MongoDB. Docs en colección `_documents` `{_id:path, _parent, _v, ...data}`;
  usuarios de auth en `_auth_users`.

## Comandos

```bash
cd server
npm install
node scripts/start-mongo.js   # MongoDB local (datos en server/data/db)
npm start                     # app en http://localhost:3001 (PORT en .env)
```

Migración Firebase: `export:firestore` / `export:storage` /
`export:auth` / `import:mongo` (requieren `server/serviceAccountKey.json`).

Deploy VPS: ver `server/deploy/DEPLOY.md`.

## Convenciones

- El código del frontend está en español, estilo "una cosa por línea"
  con mucho whitespace vertical — respetarlo al editar.
- Las escrituras al doc store pasan por `runOp`/`runOps` que emiten
  `writeEvents` → realtime + triggers. No escribir a Mongo directo
  salvo en migraciones.
- Centinelas wire: `{__fs:'ts'|'svr'|'au'|'ar'|'inc'|'del'|'ref'}`.
