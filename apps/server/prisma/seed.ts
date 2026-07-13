import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma';
import { CONFIG_DEFAULTS } from '../src/db/repositories';

/**
 * Seed idempotente (documento 02, §6): usa upsert con `update: {}` para insertar solo
 * lo que falta, sin pisar valores que el creador haya modificado.
 */

const X = 1;
const o = 0;

const colors = [
  ['rojo', '#FF0000'], ['azul', '#0000FF'], ['verde', '#00FF00'], ['amarillo', '#FFFF00'],
  ['naranja', '#FFA500'], ['morado', '#800080'], ['rosa', '#FFC0CB'], ['negro', '#000000'],
  ['blanco', '#FFFFFF'], ['gris', '#808080'], ['celeste', '#87CEEB'], ['turquesa', '#40E0D0'],
  ['marron', '#8B4513'], ['dorado', '#FFD700'], ['plateado', '#C0C0C0'],
];

const figures: Array<{ name: string; pattern: number[][] }> = [
  { name: 'Cruz', pattern: [[o, o, X, o, o], [o, o, X, o, o], [X, X, X, X, X], [o, o, X, o, o], [o, o, X, o, o]] },
  { name: 'Corazon', pattern: [[o, X, X, o, X, X, o], [X, X, X, X, X, X, X], [X, X, X, X, X, X, X], [o, X, X, X, X, X, o], [o, o, X, X, X, o, o], [o, o, o, X, o, o, o]] },
  { name: 'Estrella', pattern: [[o, o, X, o, o], [X, X, X, X, X], [o, X, X, X, o], [X, o, X, o, X], [o, o, X, o, o]] },
  { name: 'Circulo', pattern: [[o, o, X, X, X, o, o], [o, X, X, X, X, X, o], [X, X, X, X, X, X, X], [X, X, X, X, X, X, X], [X, X, X, X, X, X, X], [o, X, X, X, X, X, o], [o, o, X, X, X, o, o]] },
  { name: 'Triangulo', pattern: [[o, o, X, o, o], [o, X, X, X, o], [X, X, X, X, X]] },
];

const gifts = [
  { giftId: 'rose', name: 'Rosa', effects: [{ effectType: 'shape', params: { figureId: 2, color: '#FFC0CB', scale: 4, position: 'random' } }] },
  { giftId: 'galaxy', name: 'Galaxia', effects: [{ effectType: 'rain', params: { color: 'multicolor', pixelCount: 120, durationSeconds: 4 } }] },
  { giftId: 'lion', name: 'Leon', effects: [{ effectType: 'reset', params: {} }, { effectType: 'shape', params: { figureId: 4, color: 'random', scale: 8, position: 'random' } }] },
  { giftId: 'rocket', name: 'Cohete', effects: [{ effectType: 'end_game', params: {} }] },
  { giftId: 'heart_me', name: 'Corazon', effects: [{ effectType: 'shape', params: { figureId: 2, color: '#FF0000', scale: 2, position: 'specific', x: 10, y: 10 } }] },
];

const players: Array<[string, number, number]> = [
  ['pixelmancer', 4820, 3], ['nova_kit', 3910, 8], ['kira', 3120, 1], ['dot_dot', 2740, 22],
  ['mr_grid', 1980, 40], ['lumen', 1640, 12], ['byte_bee', 1205, 64], ['cyan_oh', 980, 5],
  ['vexel', 770, 33], ['pico', 540, 90], ['glitchy', 410, 120], ['rasterboy', 260, 200],
];

function serialize(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

export async function seed(): Promise<void> {
  // Config (incluido el hash del PIN por defecto "1234").
  for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
    await prisma.config.upsert({ where: { key }, create: { key, value: serialize(value) }, update: {} });
  }
  await prisma.config.upsert({
    where: { key: 'pinHash' },
    create: { key: 'pinHash', value: await bcrypt.hash('1234', 12) },
    update: {},
  });

  await prisma.command.upsert({ where: { name: 'p' }, create: { name: 'p', actionType: 'draw_pixel' }, update: {} });

  for (const [name, hex] of colors) {
    await prisma.color.upsert({ where: { name: name! }, create: { name: name!, hex: hex! }, update: {} });
  }

  for (const fig of figures) {
    await prisma.figure.upsert({
      where: { name: fig.name },
      create: { name: fig.name, pattern: JSON.stringify(fig.pattern) },
      update: {},
    });
  }

  for (const gift of gifts) {
    const row = await prisma.gift.upsert({
      where: { giftId: gift.giftId },
      create: { giftId: gift.giftId, name: gift.name },
      update: {},
    });
    const existing = await prisma.giftEffect.count({ where: { giftId: row.id } });
    if (existing === 0) {
      await prisma.giftEffect.createMany({
        data: gift.effects.map((e, position) => ({ giftId: row.id, position, effectType: e.effectType, params: JSON.stringify(e.params) })),
      });
    }
  }

  const now = Date.now();
  for (const [username, total, minsAgo] of players) {
    await prisma.playerStat.upsert({
      where: { username: username as string },
      create: { username: username as string, pixelsTotal: total as number, pixelsCurrentRound: 0, lastSeenAt: new Date(now - (minsAgo as number) * 60_000) },
      update: {},
    });
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => {
      console.log('Seed completado.');
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
