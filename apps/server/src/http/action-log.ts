import type { NextFunction, Request, Response } from 'express';
import { logStore } from '../realtime/log-store';

/**
 * Registro de acciones del panel en la consola del servidor. Toda mutacion del admin que
 * termine con exito deja una linea MANUAL en la consola, con un mensaje especifico segun la
 * ruta. Las acciones de partida/lienzo/herramientas NO se registran aqui: ya las registra el
 * motor con su propia semantica (pixel, figura, reinicio, inicio/fin, etc.).
 */

const CRUD_LABELS: Record<string, Record<string, string>> = {
  commands: { POST: 'Comando creado', PUT: 'Comando actualizado', DELETE: 'Comando eliminado' },
  colors: { POST: 'Color creado', PUT: 'Color actualizado', DELETE: 'Color eliminado' },
  figures: { POST: 'Figura creada', PUT: 'Figura actualizada', DELETE: 'Figura eliminada' },
  gifts: { POST: 'Regalo creado', PUT: 'Regalo actualizado', DELETE: 'Regalo eliminado' },
};

const CONFIG_LABELS: Record<string, { label: string; bool?: [string, string] }> = {
  showGrid: { label: 'Cuadrícula', bool: ['activada', 'desactivada'] },
  showCoords: { label: 'Coordenadas', bool: ['activadas', 'desactivadas'] },
  overlayVisible: { label: 'Notificaciones del lienzo', bool: ['activadas', 'desactivadas'] },
  pixelSize: { label: 'Tamaño de píxel' },
  canvasWidth: { label: 'Área de juego' },
  canvasHeight: { label: 'Área de juego' },
  cooldownSeconds: { label: 'Cooldown' },
  autoRestartSeconds: { label: 'Auto reinicio' },
  gameDurationMinutes: { label: 'Duración de partida' },
  adminName: { label: 'Nombre del creador' },
  liveChannel: { label: 'Canal del directo' },
  commandPrefix: { label: 'Prefijo de comandos' },
  soundMuted: { label: 'Silencio global', bool: ['activado', 'desactivado'] },
  soundPixelVolume: { label: 'Volumen del píxel' },
  soundRainVolume: { label: 'Volumen de la lluvia' },
  soundResetVolume: { label: 'Volumen del reinicio' },
  soundFigureVolume: { label: 'Volumen de las figuras' },
  soundEndVolume: { label: 'Volumen del fin de partida' },
  autoRegisterGifts: { label: 'Auto registro de regalos', bool: ['activado', 'desactivado'] },
  platformSimulation: { label: 'Audiencia simulada', bool: ['activada', 'desactivada'] },
  sessionDurationMinutes: { label: 'Duración de sesión' },
  sessionExpireOnClose: { label: 'Expirar la sesión al cerrar', bool: ['activada', 'desactivada'] },
};

function configLogMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Configuración actualizada';
  const keys = Object.keys(body as Record<string, unknown>);
  if (keys.length === 1) {
    const key = keys[0]!;
    const meta = CONFIG_LABELS[key];
    const value = (body as Record<string, unknown>)[key];
    if (meta) {
      if (meta.bool && typeof value === 'boolean') return `${meta.label} ${value ? meta.bool[0] : meta.bool[1]}`;
      return `${meta.label} actualizado`;
    }
  }
  return 'Configuración actualizada';
}

/** Mensaje de consola para una accion del panel (o null si no aplica). */
export function adminActionLog(method: string, path: string, body: unknown): string | null {
  if (method === 'GET') return null;
  if (/\/(game|canvas|platform|tools)(\/|$)/.test(path)) return null;
  if (path.includes('/config')) return configLogMessage(body);
  if (path.includes('/security/pin')) return 'PIN actualizado';
  if (method === 'DELETE') {
    if (/\/admin\/commands$/.test(path)) return 'Todos los comandos eliminados';
    if (/\/admin\/colors$/.test(path)) return 'Todos los colores eliminados';
    if (/\/admin\/figures$/.test(path)) return 'Todas las figuras eliminadas';
    if (/\/admin\/gifts$/.test(path)) return 'Todos los regalos eliminados';
    if (/\/admin\/effects$/.test(path)) return 'Todas las acciones de regalos eliminadas';
    if (/\/admin\/stats\/historical$/.test(path)) return 'Histórico eliminado';
  }
  if (path.includes('/stats/reset-global')) return 'Histórico global reiniciado';
  if (path.includes('/effects')) return method === 'DELETE' ? 'Efectos de regalo eliminados' : 'Efectos de regalo guardados';
  if (path.includes('/sounds')) return method === 'DELETE' ? 'Sonido eliminado' : 'Sonido actualizado';
  for (const key of Object.keys(CRUD_LABELS)) {
    if (path.includes(`/${key}`)) return CRUD_LABELS[key]![method] ?? null;
  }
  return null;
}

/** Middleware del panel: registra en consola cada mutacion exitosa. */
export function logAdminActions(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET') {
    next();
    return;
  }
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const message = adminActionLog(req.method, req.originalUrl, req.body);
    if (message) logStore.append('MANUAL', message);
  });
  next();
}
