import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { env, isProd } from '../config/env';
import { HttpError } from '../auth/auth';
import { logger } from '../observability/logger';
import { buildRouter } from './routes';

export function createApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              mediaSrc: ["'self'", 'blob:', 'data:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              frameSrc: ["'self'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'sameorigin' },
    }),
  );
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  app.use('/api', buildRouter());
  app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));

  // En produccion sirve el frontend compilado.
  if (isProd) {
    const dist = path.resolve(process.cwd(), '../web/dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }

  // Manejo de errores central (documento 08, §6): un fallo nunca tumba el proceso.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.errors[0]?.message ?? 'Datos invalidos' });
      return;
    }
    if (err instanceof MulterError) {
      res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 5 MB' : 'Subida invalida' });
      return;
    }
    if (err instanceof Error && err.message === 'Formato no permitido') {
      res.status(400).json({ error: 'Formato no permitido (.mp3 o .wav)' });
      return;
    }
    logger.error({ err }, 'unhandled request error');
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
