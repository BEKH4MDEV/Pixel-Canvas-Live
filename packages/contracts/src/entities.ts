import { z } from 'zod';
import { ActionType, HexColor, RainColor, ScaleValue, ShapeColor } from './primitives';

/**
 * Entidades del catalogo y estadisticas. Coinciden con las tablas persistentes
 * (documento 02) pero expresadas en camelCase para la red.
 */

// ── Comandos ──────────────────────────────────────────────────────────────
export const CommandName = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[a-z0-9]+$/, 'Solo minusculas y digitos, sin espacios');

export const Command = z.object({
  id: z.number().int(),
  name: CommandName,
  actionType: ActionType,
});
export type Command = z.infer<typeof Command>;

export const CommandInput = z.object({
  name: CommandName,
  actionType: ActionType,
});
export type CommandInput = z.infer<typeof CommandInput>;

// ── Colores ───────────────────────────────────────────────────────────────
export const ColorName = z
  .string()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/, 'Solo minusculas y digitos, sin espacios');

export const Color = z.object({
  id: z.number().int(),
  name: ColorName,
  hex: HexColor,
});
export type Color = z.infer<typeof Color>;

export const ColorInput = z.object({
  name: ColorName,
  hex: HexColor,
});
export type ColorInput = z.infer<typeof ColorInput>;

// ── Figuras ───────────────────────────────────────────────────────────────
export const FIGURE_MIN = 3;
export const FIGURE_MAX = 12;

/** Matriz 2D de 0/1, rectangular, dentro del rango de tamano permitido. */
export const FigurePattern = z
  .array(z.array(z.union([z.literal(0), z.literal(1)])))
  .min(FIGURE_MIN)
  .max(FIGURE_MAX)
  .refine((rows) => rows.every((r) => r.length === rows[0]?.length), {
    message: 'Todas las filas deben tener el mismo ancho',
  })
  .refine((rows) => (rows[0]?.length ?? 0) >= FIGURE_MIN && (rows[0]?.length ?? 0) <= FIGURE_MAX, {
    message: `El ancho debe estar entre ${FIGURE_MIN} y ${FIGURE_MAX}`,
  });
export type FigurePattern = z.infer<typeof FigurePattern>;

export const Figure = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(40),
  pattern: FigurePattern,
});
export type Figure = z.infer<typeof Figure>;

export const FigureInput = z.object({
  name: z.string().min(1).max(40),
  pattern: FigurePattern,
});
export type FigureInput = z.infer<typeof FigureInput>;

// ── Regalos ───────────────────────────────────────────────────────────────
export const Gift = z.object({
  id: z.number().int(),
  giftId: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  /** Conveniencia para la lista del panel; lo deriva el servidor. */
  effectCount: z.number().int().min(0).optional(),
});
export type Gift = z.infer<typeof Gift>;

export const GiftInput = z.object({
  giftId: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
});
export type GiftInput = z.infer<typeof GiftInput>;

// ── Parametros de efecto ──────────────────────────────────────────────────
export const ShapeParams = z
  .object({
    figureId: z.number().int(),
    color: ShapeColor,
    scale: ScaleValue,
    position: z.enum(['random', 'specific']),
    x: z.number().int().min(0).optional(),
    y: z.number().int().min(0).optional(),
  })
  .refine((p) => p.position === 'random' || (p.x !== undefined && p.y !== undefined), {
    message: 'La posicion especifica requiere X e Y',
  });
export type ShapeParams = z.infer<typeof ShapeParams>;

export const RainParams = z.object({
  color: RainColor,
  pixelCount: z.number().int().min(1).max(500),
  durationSeconds: z.number().int().min(1).max(30),
});
export type RainParams = z.infer<typeof RainParams>;

export const ResetParams = z.object({});
export const EndGameParams = z.object({});

/** Un efecto dentro de la secuencia de un regalo. Discriminado por `effectType`. */
export const GiftEffect = z.discriminatedUnion('effectType', [
  z.object({ effectType: z.literal('shape'), params: ShapeParams }),
  z.object({ effectType: z.literal('rain'), params: RainParams }),
  z.object({ effectType: z.literal('reset'), params: ResetParams }),
  z.object({ effectType: z.literal('end_game'), params: EndGameParams }),
]);
export type GiftEffect = z.infer<typeof GiftEffect>;

/** Secuencia completa de efectos. El `position` es el indice en este array. */
export const GiftEffectSequence = z.array(GiftEffect);
export type GiftEffectSequence = z.infer<typeof GiftEffectSequence>;

// ── Estadisticas ──────────────────────────────────────────────────────────
export const PlayerStat = z.object({
  username: z.string(),
  pixelsTotal: z.number().int().min(0),
  pixelsCurrentRound: z.number().int().min(0),
  lastSeenAt: z.string().datetime(),
});
export type PlayerStat = z.infer<typeof PlayerStat>;

export const LeaderboardEntry = z.object({
  username: z.string(),
  pixels: z.number().int().min(0),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const Leaderboard = z.array(LeaderboardEntry);
export type Leaderboard = z.infer<typeof Leaderboard>;
