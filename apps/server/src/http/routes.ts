import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z, type ZodType } from 'zod';
import {
  ChangePinRequest,
  ColorInput,
  CommandInput,
  ConfigPatch,
  FigureInput,
  GiftEffectSequence,
  GiftInput,
  LoginRequest,
  ToolCommandRequest,
  ToolRainRequest,
  ToolShapeRequest,
} from '@pcl/contracts';
import { auth, HttpError } from '../auth/auth';
import {
  colorRepo,
  commandRepo,
  configRepo,
  figureRepo,
  giftEffectRepo,
  giftRepo,
  statsRepo,
} from '../db/repositories';
import { engine } from '../domain/engine-instance';
import { handleAdminSse, handleCanvasSse } from '../realtime/sse';
import { logStore } from '../realtime/log-store';
import { logAdminActions } from './action-log';
import { deleteSoundFile, soundPath, soundUrl, uploadSound } from './uploads';

const wrap =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, result.error.errors[0]?.message ?? 'Datos invalidos');
  return result.data;
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(404, 'No encontrado');
  return id;
}

/** Las herramientas solo actúan con la partida en directo y el lienzo totalmente visible. */
function requireLiveReady(): void {
  if (!engine.isLiveReady()) throw new HttpError(409, 'La partida no está activa o el lienzo no está visible');
}

const loginLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

/** Todos los slots de sonido son globales y se guardan en la config. */
const SOUND_FIELD = {
  pixel: 'soundPixelFile',
  reset: 'soundResetFile',
  rain: 'soundRainFile',
  figure: 'soundFigureFile',
  end: 'soundEndFile',
} as const;
type SoundSlotKey = keyof typeof SOUND_FIELD;

