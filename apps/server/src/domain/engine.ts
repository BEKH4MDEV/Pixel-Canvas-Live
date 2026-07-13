import type {
  AdminConfig,
  CanvasState,
  ClientConfig,
  Color,
  Command,
  Figure,
  GameSnapshot,
  Gift,
  GiftEffectSequence,
} from '@pcl/contracts';
import { env } from '../config/env';
import { logger } from '../observability/logger';
import { canvasBus } from '../realtime/canvas-bus';
import { adminBus } from '../realtime/admin-bus';
import { logStore } from '../realtime/log-store';
import {
  colorRepo,
  commandRepo,
  configRepo,
  figureRepo,
  giftEffectRepo,
  giftRepo,
  statsRepo,
} from '../db/repositories';
import { buildFigureFrames, patternDims, scaleFigure } from '../lib/figures';
import { normalizeHex, randomColor, resolveColor } from '../lib/colors';
import { gameState } from './game-state';
import type { LivePlatform, SimulationControl } from './platform';
import { ERASE_DURATION_MS, FIGURE_ANIMATION_DURATION_MS } from '@pcl/contracts';

const CLIENT_KEYS = [
  'pixelSize', 'showGrid', 'showCoords', 'overlayVisible', 'canvasWidth', 'canvasHeight',
  'adminName', 'soundMuted', 'soundPixelFile', 'soundPixelVolume', 'soundRainFile',
  'soundRainVolume', 'soundResetFile', 'soundResetVolume', 'soundFigureFile', 'soundFigureVolume',
  'soundEndFile', 'soundEndVolume',
] as const satisfies ReadonlyArray<keyof ClientConfig>;

/** Contexto de un actor del pipeline: el admin (manual) o un espectador del live. */
interface Ctx {
  manual: boolean;
  username: string;
}

interface ShapeParamsLike {
  figureId: number;
  color: string;
  scale: number;
  position: 'random' | 'specific';
  x?: number;
  y?: number;
}
interface RainParamsLike {
  color: string;
  pixelCount: number;
  durationSeconds: number;
}

const COUNTDOWN_MS = 3000;
const DELAY_FOR_EFFECTS_MS = 1000
const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Motor de juego. Única autoridad sobre el estado de la partida. Publica en dos canales:
 *  - `canvasBus`: eventos de pintado y overlays para el lienzo.
 *  - `adminBus`: snapshot de estado (`state`) y top de ronda (`leaderboard`) para el panel.
 * Además registra en `logStore` cada acción, evento del live y error (la consola del panel).
 */
export class GameEngine {
  private config!: AdminConfig;
  private commands: Command[] = [];
  private colors: Color[] = [];
  private figures: Figure[] = [];
  private gifts: Gift[] = [];
  private giftEffects = new Map<string, GiftEffectSequence>(); // giftId -> sequence

  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private autoRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private durationTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private leaderboardTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  /** Inicio en curso: conteo regresivo o conexión previa a activar la partida. */
  private starting = false;
  /** Falló la primera conexión del inicio (el lienzo muestra "No se pudo conectar al live"). */
  private startFailed = false;

  constructor(private platform: LivePlatform) {
    this.platform.onComment((u, m) => this.handleComment(u, m));
    this.platform.onGift((u, id, name) => this.handleGift(u, id, name));
    this.platform.onDisconnect((reason) => this.handleDisconnect(reason));
  }

  // ── Arranque y caches ────────────────────────────────────────
  async init(): Promise<void> {
    await this.reloadAll();
    await statsRepo.resetRound();
    gameState.setStatus('INACTIVE');
    gameState.setEndedAt(null);
    gameState.setConnectionState('disconnected');
    gameState.setReconnect(null);
    this.starting = false;
    this.startFailed = false;
    logStore.append('SYSTEM', 'Servidor iniciado');
  }

  async reloadAll(): Promise<void> {
    const [config, commands, colors, figures, gifts] = await Promise.all([
      configRepo.getAll(),
      commandRepo.list(),
      colorRepo.list(),
      figureRepo.list(),
      giftRepo.list(),
    ]);
    this.config = config;
    this.commands = commands;
    this.colors = colors;
    this.figures = figures;
    this.gifts = gifts;
    this.giftEffects.clear();
    await Promise.all(
      gifts.map(async (g) => {
        const fx = await giftEffectRepo.getForGift(g.id);
        if (fx.length) this.giftEffects.set(g.giftId, fx);
      }),
    );
    this.refreshAmbient();
  }

