import type {
  AdminConfig,
  Color,
  ColorInput,
  Command,
  CommandInput,
  ConfigPatch,
  Figure,
  FigureInput,
  Gift,
  GiftEffectSequence,
  GiftInput,
  Leaderboard,
  PlayerStat,
} from '@pcl/contracts';
import { LEADERBOARD_SIZE } from '@pcl/contracts';
import { prisma } from './prisma';

/* ──────────────────────────────────────────────────────────────
   Config: tabla clave/valor. Se serializa a texto y se interpreta
   por tipo logico. `pinHash` se guarda aqui pero NO forma parte de
   AdminConfig (lo gestiona el modulo de auth).
   ────────────────────────────────────────────────────────────── */

type ConfigType = 'int' | 'bool' | 'string' | 'nstring';

const CONFIG_TYPES: Record<keyof AdminConfig, ConfigType> = {
  pixelSize: 'int',
  showGrid: 'bool',
  showCoords: 'bool',
  overlayVisible: 'bool',
  canvasWidth: 'int',
  canvasHeight: 'int',
  adminName: 'string',
  soundMuted: 'bool',
  soundPixelFile: 'nstring',
  soundPixelVolume: 'int',
  soundRainFile: 'nstring',
  soundRainVolume: 'int',
  soundResetFile: 'nstring',
  soundResetVolume: 'int',
  soundFigureFile: 'nstring',
  soundFigureVolume: 'int',
  soundEndFile: 'nstring',
  soundEndVolume: 'int',
  cooldownSeconds: 'int',
  autoRestartSeconds: 'int',
  gameDurationMinutes: 'int',
  liveChannel: 'string',
  commandPrefix: 'string',
  autoRegisterGifts: 'bool',
  platformSimulation: 'bool',
  sessionDurationMinutes: 'int',
  sessionExpireOnClose: 'bool',
};

export const CONFIG_DEFAULTS: AdminConfig = {
  pixelSize: 20,
  showGrid: false,
  showCoords: true,
  overlayVisible: true,
  canvasWidth: 72,
  canvasHeight: 36,
  adminName: 'Admin',
  soundMuted: false,
  soundPixelFile: null,
  soundPixelVolume: 80,
  soundRainFile: null,
  soundRainVolume: 80,
  soundResetFile: null,
  soundResetVolume: 80,
  soundFigureFile: null,
  soundFigureVolume: 80,
  soundEndFile: null,
  soundEndVolume: 80,
  cooldownSeconds: 15,
  autoRestartSeconds: 0,
  gameDurationMinutes: 0,
  liveChannel: '@canal',
  commandPrefix: '!',
  autoRegisterGifts: false,
  platformSimulation: false,
  sessionDurationMinutes: 480,
  sessionExpireOnClose: false,
};

function serialize(value: unknown, type: ConfigType): string {
  if (type === 'bool') return value ? 'true' : 'false';
  if (type === 'nstring') return value == null ? '' : String(value);
  return String(value);
}

function parse(raw: string, type: ConfigType): unknown {
  switch (type) {
    case 'int':
      return Number(raw);
    case 'bool':
      return raw === 'true';
    case 'nstring':
      return raw === '' ? null : raw;
    default:
      return raw;
  }
}

export const configRepo = {
  async getAll(): Promise<AdminConfig> {
    const rows = await prisma.config.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...CONFIG_DEFAULTS } as Record<string, unknown>;
    for (const key of Object.keys(CONFIG_TYPES) as Array<keyof AdminConfig>) {
      const raw = map.get(key);
      if (raw !== undefined) out[key] = parse(raw, CONFIG_TYPES[key]);
    }
    return out as AdminConfig;
  },

  async update(patch: ConfigPatch): Promise<AdminConfig> {
    const entries = Object.entries(patch) as Array<[keyof AdminConfig, unknown]>;
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.config.upsert({
          where: { key },
          create: { key, value: serialize(value, CONFIG_TYPES[key]) },
          update: { value: serialize(value, CONFIG_TYPES[key]) },
        }),
      ),
    );
    return configRepo.getAll();
  },

  async getRaw(key: string): Promise<string | null> {
    const row = await prisma.config.findUnique({ where: { key } });
    return row?.value ?? null;
  },

  async setRaw(key: string, value: string): Promise<void> {
    await prisma.config.upsert({ where: { key }, create: { key, value }, update: { value } });
  },
};

