import { z } from 'zod';

/**
 * Configuracion. En la red viaja en camelCase; la persistencia (Fase 2) la mapea a
 * la tabla `config` clave/valor. `pinHash` nunca cruza al cliente: se gestiona aparte.
 */

/** Limites compartidos del area de juego logica. */
export const CANVAS_MIN = 10;
export const CANVAS_MAX = 1000;
export const PIXEL_SIZE_MIN = 5;
export const PIXEL_SIZE_MAX = 30;

/**
 * Subconjunto de configuracion que el lienzo necesita para renderizar y reproducir
 * sonidos globales sin pedirlos en cada evento. Plano a proposito: permite que
 * `config-update` sea un `.partial()` limpio (documento 03, §4).
 */
export const ClientConfig = z.object({
  pixelSize: z.number().int().min(PIXEL_SIZE_MIN).max(PIXEL_SIZE_MAX),
  showGrid: z.boolean(),
  showCoords: z.boolean(),
  overlayVisible: z.boolean(),
  canvasWidth: z.number().int().min(CANVAS_MIN).max(CANVAS_MAX),
  canvasHeight: z.number().int().min(CANVAS_MIN).max(CANVAS_MAX),
  /** El lienzo lo usa en los mensajes de espera y resultados. */
  adminName: z.string().min(1).max(30),
  soundMuted: z.boolean(),
  // Todos los sonidos son globales.
  soundPixelFile: z.string().nullable(),
  soundPixelVolume: z.number().int().min(0).max(100),
  soundRainFile: z.string().nullable(),
  soundRainVolume: z.number().int().min(0).max(100),
  soundResetFile: z.string().nullable(),
  soundResetVolume: z.number().int().min(0).max(100),
  /** Sonido unico para todas las figuras. */
  soundFigureFile: z.string().nullable(),
  soundFigureVolume: z.number().int().min(0).max(100),
  /** Sonido de fin de partida; suena al empezar a aparecer los resultados. */
  soundEndFile: z.string().nullable(),
  soundEndVolume: z.number().int().min(0).max(100),
});
export type ClientConfig = z.infer<typeof ClientConfig>;

/**
 * Configuracion completa que gestiona el panel. Extiende la del cliente con los
 * ajustes que no afectan al render del lienzo.
 */
export const AdminConfig = ClientConfig.extend({
  cooldownSeconds: z.number().int().min(0),
  autoRestartSeconds: z.number().int().min(0),
  gameDurationMinutes: z.number().int().min(0),
  liveChannel: z.string(),
  commandPrefix: z.string().min(1).max(3),
  autoRegisterGifts: z.boolean(),
  /** Audiencia simulada conviviendo con el live real: inyecta píxeles y regalos ficticios. */
  platformSimulation: z.boolean(),
  sessionDurationMinutes: z.number().int().min(5).max(10080),
  sessionExpireOnClose: z.boolean(),
});
export type AdminConfig = z.infer<typeof AdminConfig>;

/** Cuerpo de `PUT /api/admin/config`: cualquier subconjunto de la config del panel. */
export const ConfigPatch = AdminConfig.partial();
export type ConfigPatch = z.infer<typeof ConfigPatch>;

/** Caracteres permitidos como prefijo de comando (documento 06, §3). */
export const ALLOWED_PREFIX_CHARS = ['!', '#', '$', '%', '&', '/', '?', '@', '~', '+', '-', '=', '^'] as const;
