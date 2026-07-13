import { z } from 'zod';
import { RainParams, ShapeParams, Leaderboard, PlayerStat } from './entities';
import { GameSnapshot } from './canvas';
import { LogLine, SoundSlot } from './primitives';

/**
 * Contratos de peticion/respuesta HTTP. Casi toda la administracion es HTTP puro; el SSE del
 * panel solo empuja estado, top de ronda y consola.
 */

// ── Auth ──────────────────────────────────────────────────────────────────
export const Pin = z.string().regex(/^\d{4}$/, 'El PIN son 4 digitos');

export const LoginRequest = z.object({ pin: Pin });
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionState = z.object({
  authenticated: z.boolean(),
  /** Bloqueo por fuerza bruta; la UI no revela el mecanismo. */
  locked: z.boolean().default(false),
  lockedUntil: z.string().datetime().nullable().default(null),
  permanentlyLocked: z.boolean().default(false),
});
export type SessionState = z.infer<typeof SessionState>;

export const ChangePinRequest = z
  .object({
    currentPin: Pin,
    newPin: Pin,
    confirmPin: Pin,
  })
  .refine((b) => b.newPin === b.confirmPin, { message: 'Los PIN nuevos no coinciden', path: ['confirmPin'] })
  .refine((b) => b.newPin !== b.currentPin, { message: 'El nuevo PIN debe ser distinto', path: ['newPin'] });
export type ChangePinRequest = z.infer<typeof ChangePinRequest>;

// ── Estado en vivo del panel (SSE + carga inicial) ──────────────────────────
/** Cuerpo de `GET /api/admin/live`: todo lo que empuja el SSE del panel, ya resuelto. */
export const AdminLiveState = z.object({
  state: GameSnapshot,
  logs: z.array(LogLine),
  leaderboard: Leaderboard,
});
export type AdminLiveState = z.infer<typeof AdminLiveState>;

// ── Herramientas (acciones manuales del panel; siempre instantaneas, sin cooldown) ──
export const ToolCommandRequest = z.object({
  command: z.string().min(1).max(200),
});
export type ToolCommandRequest = z.infer<typeof ToolCommandRequest>;

export const ToolShapeRequest = ShapeParams;
export type ToolShapeRequest = z.infer<typeof ToolShapeRequest>;

export const ToolRainRequest = RainParams;
export type ToolRainRequest = z.infer<typeof ToolRainRequest>;

// ── Estadisticas ────────────────────────────────────────────────────────────
/** `GET /api/admin/stats`: solo el historico. La ronda actual viaja por el SSE del panel. */
export const StatsResponse = z.object({
  historical: z.array(PlayerStat),
});
export type StatsResponse = z.infer<typeof StatsResponse>;

// ── Sonidos ─────────────────────────────────────────────────────────────────
export const SoundUploadResponse = z.object({
  slot: SoundSlot,
  file: z.string(),
});
export type SoundUploadResponse = z.infer<typeof SoundUploadResponse>;

/** Respuesta de error uniforme. */
export const ApiError = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiError>;
