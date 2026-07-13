import type { Leaderboard } from '@pcl/contracts';

/**
 * Tipos de superposición de sólo texto que el lienzo sabe mostrar. Todas se pintan con el
 * MISMO componente (`CanvasScreen`), que sólo cambia icono, mensaje y spinner según el tipo.
 */
export type OverlayKind =
  | 'loading' // "Cargando el lienzo"
  | 'server-reconnect' // "Reconectando con el servidor"
  | 'server-failed' // "No se pudo conectar al servidor…"
  | 'connecting-live' // "Conectando al live de @canal"
  | 'live-reconnect' // "Reconectando al live de @canal (intento X de Y)"
  | 'live-failed' // "No se pudo conectar al live de @canal…"
  | 'paused' // "Partida en pausa"
  | 'waiting'; // "Esperando a que [admin] inicie el juego"

export interface ScreenSpec {
  kind: OverlayKind;
  message: string;
  spinner: boolean;
}

export type NotificationKind = 'success' | 'error' | 'shape' | 'rain' | 'reset';

export interface OverlayNotification {
  id: number;
  kind: NotificationKind;
  actor?: string;
  message?: string;
  x?: number;
  y?: number;
  color?: string;
  multicolor?: boolean;
  figureName?: string;
  scale?: number;
  count?: number;
}

export interface ResultsData {
  triggeredBy: string;
  leaderboard: Leaderboard;
  autoRestartSeconds: number;
  /** Instante de fin (ms); las subfases (borrado → mensaje → tabla) se derivan de aquí. */
  endedAtMs: number;
  /** Sólo true si este cliente observó el fin en vivo (entonces reproduce animaciones). */
  animate: boolean;
}

export interface UrlFlags {
  overlay: boolean;
  grid: boolean;
  coords: boolean;
  sound: boolean;
}
