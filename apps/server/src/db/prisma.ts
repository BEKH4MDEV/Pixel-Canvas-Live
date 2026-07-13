import { PrismaClient } from '@prisma/client';
import { env, isProd } from '../config/env';

export const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: isProd ? ['warn', 'error'] : ['warn', 'error'],
});
