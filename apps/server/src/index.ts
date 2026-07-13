import { env } from './config/env';
import { logger } from './observability/logger';
import { prisma } from './db/prisma';
import { engine } from './domain/engine-instance';
import { createApp } from './http/app';
import { seed } from '../prisma/seed';

/**
 * Secuencia de arranque (documento 02, §3): seed idempotente -> estado en memoria ->
 * reseteo de la ronda. Las migraciones (schema) se aplican con `pnpm db:setup`.
 */
async function main(): Promise<void> {
  await prisma.$connect();
  // SQLite: WAL + espera ante bloqueos. El juego escribe a menudo (audiencia + panel) y,
  // sin esto, escrituras concurrentes (p. ej. reinicio de ronda vs. estadisticas) fallaban
  // en silencio con "database is locked".
  await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
  // La seed solo se ejecuta automaticamente cuando la BD esta vacia (primer arranque). Asi
  // no "contamina" al reiniciar (p. ej. no resucita catalogos que el creador borro). Para
  // re-sembrar a mano: `pnpm db:seed`.
  if ((await prisma.config.count()) === 0) {
    logger.info('base de datos vacia: ejecutando seed inicial');
    await seed();
  }
  await engine.init();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Pixel Canvas Live server escuchando en http://localhost:${env.PORT}`);
  });

  const shutdown = async (): Promise<void> => {
    logger.info('apagando…');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'fallo al arrancar');
  process.exit(1);
});
