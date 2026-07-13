import type { LogLine, LogType } from '@pcl/contracts';
import { adminBus } from './admin-bus';

/**
 * Consola del panel, **en memoria del servidor**. Cualquier módulo del backend puede escribir
 * en ella importando `logStore` y llamando a `append(...)`; cada línea se guarda en el buffer
 * (para la carga inicial vía `GET /api/admin/live`) y se empuja al panel por el SSE del admin.
 * Efímera: al reiniciar el servidor la consola empieza vacía.
 */
const MAX_LINES = 1000;

let seq = 0;
const lines: LogLine[] = [];

export const logStore = {
  append(type: LogType, message: string): LogLine {
    const line: LogLine = { id: ++seq, type, message, at: new Date().toISOString() };
    lines.push(line);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    adminBus.emit('log', line);
    return line;
  },
  getAll(): LogLine[] {
    return [...lines];
  },
  clear(): void {
    lines.length = 0;
  },
};