export function buildRouter(): Router {
  const r = Router();

  // ── Publico (lienzo) ───────────────────────────────────────
  r.get('/canvas/state', wrap((_req, res) => res.json(engine.getCanvasState())));
  r.get('/canvas/events', handleCanvasSse);
  // Paleta con nombre: el lienzo publico la usa para nombrar colores en las notificaciones.
  r.get('/colors', wrap(async (_req, res) => res.json(await colorRepo.list())));
  r.get(
    '/sounds/:filename',
    wrap((req, res) => res.sendFile(soundPath(req.params.filename!))),
  );

  // ── Auth ───────────────────────────────────────────────────
  r.post(
    '/auth/login',
    loginLimiter,
    wrap(async (req, res) => {
      const { pin } = parse(LoginRequest, req.body);
      res.json(await auth.login(req, res, pin));
    }),
  );
  r.post('/auth/logout', wrap((req, res) => {
    auth.logout(req, res);
    res.json({ ok: true });
  }));
  r.get('/auth/session', wrap(async (req, res) => res.json(await auth.getSessionState(req))));

  // ── Panel (requiere sesion) ────────────────────────────────
  const admin = Router();
  admin.use(auth.requireAuth);
  admin.use(logAdminActions);

  // SSE del panel: solo estado, top de ronda y consola.
  admin.get('/events', handleAdminSse);
  // Carga inicial / vuelta de pestaña: todo lo que empuja el SSE del panel, ya resuelto.
  admin.get('/live', wrap(async (_q, s) =>
    s.json({ state: engine.getSnapshot(), logs: logStore.getAll(), leaderboard: await statsRepo.leaderboard() }),
  ));

  // Control de partida
  admin.post('/game/start', wrap((_q, s) => { engine.startGame(); s.json({ ok: true }); }));
  admin.post('/game/end', wrap((_q, s) => { engine.endGame(); s.json({ ok: true }); }));
  admin.post('/game/pause', wrap((_q, s) => { engine.pauseGame(); s.json({ ok: true }); }));
  admin.post('/game/resume', wrap((_q, s) => { engine.resumeGame(); s.json({ ok: true }); }));
  admin.post('/platform/reconnect', wrap((_q, s) => { engine.reconnectNow(); s.json({ ok: true }); }));
  admin.post('/platform/simulate', wrap((req, s) => {
    const { reason } = parse(z.object({ reason: z.enum(['error', 'stream_end']) }), req.body);
    engine.simulateDrop(reason);
    s.json({ ok: true });
  }));

  // Config
  admin.get('/config', wrap((_q, s) => s.json(engine.getConfig())));
  admin.put('/config', wrap(async (req, s) => {
    const patch = parse(ConfigPatch, req.body);
    const config = await configRepo.update(patch);
    await auth.applySessionConfig(req, s, patch, config);
    await engine.onConfigChanged();
    s.json(config);
  }));

  // Comandos
  admin.get('/commands', wrap(async (_q, s) => s.json(await commandRepo.list())));
  admin.post('/commands', wrap(async (req, s) => {
    const input = parse(CommandInput, req.body);
    const created = await commandRepo.create(input).catch(() => { throw new HttpError(400, 'Ese comando ya existe'); });
    await engine.reloadAll();
    s.json(created);
  }));
  admin.put('/commands/:id', wrap(async (req, s) => {
    const input = parse(CommandInput, req.body);
    const updated = await commandRepo.update(idParam(req), input);
    await engine.reloadAll();
    s.json(updated);
  }));
  admin.delete('/commands/:id', wrap(async (req, s) => {
    if ((await commandRepo.count()) <= 1) throw new HttpError(400, 'No se puede borrar el ultimo comando');
    await commandRepo.remove(idParam(req));
    await engine.reloadAll();
    s.json({ ok: true });
  }));

  // Colores
  admin.get('/colors', wrap(async (_q, s) => s.json(await colorRepo.list())));
  admin.post('/colors', wrap(async (req, s) => {
    const input = parse(ColorInput, req.body);
    const created = await colorRepo.create(input).catch(() => { throw new HttpError(400, 'Ese color ya existe'); });
    await engine.reloadAll();
    s.json(created);
  }));
  admin.put('/colors/:id', wrap(async (req, s) => {
    const updated = await colorRepo.update(idParam(req), parse(ColorInput, req.body));
    await engine.reloadAll();
    s.json(updated);
  }));
  admin.delete('/colors/:id', wrap(async (req, s) => {
    await colorRepo.remove(idParam(req));
    await engine.reloadAll();
    s.json({ ok: true });
  }));

  // Figuras
  admin.get('/figures', wrap(async (_q, s) => s.json(await figureRepo.list())));
  admin.post('/figures', wrap(async (req, s) => {
    const created = await figureRepo.create(parse(FigureInput, req.body)).catch(() => { throw new HttpError(400, 'Esa figura ya existe'); });
    await engine.reloadAll();
    s.json(created);
  }));
  admin.put('/figures/:id', wrap(async (req, s) => {
    const updated = await figureRepo.update(idParam(req), parse(FigureInput, req.body));
    await engine.reloadAll();
    s.json(updated);
  }));
  admin.delete('/figures/:id', wrap(async (req, s) => {
    const id = idParam(req);
    await figureRepo.remove(id);
    // Borra también los efectos de regalo que usaban esta figura (no hay FK: viven en JSON).
    await giftEffectRepo.removeForFigure(id);
    await engine.reloadAll();
    s.json({ ok: true });
  }));

  // Catalogo de regalos
  admin.get('/gifts', wrap(async (_q, s) => s.json(await giftRepo.list())));
  admin.post('/gifts', wrap(async (req, s) => {
    const created = await giftRepo.create(parse(GiftInput, req.body)).catch(() => { throw new HttpError(400, 'Ese gift ID ya existe'); });
    await engine.reloadAll();
    s.json(created);
  }));
  admin.put('/gifts/:id', wrap(async (req, s) => {
    const updated = await giftRepo.update(idParam(req), parse(GiftInput, req.body));
    await engine.reloadAll();
    s.json(updated);
  }));
  admin.delete('/gifts/:id', wrap(async (req, s) => {
    await giftRepo.remove(idParam(req));
    await engine.reloadAll();
    s.json({ ok: true });
  }));

  // Efectos de un regalo (reemplazo atomico)
  admin.get('/gifts/:id/effects', wrap(async (req, s) => s.json(await giftEffectRepo.getForGift(idParam(req)))));
  admin.put('/gifts/:id/effects', wrap(async (req, s) => {
    const id = idParam(req);
    if (!(await giftRepo.exists(id))) throw new HttpError(404, 'No encontrado');
    await giftEffectRepo.replaceForGift(id, parse(GiftEffectSequence, req.body));
    await engine.reloadAll();
    s.json({ ok: true });
  }));
  admin.delete('/gifts/:id/effects', wrap(async (req, s) => {
    await giftEffectRepo.deleteForGift(idParam(req));
    await engine.reloadAll();
    s.json({ ok: true });
  }));

  // Sonidos (todos globales)
  admin.post('/sounds/upload', uploadLimiter, uploadSound, wrap(async (req, s) => {
    if (!req.file) throw new HttpError(400, 'Falta el archivo');
    const slot = String(req.body.slot ?? '');
    if (!(slot in SOUND_FIELD)) throw new HttpError(400, 'Slot invalido');
    const field = SOUND_FIELD[slot as SoundSlotKey];
    const url = soundUrl(req.file.filename);
    deleteSoundFile((await configRepo.getAll())[field]);
    await configRepo.update({ [field]: url });
    await engine.onConfigChanged();
    s.json({ slot, file: url });
  }));
  admin.delete('/sounds/:slot', wrap(async (req, s) => {
    const slot = req.params.slot!;
    if (slot in SOUND_FIELD) {
      const field = SOUND_FIELD[slot as SoundSlotKey];
      deleteSoundFile((await configRepo.getAll())[field]);
      await configRepo.update({ [field]: null });
      await engine.onConfigChanged();
    }
    s.json({ ok: true });
  }));

  // Estadisticas (solo historico; la ronda actual viaja por el SSE del panel)
  admin.get('/stats', wrap(async (_q, s) => s.json({ historical: await statsRepo.historical() })));
  admin.post('/stats/reset-global', wrap(async (_q, s) => {
    await statsRepo.resetGlobal();
    await engine.publishLeaderboard();
    s.json({ ok: true });
  }));

  // Herramientas (siempre instantáneas; solo con partida en directo y lienzo visible)
  admin.post('/tools/command', wrap((req, s) => {
    requireLiveReady();
    engine.toolCommand(parse(ToolCommandRequest, req.body).command);
    s.json({ ok: true });
  }));
  admin.post('/tools/shape', wrap((req, s) => {
    requireLiveReady();
    engine.toolShape(parse(ToolShapeRequest, req.body));
    s.json({ ok: true });
  }));
  admin.post('/tools/rain', wrap((req, s) => {
    requireLiveReady();
    engine.toolRain(parse(ToolRainRequest, req.body));
    s.json({ ok: true });
  }));
  admin.post('/canvas/reset', wrap((_q, s) => {
    requireLiveReady();
    engine.resetCanvas();
    s.json({ ok: true });
  }));
  admin.post('/canvas/reload', wrap((_q, s) => { engine.reloadCanvas(); s.json({ ok: true }); }));

  // Seguridad
  admin.put('/security/pin', wrap(async (req, s) => {
    const body = parse(ChangePinRequest, req.body);
    await auth.changePin(req, body.currentPin, body.newPin);
    s.json({ ok: true });
  }));

  // Borrado masivo: botón «Eliminar todo» de cada tabla.
  admin.delete('/commands', wrap(async (_q, s) => {
    await commandRepo.removeAll();
    await engine.reloadAll();
    s.json({ ok: true });
  }));
  admin.delete('/colors', wrap(async (_q, s) => {
    await colorRepo.removeAll();
    await engine.reloadAll();
    s.json({ ok: true });
  }));
  admin.delete('/figures', wrap(async (_q, s) => {
    await figureRepo.removeAll();
    // Al borrar todas las figuras, todos los efectos de figura quedan huérfanos: se borran.
    await giftEffectRepo.removeAllShapes();
    await engine.reloadAll();
    s.json({ ok: true });
  }));
  admin.delete('/gifts', wrap(async (_q, s) => {
    await giftRepo.removeAll(); // los efectos caen en cascada
    await engine.reloadAll();
    s.json({ ok: true });
  }));
  admin.delete('/effects', wrap(async (_q, s) => {
    await giftEffectRepo.deleteAll();
    await engine.reloadAll();
    s.json({ ok: true });
  }));
  admin.delete('/stats/historical', wrap(async (_q, s) => {
    await statsRepo.removeAll();
    await engine.publishLeaderboard();
    s.json({ ok: true });
  }));

  r.use('/admin', admin);
  return r;
}