  private refreshAmbient(): void {
    const sim = this.platform as Partial<SimulationControl>;
    if (typeof sim.setAmbientProfile !== 'function') return;
    sim.setAmbientProfile({
      // El simulador solo INYECTA eventos cuando la partida está en directo, conectada al live
      // real y el lienzo visible (status ACTIVE + conexión establecida), y el toggle está activo.
      // Así respeta el mismo comportamiento que los eventos reales: nada en pausa, reconexión,
      // cuenta atrás o desconexión.
      enabled:
        gameState.getStatus() === 'ACTIVE' &&
        gameState.getConnectionState() === 'connected' &&
        this.config.platformSimulation,
      commandPrefix: this.config.commandPrefix,
      command: this.commands[0]?.name ?? 'p',
      colorNames: this.colors.map((c) => c.name),
      width: this.config.canvasWidth,
      height: this.config.canvasHeight,
    });
  }

  getConfig(): AdminConfig {
    return this.config;
  }

  private clientConfig(): ClientConfig {
    const out = {} as Record<string, unknown>;
    for (const key of CLIENT_KEYS) out[key] = this.config[key];
    return out as ClientConfig;
  }

  private colorName(hex: string): string {
    return this.colors.find((c) => c.hex.toUpperCase() === hex.toUpperCase())?.name ?? hex.toUpperCase();
  }

  // ── Snapshots ────────────────────────────────────────────────
  getSnapshot(): GameSnapshot {
    return {
      status: gameState.getStatus(),
      connectionState: gameState.getConnectionState(),
      starting: this.starting,
      endedAt: gameState.getEndedAt(),
    };
  }

  getCanvasState(): CanvasState {
    const status = gameState.getStatus();
    const endedAt = gameState.getEndedAt();
    return {
      status,
      connectionState: gameState.getConnectionState(),
      starting: this.starting,
      endedAt,
      pixels: gameState.getPixels(),
      config: this.clientConfig(),
      channel: this.config.liveChannel,
      leaderboard: status === 'INACTIVE' && endedAt ? gameState.getLastLeaderboard() : [],
      autoRestartSeconds: this.config.autoRestartSeconds,
      countdownEndsAt: gameState.getCountdownEndsAt(),
      startFailed: this.startFailed,
      reconnect: gameState.getReconnect(),
      endTriggeredBy: gameState.getEndTriggeredBy(),
    };
  }

  private publishState(): void {
    adminBus.emit('state', this.getSnapshot());
  }

  async publishLeaderboard(): Promise<void> {
    adminBus.emit('leaderboard', await statsRepo.leaderboard());
  }

  /** Publica el top de la ronda al panel, como mucho una vez por segundo. */
  private scheduleLeaderboardPublish(): void {
    if (this.leaderboardTimer) return;
    this.leaderboardTimer = setTimeout(() => {
      this.leaderboardTimer = null;
      void this.publishLeaderboard();
    }, 1000);
  }

  // ── Emisión al lienzo ────────────────────────────────────────
  private emitConnection(state: 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'disconnected', attempt?: number, maxAttempts?: number): void {
    canvasBus.emit('connection', { state, channel: this.config.liveChannel, attempt, maxAttempts });
  }

  // ── Cambios de configuracion ─────────────────────────────────
  async onConfigChanged(): Promise<void> {
    const before = this.clientConfig();
    await this.reloadAll();
    const after = this.clientConfig();
    const changed: Record<string, unknown> = {};
    for (const key of CLIENT_KEYS) if (before[key] !== after[key]) changed[key] = after[key];
    if (Object.keys(changed).length) canvasBus.emit('config-update', changed);
  }

