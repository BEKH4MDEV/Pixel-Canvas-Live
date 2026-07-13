import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasEvent, CanvasState, ClientConfig, ConnectionState, GameStatus, ReconnectInfo } from '@pcl/contracts';
import { NOTIFICATION_LIFETIME_SECONDS, OVERLAY_MAX_NOTIFICATIONS } from '@pcl/contracts';
import { AudioManager, type SoundKey } from '@/lib/audio';
import { CanvasRenderer, type RendererConfig } from '@/lib/canvas-renderer';
import { canvasSse, fetchCanvasState, type SseStatus } from '@/data/canvas-realtime';
import type { OverlayNotification, ResultsData, ScreenSpec, UrlFlags } from './types';

const ERASE_DURATION_MS = 1000;

const DEFAULT_CONFIG: ClientConfig = {
  pixelSize: 10,
  showGrid: false,
  showCoords: true,
  overlayVisible: true,
  canvasWidth: 160,
  canvasHeight: 90,
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
};

/** Dimensiones de estado sincronizadas con el servidor; el stack de overlays se deriva de aquí. */
interface Dims {
  status: GameStatus;
  connectionState: ConnectionState;
  starting: boolean;
  startFailed: boolean;
  reconnect: ReconnectInfo | null;
  countdownEndsAt: number | null;
}

const INITIAL_DIMS: Dims = {
  status: 'INACTIVE',
  connectionState: 'disconnected',
  starting: false,
  startFailed: false,
  reconnect: null,
  countdownEndsAt: null,
};

interface Options {
  flags: UrlFlags;
}

let notifSeq = 0;

