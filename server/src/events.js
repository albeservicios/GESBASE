// ============================================================
// GESBASE SERVER - BUS DE EVENTOS DE ESCRITURA
// Emite después de cada mutación para realtime y triggers
// ============================================================

import { EventEmitter } from "node:events";

export const writeEvents = new EventEmitter();
writeEvents.setMaxListeners(0);

// event: { path, parent, op: 'create'|'update'|'delete', data }
export function emitWrite(event) {
    writeEvents.emit("write", event);
}