/* ────────────────────────── Comandos ────────────────────────── */
export const commandRepo = {
  list: (): Promise<Command[]> => prisma.command.findMany({ orderBy: { id: 'asc' } }) as Promise<Command[]>,
  count: () => prisma.command.count(),
  create: (input: CommandInput): Promise<Command> => prisma.command.create({ data: input }) as Promise<Command>,
  update: (id: number, input: CommandInput): Promise<Command> =>
    prisma.command.update({ where: { id }, data: input }) as Promise<Command>,
  remove: (id: number) => prisma.command.delete({ where: { id } }),
  removeAll: () => prisma.command.deleteMany(),
};

/* ────────────────────────── Colores ─────────────────────────── */
export const colorRepo = {
  list: (): Promise<Color[]> => prisma.color.findMany({ orderBy: { id: 'asc' } }) as Promise<Color[]>,
  create: (input: ColorInput): Promise<Color> => prisma.color.create({ data: input }) as Promise<Color>,
  update: (id: number, input: ColorInput): Promise<Color> =>
    prisma.color.update({ where: { id }, data: input }) as Promise<Color>,
  remove: (id: number) => prisma.color.delete({ where: { id } }),
  removeAll: () => prisma.color.deleteMany(),
};

/* ────────────────────────── Figuras ─────────────────────────── */
function toFigure(row: { id: number; name: string; pattern: string }): Figure {
  return { id: row.id, name: row.name, pattern: JSON.parse(row.pattern) };
}

export const figureRepo = {
  async list(): Promise<Figure[]> {
    const rows = await prisma.figure.findMany({ orderBy: { id: 'asc' } });
    return rows.map(toFigure);
  },
  async get(id: number): Promise<Figure | null> {
    const row = await prisma.figure.findUnique({ where: { id } });
    return row ? toFigure(row) : null;
  },
  async create(input: FigureInput): Promise<Figure> {
    const row = await prisma.figure.create({ data: { name: input.name, pattern: JSON.stringify(input.pattern) } });
    return toFigure(row);
  },
  async update(id: number, input: FigureInput): Promise<Figure> {
    const row = await prisma.figure.update({ where: { id }, data: { name: input.name, pattern: JSON.stringify(input.pattern) } });
    return toFigure(row);
  },
  remove: (id: number) => prisma.figure.delete({ where: { id } }),
  removeAll: () => prisma.figure.deleteMany(),
};

/* ────────────────────────── Regalos ─────────────────────────── */
export const giftRepo = {
  async list(): Promise<Gift[]> {
    const rows = await prisma.gift.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { effects: true } } } });
    return rows.map((g) => ({ id: g.id, giftId: g.giftId, name: g.name, effectCount: g._count.effects }));
  },
  getByGiftId: (giftId: string) => prisma.gift.findUnique({ where: { giftId } }),
  create: (input: GiftInput): Promise<Gift> => prisma.gift.create({ data: input }) as Promise<Gift>,
  update: (id: number, input: GiftInput): Promise<Gift> =>
    prisma.gift.update({ where: { id }, data: input }) as Promise<Gift>,
  remove: (id: number) => prisma.gift.delete({ where: { id } }),
  removeAll: () => prisma.gift.deleteMany(),
  exists: async (id: number) => (await prisma.gift.count({ where: { id } })) > 0,
};

