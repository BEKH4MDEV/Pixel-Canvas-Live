import path from 'node:path';
import { z } from 'zod';

/**
 * Carga y valida las variables de entorno al arrancar (documento 09, §3). En
 * desarrollo aporta valores por defecto razonables para que `pnpm dev` funcione sin
 * configurar nada; en produccion exige los secretos reales.
 */

// Carga .env del paquete y, si existe, el de la raiz del monorepo.
for (const file of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* el archivo puede no existir */
  }
}

const num = (def: number) => z.coerce.number().int().default(def);

const Schema = z.object({
  PORT: num(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./data/canvas.db'),
  UPLOADS_PATH: z.string().default('./uploads/sounds'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-change-me-please-min-32-characters'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_FILE_PATH: z.string().default('./logs/server.log'),
  PLATFORM_RECONNECT_INITIAL_DELAY_SECONDS: num(10),
  PLATFORM_RECONNECT_MAX_ATTEMPTS: num(5),
  PLATFORM_RECONNECT_MULTIPLIER: num(2),
  PIN_MAX_ATTEMPTS_PER_GROUP: num(3),
  PIN_LOCKOUT_MINUTES: num(1440),
  PIN_LOCKOUT_MULTIPLIER: num(2),
  PIN_MAX_GROUPS: num(2),
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuracion de entorno invalida:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === 'production' && env.SESSION_SECRET.startsWith('dev-session-secret')) {
  console.error('SESSION_SECRET no configurado en produccion. Aborta.');
  process.exit(1);
}

// Asegura que Prisma encuentre la URL.
process.env.DATABASE_URL = env.DATABASE_URL;

export const isProd = env.NODE_ENV === 'production';