  // ── Control de partida ───────────────────────────────────────
  startGame(): void {
    if (gameState.getStatus() !== 'INACTIVE' || this.starting) return;
    this.clearGameTimers();
    this.clearReconnect();
    // Limpia el resultado anterior: quien (re)sincronice durante el inicio no verá la tabla vieja.
    this.starting = true;
    this.startFailed = false;
    gameState.setEndedAt(null);
    gameState.setEndTriggeredBy(null);
    gameState.setReconnect(null);
    gameState.setCountdownEndsAt(new Date(Date.now() + COUNTDOWN_MS).toISOString());
    canvasBus.emit('countdown', { endsAt: gameState.getCountdownEndsAt()!, reason: 'start' });
    logStore.append('INFO', 'Cuenta atrás de inicio');
    // El snapshot al panel lo emite beginConnect ya con connectionState='connecting', para que
    // el indicador muestre "Conectando a …" desde el inicio (no "Desconectado" hasta el conteo).
    this.beginConnect();
    // A los 3 s: si ya conectó, activa; si no, el lienzo muestra "Conectando al live".
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      gameState.setCountdownEndsAt(null);
      if (!this.starting) return;
      if (gameState.getConnectionState() === 'connected') void this.goActive();
      else this.publishState();
    }, COUNTDOWN_MS);
  }

  /** Primera conexión del inicio. Un fallo aquí NO reintenta: aborta el inicio (documento §1.2). */
  private beginConnect(): void {
    const channel = this.config.liveChannel;
    if (!channel) {
      this.failStart('No hay canal configurado');
      return;
    }
    gameState.setConnectionState('connecting');
    this.emitConnection('connecting');
    logStore.append('INFO', `Conectando a ${channel}…`);
    this.publishState();
    this.platform
      .connect(channel)
      .then(() => {
        if (!this.starting) return; // se abortó mientras conectaba
        gameState.setConnectionState('connected');
        this.emitConnection('connected');
        logStore.append('OK', `Conectado a ${channel}`);
        // Si el conteo ya terminó, activa ahora; si aún corre, se activará al terminar.
        if (!this.countdownRunning()) void this.goActive();
        else this.publishState();
      })
      .catch((err: Error) => {
        this.failStart(err.message);
      });
  }

  private failStart(reason: string): void {
    this.clearGameTimers();
    this.starting = false;
    this.startFailed = true;
    gameState.setStatus('INACTIVE');
    gameState.setCountdownEndsAt(null);
    gameState.setConnectionState('disconnected');
    void this.platform.disconnect();
    this.emitConnection('disconnected');
    this.refreshAmbient();
    logStore.append('ERROR', `No se pudo conectar a ${this.config.liveChannel}: ${reason}`);
    this.publishState();
  }

  private countdownRunning(): boolean {
    return this.countdownTimer !== null;
  }

  private async goActive(): Promise<void> {
    this.starting = false;
    this.startFailed = false;
    this.clearTimer('countdownTimer');
    gameState.setCountdownEndsAt(null);
    gameState.setEndedAt(null);
    gameState.setEndTriggeredBy(null);
    gameState.setStatus('ACTIVE');
    canvasBus.emit('game-start', { triggeredBy: this.config.adminName });
    logStore.append('OK', 'Partida iniciada');
    // La duración solo empieza tras conexión + conteo, y ya nunca se detiene (ni en pausa).
    this.startDurationTimer(this.config.gameDurationMinutes * 60_000);
    // Reinicia la ronda ANTES de habilitar la audiencia (ningún píxel nuevo cuenta sobre lo viejo).
    await statsRepo.resetRound().catch((err) => logger.error({ err: String(err) }, 'reset round failed'));
    this.refreshAmbient();
    this.publishState();
    void this.publishLeaderboard();
  }

  endGame(triggeredBy?: string): void {
    if (gameState.getStatus() === 'INACTIVE' && !this.starting) return;
    this.clearGameTimers();
    this.clearReconnect();
    const by = triggeredBy ?? this.config.adminName;
    this.starting = false;
    this.startFailed = false;
    // Corta el juego y la audiencia AL INSTANTE: a partir de aquí nada entrante se procesa.
    gameState.setStatus('INACTIVE');
    gameState.setCountdownEndsAt(null);
    gameState.setConnectionState('disconnected');
    gameState.setReconnect(null);
    // Al finalizar, el cooldown de todos los usuarios se reinicia (la próxima partida empieza limpia).
    gameState.clearCooldowns();
    this.refreshAmbient();
    void this.platform.disconnect();
    this.emitConnection('disconnected');
    this.publishState();
    const endedAt = new Date().toISOString();
    void statsRepo.leaderboard().then((leaderboard) => {
      gameState.setLastLeaderboard(leaderboard);
      gameState.clearPixels();
      gameState.setEndedAt(endedAt);
      gameState.setEndTriggeredBy(by);
      canvasBus.emit('game-end', { triggeredBy: by, leaderboard, autoRestartSeconds: this.config.autoRestartSeconds, endedAt });
      logStore.append('OK', `Partida finalizada (${by})`);
      this.publishState();
      if (this.config.autoRestartSeconds > 0) {
        // El conteo de inicio (3 s) ocupa los últimos 3 s del auto-reinicio (documento §5.3).
        const delayMs = Math.max(0, this.config.autoRestartSeconds - 3) * 1000;
        this.autoRestartTimer = setTimeout(() => this.startGame(), delayMs);
      }
    });
  }

  pauseGame(): void {
    if (gameState.getStatus() !== 'ACTIVE') return;
    gameState.setStatus('PAUSED');
    this.refreshAmbient();
    canvasBus.emit('paused', { triggeredBy: this.config.adminName });
    logStore.append('SYSTEM', 'Juego en pausa');
    this.publishState();
  }

  resumeGame(): void {
    if (gameState.getStatus() !== 'PAUSED') return;
    gameState.setStatus('ACTIVE');
    this.refreshAmbient();
    canvasBus.emit('resumed', { triggeredBy: this.config.adminName });
    logStore.append('SYSTEM', 'Juego reanudado');
    this.publishState();
  }

  resetCanvas(): void {
    this.executeReset({ manual: true, username: this.config.adminName });
  }

  reloadCanvas(): void {
    canvasBus.emit('reload-canvas', {});
    logStore.append('MANUAL', 'Recarga remota del lienzo');
  }

  /** El lienzo está totalmente visible (sin overlays): las herramientas solo actúan aquí. */
  isLiveReady(): boolean {
    return (
      gameState.getStatus() === 'ACTIVE' &&
      gameState.getConnectionState() === 'connected' &&
      !this.starting &&
      gameState.getCountdownEndsAt() === null
    );
  }

  // ── Duracion automatica (nunca se detiene, ni en pausa) ───────
  private startDurationTimer(ms: number): void {
    this.clearTimer('durationTimer');
    if (ms <= 0) return;
    this.durationTimer = setTimeout(() => this.endGame(this.config.adminName), ms);
  }

  // ── Reconexion con el live ───────────────────────────────────
  private handleDisconnect(reason: 'error' | 'stream_end'): void {
    if (reason === 'stream_end') {
      logStore.append('SYSTEM', 'La transmisión finalizó');
      this.endGame('stream_end');
      return;
    }
    // Ignora caídas cuando no hay partida ni inicio en curso.
    if (gameState.getStatus() === 'INACTIVE' && !this.starting) return;
    logStore.append('SYSTEM', 'Conexión con el live perdida; reconectando');
    this.beginReconnect();
  }

  private beginReconnect(): void {
    this.clearReconnect();
    this.reconnectAttempt = 0;
    this.scheduleReconnect();
  }

  private reconnectDelayMs(): number {
    const base = env.PLATFORM_RECONNECT_INITIAL_DELAY_SECONDS * Math.pow(env.PLATFORM_RECONNECT_MULTIPLIER, this.reconnectAttempt - 1);
    // En desarrollo lo acotamos para que la reconexión sea observable.
    return Math.min(base, env.NODE_ENV === 'production' ? 600 : 4) * 1000;
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    const attempt = this.reconnectAttempt;
    const max = env.PLATFORM_RECONNECT_MAX_ATTEMPTS;
    const channel = this.config.liveChannel;
    gameState.setConnectionState('reconnecting');
    gameState.setReconnect({ attempt, maxAttempts: max });
    this.emitConnection('reconnecting', attempt, max);
    logStore.append('INFO', `Reintento de conexión ${attempt}/${max}`);
    this.refreshAmbient();
    this.publishState();
    this.reconnectTimer = setTimeout(() => {
      this.platform
        .connect(channel)
        .then(() => {
          this.clearReconnect();
          gameState.setConnectionState('connected');
          gameState.setReconnect(null);
          this.emitConnection('connected');
          logStore.append('OK', `Reconectado a ${channel}`);
          this.refreshAmbient();
          this.publishState();
        })
        .catch((err: Error) => {
          logStore.append('ERROR', `Fallo de reconexión ${attempt}/${max}: ${err.message}`);
          if (attempt >= max) {
            gameState.setConnectionState('failed');
            this.emitConnection('failed', attempt, max);
            logStore.append('ERROR', `No se pudo reconectar a ${channel}; espera acción manual`);
            this.refreshAmbient();
            this.publishState();
          } else {
            this.scheduleReconnect();
          }
        });
    }, this.reconnectDelayMs());
  }

  /** Reintento manual (botón «Reconectar» del panel). */
  reconnectNow(): void {
    if (gameState.getConnectionState() !== 'failed') return;
    this.clearReconnect();
    this.reconnectAttempt = 0;
    logStore.append('MANUAL', 'Reintento de conexión manual');
    this.scheduleReconnect();
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  // Helper de prueba (audiencia simulada): fuerza una caída de la conexión.
  simulateDrop(reason: 'error' | 'stream_end'): void {
    const sim = this.platform as Partial<SimulationControl>;
    if (typeof sim.simulateDrop === 'function') sim.simulateDrop(reason);
    else this.handleDisconnect(reason);
  }

  // ── Timers ───────────────────────────────────────────────────
  private clearTimer(name: 'countdownTimer' | 'autoRestartTimer' | 'durationTimer'): void {
    const t = this[name];
    if (t) clearTimeout(t);
    this[name] = null;
  }
  private clearGameTimers(): void {
    this.clearTimer('countdownTimer');
    this.clearTimer('autoRestartTimer');
    this.clearTimer('durationTimer');
    this.starting = false;
  }

  // ── Cooldown (solo afecta al live; las acciones del admin son instantáneas) ──
  private actor(ctx: Ctx): string {
    return ctx.manual ? this.config.adminName : `@${ctx.username}`;
  }
  private inCooldown(ctx: Ctx): boolean {
    if (ctx.manual) return false;
    return gameState.inCooldown(ctx.username, Date.now());
  }
  private startCooldown(ctx: Ctx): void {
    if (ctx.manual || this.config.cooldownSeconds <= 0) return;
    gameState.setCooldown(ctx.username, Date.now() + this.config.cooldownSeconds * 1000);
  }
  private notifyError(ctx: Ctx, message: string): void {
    const actor = this.actor(ctx);
    canvasBus.emit('notification', { type: 'error', message: `${actor}: ${message}`, username: actor });
    logStore.append('ERROR', `${actor}: ${message}`);
  }

  // ── Entradas de la plataforma de live ────────────────────────
  private canProcessLive(): boolean {
    return gameState.getStatus() === 'ACTIVE' && gameState.getConnectionState() === 'connected';
  }

  private handleComment(rawUser: string, rawMessage: string): void {
    if (!this.canProcessLive()) return;
    this.dispatchMessage(rawUser, rawMessage, { manual: false });
  }
  private handleGift(rawUser: string, giftId: string, giftName: string): void {
    // Sin conexión con el live no se procesa nada.
    if (gameState.getConnectionState() !== 'connected') return;
    const status = gameState.getStatus();
    // En pausa el regalo NO provoca efectos, pero SÍ puede auto-registrarse (única acción
    // permitida en pausa). En directo, se procesa por completo. En cualquier otro estado, se ignora.
    if (status === 'ACTIVE') void this.processGift(rawUser, giftId, giftName, { effects: true });
    else if (status === 'PAUSED') void this.processGift(rawUser, giftId, giftName, { effects: false });
  }

  dispatchMessage(rawUser: string, rawMessage: string, opts: { manual: boolean }): void {
    const username = rawUser.slice(0, 50);
    const message = rawMessage.slice(0, 200).trim();
    const head = message.split(/\s+/)[0] ?? '';
    const prefix = this.config.commandPrefix;
    if (!head.startsWith(prefix)) return;
    const name = head.slice(prefix.length).toLowerCase();
    const command = this.commands.find((c) => c.name.toLowerCase() === name);
    if (!command) return;
    const ctx: Ctx = { manual: opts.manual, username };
    if (command.actionType === 'draw_pixel') this.executeDraw(ctx, message.split(/\s+/).slice(1));
  }

  private executeDraw(ctx: Ctx, args: string[]): void {
    // En cooldown se ignora TODO, incluidos los errores; y cualquier intento (válido o no)
    // consume el cooldown. El admin (manual) nunca tiene cooldown, así que siempre recibe aviso.
    if (this.inCooldown(ctx)) return;
    const prefix = this.config.commandPrefix;
    const cmdName = this.commands[0]?.name ?? 'p';
    if (args.length !== 3) {
      this.notifyError(ctx, `Formato inválido. Usa ${prefix}${cmdName} X Y color`);
      this.startCooldown(ctx);
      return;
    }
    const [xs, ys, token] = args as [string, string, string];
    if (!/^-?\d+$/.test(xs) || !/^-?\d+$/.test(ys)) {
      this.notifyError(ctx, 'Las coordenadas deben ser números enteros');
      this.startCooldown(ctx);
      return;
    }
    const x = Number(xs);
    const y = Number(ys);
    if (x < 1 || y < 1 || x > this.config.canvasWidth || y > this.config.canvasHeight) {
      this.notifyError(ctx, `Coordenada fuera del lienzo. X entre 1 y ${this.config.canvasWidth}, Y entre 1 y ${this.config.canvasHeight}`);
      this.startCooldown(ctx);
      return;
    }
    const color = resolveColor(token, this.colors);
    if (!color) {
      this.notifyError(ctx, `Color "${token}" no reconocido`);
      this.startCooldown(ctx);
      return;
    }
    gameState.setPixel(x, y, color);
    canvasBus.emit('pixel', { x, y, color, username: this.actor(ctx) });
    logStore.append('OK', `${this.actor(ctx)} pintó (${x}, ${y}) ${this.colorName(color)}`);
    this.startCooldown(ctx);
    if (!ctx.manual) {
      void statsRepo.increment(ctx.username, 1);
      this.scheduleLeaderboardPublish();
    }
  }

  executeShape(ctx: Ctx, params: ShapeParamsLike, opts: { silent?: boolean } = {}): void {
    const figure = this.figures.find((f) => f.id === params.figureId);
    if (!figure) {
      this.notifyError(ctx, 'Figura no encontrada');
      return;
    }
    const { cols, rows } = patternDims(figure.pattern);
    const sCols = cols * params.scale;
    const sRows = rows * params.scale;
    if (sCols > this.config.canvasWidth || sRows > this.config.canvasHeight) {
      this.notifyError(ctx, 'La figura no cabe en el área de juego');
      return;
    }
    let x0: number;
    let y0: number;
    if (params.position === 'specific') {
      x0 = params.x ?? 1;
      y0 = params.y ?? 1;
      if (x0 < 1 || y0 < 1 || x0 + sCols - 1 > this.config.canvasWidth || y0 + sRows - 1 > this.config.canvasHeight) {
        this.notifyError(ctx, 'La figura no cabe en la posición indicada');
        return;
      }
    } else {
      x0 = randInt(1, this.config.canvasWidth - sCols + 1);
      y0 = randInt(1, this.config.canvasHeight - sRows + 1);
    }
    const color = params.color === 'random' ? randomColor(this.colors) : normalizeHex(params.color) ?? '#FFFFFF';
    const frames = buildFigureFrames(scaleFigure(figure.pattern, params.scale));
    const pixels = frames.pixels.map((p) => ({ x: x0 + p.col, y: y0 + (sRows - 1 - p.row), frame: p.frame }));
    for (const p of pixels) gameState.setPixel(p.x, p.y, color);
    canvasBus.emit('shape', {
      figureId: figure.id,
      figureName: figure.name,
      color,
      pixels,
      frameCount: frames.frameCount,
      frameIntervalMs: frames.frameIntervalMs,
      animationDurationMs: 1000,
      username: this.actor(ctx),
    });
    if (!opts.silent) logStore.append('OK', `${this.actor(ctx)} lanzó ${figure.name}`);
    if (!ctx.manual) {
      void statsRepo.increment(ctx.username, pixels.length);
      this.scheduleLeaderboardPublish();
    }
  }

  executeRain(ctx: Ctx, params: RainParamsLike, opts: { silent?: boolean } = {}): void {
    const multicolor = params.color === 'multicolor';
    const baseHex = multicolor ? null : params.color === 'random' ? randomColor(this.colors) : normalizeHex(params.color) ?? '#FFFFFF';
    const pixels = Array.from({ length: params.pixelCount }, () => ({
      x: randInt(1, this.config.canvasWidth),
      destinationY: randInt(1, this.config.canvasHeight),
      color: multicolor ? randomColor(this.colors) : baseHex!,
      delayMs: randInt(0, params.durationSeconds * 1000),
    }));
    for (const p of pixels) gameState.setPixel(p.x, p.destinationY, p.color);
    canvasBus.emit('rain', {
      color: multicolor ? 'multicolor' : baseHex!,
      pixels,
      durationSeconds: params.durationSeconds,
      username: this.actor(ctx),
    });
    if (!opts.silent) logStore.append('OK', `${this.actor(ctx)} lanzó lluvia (${params.pixelCount})`);
    if (!ctx.manual) {
      void statsRepo.increment(ctx.username, params.pixelCount);
      this.scheduleLeaderboardPublish();
    }
  }

  private executeReset(ctx: Ctx, opts: { silent?: boolean } = {}): void {
    const by = this.actor(ctx);
    canvasBus.emit('reset', { triggeredBy: by });
    gameState.clearPixels();
    if (!opts.silent) logStore.append('OK', `${by} reinició el lienzo`);
  }

  // ── Herramientas (manual = true; siempre instantáneas, sin cooldown) ─────────
  toolCommand(command: string): void {
    this.dispatchMessage(this.config.adminName, command, { manual: true });
  }
  toolShape(params: ShapeParamsLike): void {
    this.executeShape({ manual: true, username: this.config.adminName }, params);
  }
  toolRain(params: RainParamsLike): void {
    this.executeRain({ manual: true, username: this.config.adminName }, params);
  }

  // ── Regalos ──────────────────────────────────────────────────
  /** Descripción corta de un efecto para el log-resumen de un regalo. */
  private effectLabel(effect: GiftEffectSequence[number]): string {
    switch (effect.effectType) {
      case 'shape':
        return this.figures.find((f) => f.id === effect.params.figureId)?.name ?? 'figura';
      case 'rain':
        return `lluvia (${effect.params.pixelCount})`;
      case 'reset':
        return 'reinicio del lienzo';
      case 'end_game':
        return 'fin de partida';
    }
  }

  async processGift(rawUser: string, giftId: string, giftName?: string, opts: { effects: boolean } = { effects: true }): Promise<void> {
    const ctx: Ctx = { manual: false, username: rawUser.slice(0, 50) };
    let gift = this.gifts.find((g) => g.giftId === giftId);
    // Auto-registro: se hace siempre (también en pausa) si está activado, aunque no dispare efectos.
    if (!gift) {
      if (this.config.autoRegisterGifts) {
        try {
          const created = await giftRepo.create({ giftId, name: giftName || giftId });
          logStore.append('INFO', `Regalo "${giftName || giftId}" añadido automáticamente`);
          await this.reloadAll();
          gift = created;
        } catch {}
      }
      return;
    }
    // En pausa el regalo se registra en la consola pero NO dispara ningún efecto.
    if (!opts.effects) {
      logStore.append('GIFT', `${this.actor(ctx)} envió ${gift.name}`);
      return;
    }
    if (this.inCooldown(ctx)) return;
    const effects = this.giftEffects.get(gift.giftId);
    if (!effects || effects.length === 0) {
      logStore.append('GIFT', `${this.actor(ctx)} envió ${gift.name}`);
      return;
    }
    // Un solo log que resume TODOS los efectos del regalo (en vez de uno por efecto).
    logStore.append('GIFT', `${this.actor(ctx)} envió ${gift.name} → ${effects.map((e) => this.effectLabel(e)).join(' + ')}`);
    for (const effect of effects) {
      if (effect.effectType === 'shape') {
        this.executeShape(ctx, effect.params, { silent: true });
        await this.sleep(FIGURE_ANIMATION_DURATION_MS + DELAY_FOR_EFFECTS_MS);
      } else if (effect.effectType === 'rain') {
        this.executeRain(ctx, effect.params, { silent: true });
        await this.sleep((effect.params.durationSeconds * 1000) + DELAY_FOR_EFFECTS_MS);
      } else if (effect.effectType === 'reset') {
        this.executeReset(ctx, { silent: true });
        await this.sleep(ERASE_DURATION_MS + DELAY_FOR_EFFECTS_MS);
      } else if (effect.effectType === 'end_game') {
        this.endGame(this.actor(ctx));
        break;
      }
    }
    this.startCooldown(ctx);
  }

  sleep(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }
}
