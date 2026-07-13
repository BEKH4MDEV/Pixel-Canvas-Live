import { createContext, useContext } from 'react';

/**
 * Permite que el botón de refrescar de una sección pida re-montarla por completo. Así, al
 * refrescar, cualquier cambio sin guardar (inputs, selects, toggles) vuelve al último estado
 * guardado, porque el componente se reconstruye leyendo los datos recién recargados.
 */
export const RemountContext = createContext<() => void>(() => {});
export const useRequestRemount = (): (() => void) => useContext(RemountContext);
