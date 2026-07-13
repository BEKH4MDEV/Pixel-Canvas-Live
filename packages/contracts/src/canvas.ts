import { z } from 'zod';
import { ClientConfig } from './config';
import { Leaderboard } from './entities';
import { ConnectionState, GameStatus } from './primitives';

/**
 * Estado del sistema, leido de memoria del servidor (sin tocar la base de datos). Hay dos
 * vistas del mismo estado subyacente, una por cara del producto:
 *
 *  - `GameSnapshot` — lo que el PANEL necesita (por `GET /api/admin/live` y el evento `state`
 *    del SSE del admin): estado de partida, conexion e inicio.
 *  - `CanvasState` — lo que el LIENZO necesita (por `GET /api/canvas/state`): todo lo anterior
 *    mas pixeles, config y los datos para reconstruir cada overlay al segundo exacto.
 */

/** Sistema de coordenadas: origen (0,0) en la esquina inferior izquierda. */
export const Pixel = z.object({
  x: z.number().int(),
  y: z.number().int(),
  color: z.string(),
});
export type Pixel = z.infer<typeof Pixel>;

/** Estado de reconexion con el live (intento actual y maximo). */
export const ReconnectInfo = z.object({
  attempt: z.number().int(),
  maxAttempts: z.number().int(),
});
export type ReconnectInfo = z.infer<typeof ReconnectInfo>;

/** Vista del estado para el PANEL. */
export const GameSnapshot = z.object({
  status: GameStatus,
  connectionState: ConnectionState,
  /** Inicio en curso: conteo regresivo o conexion previa a activar la partida. */
  starting: z.boolean(),
  /** Fin de la ultima partida (ISO) o null; el panel lo usa para "Partida finalizada". */
  endedAt: z.string().datetime().nullable(),
});
export type GameSnapshot = z.infer<typeof GameSnapshot>;

/** Vista del estado para el LIENZO. Extiende el snapshot con todo lo necesario para resync. */
export const CanvasState = GameSnapshot.extend({
  pixels: z.array(Pixel),
  config: ClientConfig,
  /** Canal del live; el lienzo lo usa en los overlays "Conectando/Reconectando al live de …". */
  channel: z.string(),
  /** Clasificacion de la partida ya finalizada (para la ventana de resultados). */
  leaderboard: Leaderboard,
  autoRestartSeconds: z.number().int().min(0),
  /** Instante en que termina el conteo de inicio (ISO), o null. */
  countdownEndsAt: z.string().datetime().nullable(),
  /** Fallo la primera conexion del inicio: el lienzo muestra "No se pudo conectar al live". */
  startFailed: z.boolean(),
  /** Reconexion con el live en curso (intento X de Y), o null. */
  reconnect: ReconnectInfo.nullable(),
  /** Quien finalizo la ultima partida; usado por la subfase "Calculando resultados". */
  endTriggeredBy: z.string().nullable(),
});
export type CanvasState = z.infer<typeof CanvasState>;
