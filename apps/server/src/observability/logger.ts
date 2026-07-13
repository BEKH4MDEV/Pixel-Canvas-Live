import pino from 'pino';
import { isProd } from '../config/env';

/**
 * Logging estructurado (documento 08, §5). JSON en produccion; legible en desarrollo.
 * El PIN, el SESSION_SECRET y cualquier dato de autenticacion nunca se registran.
 */
export const logger = pino({
  level: 'info',
  redact: ['pin', 'newPin', 'currentPin', 'password', 'SESSION_SECRET', '*.pin'],
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});
