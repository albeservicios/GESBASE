// Config local de GESBASE.
// El backend ya no es Firebase (servidor propio en server/).
// Se conserva este objeto solo por compatibilidad de imports:
// initializeApp() del shim lo ignora.
export const firebaseConfig = {
  projectId: "gesbase-local",
  appId: "gesbase-local"
};