export function useCanvasController({ flags }: Options) {
  const [sseStatus, setSseStatus] = useState<SseStatus>('connecting');
  const [everConnected, setEverConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dims, setDimsState] = useState<Dims>(INITIAL_DIMS);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [notifications, setNotifications] = useState<OverlayNotification[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [channel, setChannel] = useState('');

  const rendererRef = useRef<CanvasRenderer | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const configRef = useRef<ClientConfig>(DEFAULT_CONFIG);
  const pixelsRef = useRef<{ x: number; y: number; color: string }[] | null>(null);
  const notifTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const endSoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  // Espejo de las dimensiones para leerlas dentro de los handlers sin closures obsoletos.
  const dimsRef = useRef<Dims>(INITIAL_DIMS);
  // Tras finalizar (resultados visibles) se descartan los eventos de pintado entrantes, y el
  // borrado de finalización deja el lienzo en blanco garantizado.
  const endedRef = useRef(false);

  const updateDims = useCallback((patch: Partial<Dims>) => {
    dimsRef.current = { ...dimsRef.current, ...patch };
    setDimsState(dimsRef.current);
  }, []);

  const effectiveRendererConfig = useCallback((): Partial<RendererConfig> => {
    const c = configRef.current;
    const f = flagsRef.current;
    return {
      pixelSize: c.pixelSize,
      showGrid: c.showGrid && f.grid,
      showCoords: c.showCoords && f.coords,
      canvasWidth: c.canvasWidth,
      canvasHeight: c.canvasHeight,
    };
  }, []);

  const overlayEnabled = useCallback(() => configRef.current.overlayVisible && flagsRef.current.overlay, []);

  const playSound = useCallback((kind: SoundKey) => {
    const c = configRef.current;
    const map: Record<SoundKey, readonly [string | null, number]> = {
      pixel: [c.soundPixelFile, c.soundPixelVolume],
      rain: [c.soundRainFile, c.soundRainVolume],
      reset: [c.soundResetFile, c.soundResetVolume],
      figure: [c.soundFigureFile, c.soundFigureVolume],
      end: [c.soundEndFile, c.soundEndVolume],
    };
    const [file, volume] = map[kind];
    audioRef.current?.play(kind, file, volume);
  }, []);

  // ── Notificaciones ───────────────────────────────────────────
  const removeNotif = useCallback((id: number) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
    const t = notifTimers.current.get(id);
    if (t) {
      clearTimeout(t);
      notifTimers.current.delete(id);
    }
  }, []);

  const pushNotif = useCallback(
    (item: Omit<OverlayNotification, 'id'>) => {
      if (!overlayEnabled()) return;
      const id = ++notifSeq;
      setNotifications((list) => {
        const next = [{ ...item, id }, ...list];
        return next.length > OVERLAY_MAX_NOTIFICATIONS ? next.slice(0, OVERLAY_MAX_NOTIFICATIONS) : next;
      });
      notifTimers.current.set(id, setTimeout(() => removeNotif(id), NOTIFICATION_LIFETIME_SECONDS * 1000));
    },
    [overlayEnabled, removeNotif],
  );

  // ── Cuenta atrás dirigida por la marca de tiempo del servidor ─
  useEffect(() => {
    const endsAt = dims.countdownEndsAt;
    if (endsAt == null) {
      setCountdownNum(null);
      return;
    }
    const tick = (): void => {
      const remaining = Math.ceil((endsAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdownNum(null);
        // El conteo terminó en el cliente; la fase real la dictan game-start / connection.
        if (dimsRef.current.countdownEndsAt === endsAt) updateDims({ countdownEndsAt: null });
      } else {
        setCountdownNum(Math.min(remaining, 3));
      }
    };
    tick();
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, [dims.countdownEndsAt, updateDims]);

  const clearEndSound = useCallback(() => {
    if (endSoundTimer.current) clearTimeout(endSoundTimer.current);
    endSoundTimer.current = null;
  }, []);

  // ── ¿Se puede pintar ahora mismo? ────────────────────────────
  const canPaint = useCallback((): boolean => {
    const d = dimsRef.current;
    return d.status === 'ACTIVE' && d.connectionState === 'connected' && !d.starting && !endedRef.current;
  }, []);

  // ── Resincronización silenciosa (sin pantalla de carga) ──────
  const resync = useRef<() => void>(() => {});

  // ── Eventos del lienzo ───────────────────────────────────────
  const handleEvent = useCallback(
    (event: CanvasEvent) => {
      const renderer = rendererRef.current;
      const isPaint = event.type === 'pixel' || event.type === 'shape' || event.type === 'rain' || event.type === 'reset';
      if (isPaint && !canPaint()) return;

      switch (event.type) {
        case 'pixel':
          renderer?.paintPixel(event.payload.x, event.payload.y, event.payload.color);
          playSound('pixel');
          pushNotif({ kind: 'success', actor: event.payload.username, x: event.payload.x, y: event.payload.y, color: event.payload.color });
          break;
        case 'shape': {
          renderer?.playShape(event.payload);
          playSound('figure');
          const xs = event.payload.pixels.map((p) => p.x);
          const ys = event.payload.pixels.map((p) => p.y);
          pushNotif({ kind: 'shape', actor: event.payload.username, figureName: event.payload.figureName, color: event.payload.color, x: Math.min(...xs), y: Math.min(...ys) });
          break;
        }
        case 'rain':
          renderer?.playRain(event.payload);
          playSound('rain');
          pushNotif({ kind: 'rain', actor: event.payload.username, color: event.payload.color === 'multicolor' ? undefined : event.payload.color, multicolor: event.payload.color === 'multicolor', count: event.payload.pixels.length });
          break;
        case 'reset':
          renderer?.playErase();
          playSound('reset');
          pushNotif({ kind: 'reset', actor: event.payload.triggeredBy });
          break;
        case 'countdown':
          endedRef.current = false;
          clearEndSound();
          renderer?.clearInstant();
          setResults(null);
          updateDims({ starting: true, startFailed: false, countdownEndsAt: Date.parse(event.payload.endsAt) });
          break;
        case 'game-start':
          endedRef.current = false;
          renderer?.clearInstant(); // lienzo en blanco garantizado al iniciar
          setResults(null);
          updateDims({ status: 'ACTIVE', starting: false, startFailed: false, countdownEndsAt: null });
          break;
        case 'game-end': {
          endedRef.current = true;
          renderer?.cancelIncoming(); // detiene lluvias/figuras a medio pintar
          audioRef.current?.stopAll(); // cancela cualquier sonido en curso
          renderer?.playErase();
          playSound('reset');
          // El sonido de fin suena cuando empiezan a aparecer los resultados (tras el borrado).
          clearEndSound();
          endSoundTimer.current = setTimeout(() => playSound('end'), ERASE_DURATION_MS);
          setResults({
            triggeredBy: event.payload.triggeredBy,
            leaderboard: event.payload.leaderboard,
            autoRestartSeconds: event.payload.autoRestartSeconds,
            endedAtMs: Date.parse(event.payload.endedAt),
            animate: true,
          });
          updateDims({ status: 'INACTIVE', starting: false, startFailed: false, connectionState: 'disconnected', countdownEndsAt: null, reconnect: null });
          break;
        }
        case 'paused':
          updateDims({ status: 'PAUSED' });
          break;
        case 'resumed':
          updateDims({ status: 'ACTIVE' });
          resync.current(); // GET del estado completo por si acaso (documento §2.2)
          break;
        case 'connection': {
          const p = event.payload;
          if (p.channel) setChannel(p.channel);
          if (p.state === 'connecting') updateDims({ connectionState: 'connecting' });
          else if (p.state === 'connected') updateDims({ connectionState: 'connected', reconnect: null });
          else if (p.state === 'reconnecting') updateDims({ connectionState: 'reconnecting', reconnect: { attempt: p.attempt ?? 0, maxAttempts: p.maxAttempts ?? 0 } });
          else if (p.state === 'failed') updateDims({ connectionState: 'failed' });
          else if (p.state === 'disconnected') {
            // Un "disconnected" mientras se inicia = falló la primera conexión: aborta el inicio.
            if (dimsRef.current.starting) updateDims({ connectionState: 'disconnected', starting: false, startFailed: true, countdownEndsAt: null });
            else updateDims({ connectionState: 'disconnected' });
          }
          break;
        }
        case 'notification':
          // El lienzo solo muestra las notificaciones de error (del chat o de herramientas).
          if (event.payload.type === 'error') pushNotif({ kind: 'error', message: event.payload.message, actor: event.payload.username });
          break;
        case 'config-update':
          configRef.current = { ...configRef.current, ...event.payload };
          renderer?.configure(effectiveRendererConfig());
          audioRef.current?.setMuted(configRef.current.soundMuted);
          setOverlayVisible(overlayEnabled());
          if (event.payload.adminName) setAdminName(event.payload.adminName);
          break;
        case 'reload-canvas':
          window.location.reload();
          break;
      }
    },
    [canPaint, playSound, pushNotif, updateDims, clearEndSound, effectiveRendererConfig, overlayEnabled],
  );

  // ── Carga / resincronización del estado (sin animación de entrada) ──
  const applyState = useCallback(
    (state: CanvasState) => {
      endedRef.current = state.status === 'INACTIVE' && state.endedAt != null;

      configRef.current = state.config;
      setAdminName(state.config.adminName);
      setChannel(state.channel);
      audioRef.current?.setMuted(state.config.soundMuted);
      setOverlayVisible(overlayEnabled());
      pixelsRef.current = state.pixels;
      rendererRef.current?.configure(effectiveRendererConfig());
      rendererRef.current?.setPixels(state.pixels);

      const cdEnds = state.countdownEndsAt ? Date.parse(state.countdownEndsAt) : null;
      updateDims({
        status: state.status,
        connectionState: state.connectionState,
        starting: state.starting,
        startFailed: state.startFailed,
        reconnect: state.reconnect,
        countdownEndsAt: cdEnds && cdEnds > Date.now() ? cdEnds : null,
      });

      if (state.status === 'INACTIVE' && state.endedAt) {
        const endedAtMs = Date.parse(state.endedAt);
        // Conserva los resultados de ESTE mismo fin (no degrada la animación en vivo).
        setResults((prev) =>
          prev && prev.endedAtMs === endedAtMs
            ? prev
            : {
                triggeredBy: state.endTriggeredBy ?? '',
                leaderboard: state.leaderboard,
                autoRestartSeconds: state.autoRestartSeconds,
                endedAtMs,
                animate: false,
              },
        );
      } else {
        setResults(null);
      }
      setLoading(false);
    },
    [overlayEnabled, effectiveRendererConfig, updateDims],
  );

  // ── Inicialización ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const audio = new AudioManager();
    audioRef.current = audio;
    audio.setTabSilenced(!flagsRef.current.sound);
    const offBlocked = audio.onBlockedChange(setAudioBlocked);

    const doResync = (): void => {
      void fetchCanvasState().then((state) => {
        if (!cancelled) applyState(state);
      });
    };
    resync.current = doResync;

    const offEvents = canvasSse.subscribe(handleEvent);
    const offStatus = canvasSse.onStatus((status) => {
      setSseStatus(status);
      if (status === 'connected') {
        setEverConnected(true);
        // Regla de oro: ante (re)conexión, re-pedir el estado completo.
        doResync();
      }
    });
    canvasSse.start();

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        canvasSse.close();
      } else {
        setLoading(true); // como si fuera la primera vez que se abre la URL
        canvasSse.reconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      offEvents();
      offStatus();
      offBlocked();
      canvasSse.close();
      clearEndSound();
      audio.dispose();
      notifTimers.current.forEach(clearTimeout);
      notifTimers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Montaje del canvas ───────────────────────────────────────
  const setCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node) {
        const renderer = new CanvasRenderer(node);
        rendererRef.current = renderer;
        renderer.configure(effectiveRendererConfig());
        renderer.start();
        if (pixelsRef.current) renderer.setPixels(pixelsRef.current);
        const ro = new ResizeObserver(() => renderer.resize());
        ro.observe(node.parentElement ?? node);
        roRef.current = ro;
      } else {
        roRef.current?.disconnect();
        roRef.current = null;
        rendererRef.current?.destroy();
        rendererRef.current = null;
      }
    },
    [effectiveRendererConfig],
  );

  const unlockAudio = useCallback(() => void audioRef.current?.unlock(), []);

  // ── Derivación del stack de overlays ─────────────────────────
  const topScreen = useMemo<ScreenSpec | null>(() => {
    if (sseStatus === 'failed') return { kind: 'server-failed', message: 'No se pudo conectar con el servidor. Recarga la página para reintentar', spinner: false };
    if (loading) return { kind: 'loading', message: 'Cargando el lienzo', spinner: true };
    if (sseStatus === 'connecting' && everConnected) return { kind: 'server-reconnect', message: 'Reconectando con el servidor', spinner: true };
    return null;
  }, [sseStatus, loading, everConnected]);

  const baseScreen = useMemo<ScreenSpec | null>(() => {
    if (results) return null;
    const d = dims;
    if (d.status === 'INACTIVE') {
      if (d.startFailed) return { kind: 'live-failed', message: `No se pudo conectar al live de ${channel}`, spinner: false };
      if (d.starting) return { kind: 'connecting-live', message: `Conectando al live de ${channel}`, spinner: true };
      return { kind: 'waiting', message: `Esperando a que ${adminName} inicie el juego`, spinner: false };
    }
    if (d.connectionState === 'reconnecting') {
      const text = d.reconnect && d.reconnect.maxAttempts > 0
        ? `Reconectando al live de ${channel} (intento ${d.reconnect.attempt} de ${d.reconnect.maxAttempts})`
        : `Reconectando al live de ${channel}`;
      return { kind: 'live-reconnect', message: text, spinner: true };
    }
    if (d.connectionState === 'failed') return { kind: 'live-failed', message: `No se pudo conectar al live de ${channel}. Esperando a que ${adminName} intente nuevamente`, spinner: false };
    return null; // ACTIVE/PAUSED conectado → lienzo visible (la pausa lleva su propia capa)
  }, [results, dims, channel, adminName]);

  const pauseActive = dims.status === 'PAUSED';

  return {
    setCanvas,
    topScreen,
    baseScreen,
    pauseActive,
    countdownNum,
    results,
    notifications,
    dismissNotif: removeNotif,
    overlayVisible,
    audioBlocked,
    unlockAudio,
    adminName,
  };
}
