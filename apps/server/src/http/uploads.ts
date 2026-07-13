import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env';
import { logger } from '../observability/logger';

const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOADS_PATH);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp3']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = /\.wav$/i.test(file.originalname) ? '.wav' : '.mp3';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadSound = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype) || /\.(mp3|wav)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Formato no permitido'));
  },
}).single('file');

export const UPLOADS_ABS = UPLOAD_DIR;

export function soundUrl(filename: string): string {
  return `/api/sounds/${filename}`;
}

/** Borra el archivo fisico referenciado por una URL `/api/sounds/<uuid>`. */
export function deleteSoundFile(url: string | null): void {
  if (!url) return;
  const name = path.basename(url);
  if (!name) return;
  fs.unlink(path.join(UPLOAD_DIR, name), (err) => {
    if (err && err.code !== 'ENOENT') logger.warn({ err: err.message }, 'failed to delete sound file');
  });
}

export function soundPath(filename: string): string {
  return path.join(UPLOAD_DIR, path.basename(filename));
}
