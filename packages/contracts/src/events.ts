import { z } from 'zod';
import { GameSnapshot } from './canvas';
import { ClientConfig } from './config';
import { FIGURE_ANIMATION_DURATION_MS } from './constants';
import { Leaderboard } from './entities';
import { ConnectionState, CountdownReason, HexColor, LogLine, NotificationType } from './primitives';

/**
 * Catalogo de eventos SSE, dividido en DOS familias independientes:
 *
 *  - `canvasEventSchemas`: todo lo que el lienzo publico necesita en tiempo real
 *    (pintado, estado de partida, overlays, conexion con el live).
 *  - `adminEventSchemas`: solo las 3 cosas que el panel necesita en tiempo real
 *    (snapshot de estado, top de la ronda actual y la consola).
 *
 * Cada uno viaja por su propio endpoint SSE. En el cable, cada mensaje es
 * `event: <tipo>` + `data: <JSON>`.
 */

// ───────────────────────────── Canvas ──────────────────────────────────────

// ── Píxel ─────────────────────────────────────────────────────────────────
export const PixelEvent = z.object({
  x: z.number().int(),
  y: z.number().int(),
  color: HexColor,
  username: z.string(),
});
export type PixelEvent = z.infer<typeof PixelEvent>;

// ── Figura ────────────────────────────────────────────────────────────────
export const ShapeEvent = z.object({
  figureId: z.number().int(),
  figureName: z.string(),
  color: HexColor,
  pixels: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
      frame: z.number().int(), // en que frame se pinta; viene ordenado asc.
    }),
  ),
  frameCount: z.number().int(),
  frameIntervalMs: z.number(),
  animationDurationMs: z.literal(FIGURE_ANIMATION_DURATION_MS),
  username: z.string(),
});
export type ShapeEvent = z.infer<typeof ShapeEvent>;

// ── Lluvia ────────────────────────────────────────────────────────────────
export const RainEvent = z.object({
  color: z.union([HexColor, z.literal('multicolor')]),
  pixels: z.array(
    z.object({
      x: z.number().int(),
      destinationY: z.number().int(),
      color: HexColor, // resuelto por el servidor incluso si la raiz es "multicolor"
      delayMs: z.number(),
    }),
  ),
  durationSeconds: z.number().int(),
  username: z.string(),
});
export type RainEvent = z.infer<typeof RainEvent>;

// ── Estado de partida y lienzo ──────────────────────────────────────────────
export const ResetEvent = z.object({ triggeredBy: z.string() });
export type ResetEvent = z.infer<typeof ResetEvent>;

export const GameEndEvent = z.object({
  triggeredBy: z.string(),
  leaderboard: Leaderboard,
  autoRestartSeconds: z.number().int().min(0),
  /** Instante de fin (ISO, reloj del servidor). Sincroniza las subfases de resultados. */
  endedAt: z.string().datetime(),
});
export type GameEndEvent = z.infer<typeof GameEndEvent>;

export const GameStartEvent = z.object({ triggeredBy: z.string() });
export type GameStartEvent = z.infer<typeof GameStartEvent>;

export const CountdownEvent = z.object({
  /** Instante en que termina el conteo (ISO, reloj del servidor): todos ven el mismo segundo. */
  endsAt: z.string().datetime(),
  reason: CountdownReason,
});
export type CountdownEvent = z.infer<typeof CountdownEvent>;

export const NotificationEvent = z.object({
  type: NotificationType,
  message: z.string(),
  username: z.string(),
});
export type NotificationEvent = z.infer<typeof NotificationEvent>;

/** Solo los campos del lienzo que cambiaron. */
export const ConfigUpdateEvent = ClientConfig.partial();
export type ConfigUpdateEvent = z.infer<typeof ConfigUpdateEvent>;

/** Pausa / reanudacion manual de la partida. */
export const PausedEvent = z.object({ triggeredBy: z.string() });
export type PausedEvent = z.infer<typeof PausedEvent>;
export const ResumedEvent = z.object({ triggeredBy: z.string() });
export type ResumedEvent = z.infer<typeof ResumedEvent>;

export const ReloadCanvasEvent = z.object({});
export type ReloadCanvasEvent = z.infer<typeof ReloadCanvasEvent>;

/**
 * Estado de la conexion con la plataforma de live. Fuente unica de la conexion para el
 * lienzo: gobierna "Conectando al live…", "Reconectando al live (intento X de Y)" y el
 * fallo. `attempt`/`maxAttempts` solo vienen durante la reconexion en partida.
 */
export const ConnectionEvent = z.object({
  state: ConnectionState,
  channel: z.string(),
  attempt: z.number().int().optional(),
  maxAttempts: z.number().int().optional(),
});
export type ConnectionEvent = z.infer<typeof ConnectionEvent>;

/** Mapa tipo -> esquema para el SSE del lienzo (`/api/canvas/events`). */
export const canvasEventSchemas = {
  pixel: PixelEvent,
  shape: ShapeEvent,
  rain: RainEvent,
  reset: ResetEvent,
  'game-end': GameEndEvent,
  'game-start': GameStartEvent,
  countdown: CountdownEvent,
  notification: NotificationEvent,
  'config-update': ConfigUpdateEvent,
  paused: PausedEvent,
  resumed: ResumedEvent,
  connection: ConnectionEvent,
  'reload-canvas': ReloadCanvasEvent,
} as const;

export type CanvasEventType = keyof typeof canvasEventSchemas;
export type CanvasEventPayload<T extends CanvasEventType> = z.infer<(typeof canvasEventSchemas)[T]>;
/** Union discriminada `{ type, payload }` para el bus de eventos del lienzo. */
export type CanvasEvent = {
  [T in CanvasEventType]: { type: T; payload: CanvasEventPayload<T> };
}[CanvasEventType];

// ───────────────────────────── Admin ───────────────────────────────────────

/** El SSE del panel solo empuja 3 tipos. `state` es el snapshot de la partida. */
export const adminEventSchemas = {
  state: GameSnapshot,
  leaderboard: Leaderboard,
  log: LogLine,
} as const;

export type AdminEventType = keyof typeof adminEventSchemas;
export type AdminEventPayload<T extends AdminEventType> = z.infer<(typeof adminEventSchemas)[T]>;
export type AdminEvent = {
  [T in AdminEventType]: { type: T; payload: AdminEventPayload<T> };
}[AdminEventType];