export const giftEffectRepo = {
  async getForGift(giftId: number): Promise<GiftEffectSequence> {
    const rows = await prisma.giftEffect.findMany({ where: { giftId }, orderBy: { position: 'asc' } });
    return rows.map((r) => ({ effectType: r.effectType, params: JSON.parse(r.params) })) as GiftEffectSequence;
  },
  async replaceForGift(giftId: number, sequence: GiftEffectSequence): Promise<void> {
    await prisma.$transaction([
      prisma.giftEffect.deleteMany({ where: { giftId } }),
      ...sequence.map((effect, position) =>
        prisma.giftEffect.create({
          data: { giftId, position, effectType: effect.effectType, params: JSON.stringify(effect.params) },
        }),
      ),
    ]);
  },
  deleteForGift: (giftId: number) => prisma.giftEffect.deleteMany({ where: { giftId } }),
  deleteAll: () => prisma.giftEffect.deleteMany(),

  /**
   * Borra los efectos de figura que apuntan a `figureId` (el `figureId` vive dentro del JSON
   * `params`, no hay FK). Se llama al eliminar una figura, para que ningún regalo quede con un
   * efecto huérfano que apunte a una figura inexistente. El resto de la secuencia se conserva.
   */
  async removeForFigure(figureId: number): Promise<void> {
    const rows = await prisma.giftEffect.findMany({ where: { effectType: 'shape' } });
    const orphans = rows
      .filter((r) => {
        try {
          return (JSON.parse(r.params) as { figureId?: number }).figureId === figureId;
        } catch {
          return false;
        }
      })
      .map((r) => r.id);
    if (orphans.length) await prisma.giftEffect.deleteMany({ where: { id: { in: orphans } } });
  },

  /** Borra todos los efectos de figura (al eliminar TODAS las figuras). */
  removeAllShapes: () => prisma.giftEffect.deleteMany({ where: { effectType: 'shape' } }),
};

/* ─────────────────────── Estadisticas ───────────────────────── */
function toStat(row: { username: string; pixelsTotal: number; pixelsCurrentRound: number; lastSeenAt: Date }): PlayerStat {
  return {
    username: row.username,
    pixelsTotal: row.pixelsTotal,
    pixelsCurrentRound: row.pixelsCurrentRound,
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

export const statsRepo = {
  async historical(): Promise<PlayerStat[]> {
    const rows = await prisma.playerStat.findMany({ orderBy: { pixelsTotal: 'desc' } });
    return rows.map(toStat);
  },
  async leaderboard(): Promise<Leaderboard> {
    const rows = await prisma.playerStat.findMany({
      where: { pixelsCurrentRound: { gt: 0 } },
      orderBy: [{ pixelsCurrentRound: 'desc' }, { lastSeenAt: 'asc' }],
      take: LEADERBOARD_SIZE,
    });
    return rows.map((r) => ({ username: r.username, pixels: r.pixelsCurrentRound }));
  },
  async increment(username: string, amount: number): Promise<void> {
    await prisma.playerStat.upsert({
      where: { username },
      create: { username, pixelsTotal: amount, pixelsCurrentRound: amount, lastSeenAt: new Date() },
      update: { pixelsTotal: { increment: amount }, pixelsCurrentRound: { increment: amount }, lastSeenAt: new Date() },
    });
  },
  resetRound: () => prisma.playerStat.updateMany({ data: { pixelsCurrentRound: 0 } }),
  resetGlobal: () => prisma.playerStat.updateMany({ data: { pixelsTotal: 0 } }),
  removeAll: () => prisma.playerStat.deleteMany(),
};

/* ────────────────── Control de fuerza bruta ─────────────────── */
export const authRepo = {
  async get() {
    const existing = await prisma.authAttempt.findFirst();
    return existing ?? prisma.authAttempt.create({ data: {} });
  },
  update: (id: number, data: { attemptsInGroup?: number; groupsUsed?: number; lockedUntil?: Date | null; permanentlyLocked?: boolean }) =>
    prisma.authAttempt.update({ where: { id }, data }),
  async reset() {
    const row = await authRepo.get();
    return prisma.authAttempt.update({
      where: { id: row.id },
      data: { attemptsInGroup: 0, groupsUsed: 0, lockedUntil: null, permanentlyLocked: false },
    });
  },
};
