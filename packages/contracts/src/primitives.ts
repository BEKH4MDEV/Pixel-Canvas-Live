import { z } from 'zod';

/**
 * Primitivas compartidas. Una sola definicion por forma de dato que cruza la red
 * o se persiste; el resto del sistema deriva sus tipos con `z.infer`.
 */

/** Color hexadecimal `#RRGGBB`. Se acepta cualquier caja; la logica lo normaliza a mayusculas. */
export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex invalido (esperado #RRGGBB)');
export type HexColor = z.infer<typeof HexColor>;

/**
 * Estado de juego. Vive solo en memoria del servidor. La reconexion con el live NO es un
 * estado de juego: es un asunto de `ConnectionState`. Un juego "en directo" con la conexion
 * caida sigue siendo ACTIVE (o PAUSED); lo que cambia es su `connectionState`.
 */
export const GameStatus = z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']);
export type GameStatus = z.infer<typeof GameStatus>;

/**
 * Estado de la conexion con la plataforma de live. Es independiente del estado de juego y
 * gobierna el indicador de canal del panel y las pantallas de conexion/reconexion del lienzo.
 */
export const ConnectionState = z.enum([
  'connecting', // estableciendo la primera conexion (durante el inicio)
  'connected',
  'reconnecting', // caida inesperada durante la partida, reintentando
  'failed', // agotados los reintentos automaticos
  'disconnected', // sin conexion ni intento en curso
]);
export type ConnectionState = z.infer<typeof ConnectionState>;

/** Tipo de linea de la consola del panel. La consola vive en memoria del servidor. */
export const LogType = z.enum(['INFO', 'OK', 'ERROR', 'GIFT', 'MANUAL', 'SYSTEM']);
export type LogType = z.infer<typeof LogType>;

/** Una linea de la consola del panel. La emite el servidor por el SSE del admin. */
export const LogLine = z.object({
  id: z.number().int(),
  type: LogType,
  message: z.string(),
  at: z.string().datetime(),
});
export type LogLine = z.infer<typeof LogLine>;

/** Tipo de accion de un comando de chat. Disenado para crecer. */
export const ActionType = z.enum(['draw_pixel']);
export type ActionType = z.infer<typeof ActionType>;

/** Tipos de efecto que un regalo puede disparar. */
export const EffectType = z.enum(['shape', 'rain', 'reset', 'end_game']);
export type EffectType = z.infer<typeof EffectType>;

/** Tipos de notificacion que el overlay del lienzo sabe pintar. */
export const NotificationType = z.enum(['success', 'error', 'shape', 'rain', 'reset']);
export type NotificationType = z.infer<typeof NotificationType>;

/** Razon de una cuenta atras. */
export const CountdownReason = z.enum(['start', 'auto_restart']);
export type CountdownReason = z.infer<typeof CountdownReason>;

/** Motivo de desconexion de la plataforma de live. */
export const DisconnectReason = z.enum(['error', 'stream_end']);
export type DisconnectReason = z.infer<typeof DisconnectReason>;

/**
 * Multiplicadores de escala validos para figuras. El 1 = tamano nativo (sin escalar); el resto
 * son potencias de 2 via EPX/Scale2x.
 */
export const SCALE_VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024] as const;
export const ScaleValue = z
  .number()
  .int()
  .refine((n) => (SCALE_VALUES as readonly number[]).includes(n), {
    message: 'La escala debe ser 1 (nativo) o una potencia de 2 entre 2 y 1024',
  });
export type ScaleValue = (typeof SCALE_VALUES)[number];

/** Slot de color de un efecto: un color concreto, o resuelto en runtime. */
export const ShapeColor = z.union([HexColor, z.literal('random')]);
export type ShapeColor = z.infer<typeof ShapeColor>;

export const RainColor = z.union([HexColor, z.literal('multicolor'), z.literal('random')]);
export type RainColor = z.infer<typeof RainColor>;

/**
 * Slots de sonido, todos globales: pixel individual, reinicio de lienzo, lluvia, figuras
 * (un unico sonido para todas) y fin de partida (suena al aparecer los resultados).
 */
export const SoundSlot = z.enum(['pixel', 'reset', 'rain', 'figure', 'end']);
export type SoundSlot = z.infer<typeof SoundSlot>;
