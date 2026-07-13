import { create } from 'zustand';
import type { LogLine } from '@pcl/contracts';

const MAX_LINES = 1000;

interface LogsStore {
  lines: LogLine[];
  /** Añade una línea nueva (evento del SSE del panel), deduplicando por id. */
  push: (line: LogLine) => void;
  /** Reemplaza la consola con el buffer del servidor (carga inicial / vuelta de pestaña). */
  setAll: (lines: LogLine[]) => void;
  clear: () => void;
}

/**
 * Espejo local de la consola del servidor. El servidor es la fuente de verdad: `setAll` la
 * refresca desde `GET /api/admin/live` y `push` añade cada línea que llega por el SSE del panel.
 */
export const useLogsStore = create<LogsStore>((set) => ({
  lines: [],
  push: (line) =>
    set((state) => {
      const last = state.lines[state.lines.length - 1];
      if (last && line.id <= last.id) return state; // ya incluido (evita duplicados por carrera)
      const next = [...state.lines, line];
      return { lines: next.length > MAX_LINES ? next.slice(-MAX_LINES) : next };
    }),
  setAll: (lines) => set({ lines: lines.slice(-MAX_LINES) }),
  clear: () => set({ lines: [] }),
}));
