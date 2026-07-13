import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import type { SessionState } from '@pcl/contracts';
import { env, isProd } from '../config/env';
import { authRepo, configRepo } from '../db/repositories';
import { logger } from '../observability/logger';

const COOKIE = 'pcl_session';
const PIN_HASH_KEY = 'pinHash';

interface Session {
  expiresAt: number | null;
}

/** Sesiones en memoria (un solo proceso, un solo creador). */
const sessions = new Map<string, Session>();

function isValid(token: string | undefined): boolean {
  if (!token) return false;
  const s = sessions.get(token);
  if (!s) return false;
  if (s.expiresAt !== null && Date.now() > s.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/**
 * Calcula expiresAt y reemite la cookie segun la config actual.
 * Se usa tanto al hacer login como al cambiar la configuracion de sesion
 * en caliente, para que una sesion ya abierta adopte el nuevo comportamiento
 * de inmediato (sin esperar al proximo login).
 */
function applySessionSettings(
  token: string,
  res: Response,
  config: { sessionDurationMinutes: number; sessionExpireOnClose: boolean },
): void {
  const durationMs = config.sessionDurationMinutes * 60_000;
  const expiresAt = config.sessionExpireOnClose ? null : Date.now() + durationMs;
  sessions.set(token, { expiresAt });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    signed: true,
    ...(config.sessionExpireOnClose ? {} : { maxAge: durationMs }),
  });
}

async function lockState(): Promise<Pick<SessionState, 'locked' | 'lockedUntil' | 'permanentlyLocked'>> {
  const row = await authRepo.get();
  let lockedUntil = row.lockedUntil;
  // Si el bloqueo temporal expiro, se libera (conservando los grupos consumidos).
  if (lockedUntil && Date.now() >= lockedUntil.getTime()) {
    await authRepo.update(row.id, { lockedUntil: null, attemptsInGroup: 0 });
    lockedUntil = null;
  }
  return {
    locked: lockedUntil !== null,
    lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
    permanentlyLocked: row.permanentlyLocked,
  };
}

export const auth = {
  async hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, 12);
  },

  async getSessionState(req: Request): Promise<SessionState> {
    const token = req.signedCookies?.[COOKIE] as string | undefined;
    const lock = await lockState();
    return { authenticated: isValid(token), ...lock };
  },

  async login(_req: Request, res: Response, pin: string): Promise<SessionState> {
    const lock = await lockState();
    if (lock.permanentlyLocked || lock.locked) return { authenticated: false, ...lock };

    const hash = (await configRepo.getRaw(PIN_HASH_KEY)) ?? '';
    const ok = hash ? await bcrypt.compare(pin, hash) : false;
    const row = await authRepo.get();

    if (ok) {
      await authRepo.update(row.id, { attemptsInGroup: 0, groupsUsed: 0, lockedUntil: null, permanentlyLocked: false });
      const config = await configRepo.getAll();
      const token = randomUUID();
      applySessionSettings(token, res, config);
      return { authenticated: true, locked: false, lockedUntil: null, permanentlyLocked: false };
    }

    // Fallo: avanza el contador de fuerza bruta (documento 08, §2).
    let attemptsInGroup = row.attemptsInGroup + 1;
    let groupsUsed = row.groupsUsed;
    let lockedUntil: Date | null = null;
    let permanentlyLocked = false;
    if (attemptsInGroup >= env.PIN_MAX_ATTEMPTS_PER_GROUP) {
      groupsUsed += 1;
      attemptsInGroup = 0;
      if (groupsUsed >= env.PIN_MAX_GROUPS) {
        permanentlyLocked = true;
      } else {
        const minutes = env.PIN_LOCKOUT_MINUTES * Math.pow(env.PIN_LOCKOUT_MULTIPLIER, groupsUsed - 1);
        lockedUntil = new Date(Date.now() + minutes * 60_000);
      }
    }
    await authRepo.update(row.id, { attemptsInGroup, groupsUsed, lockedUntil, permanentlyLocked });
    logger.warn('failed login attempt');
    return {
      authenticated: false,
      locked: lockedUntil !== null,
      lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
      permanentlyLocked,
    };
  },

  /**
   * Aplica de inmediato un cambio en sessionDurationMinutes / sessionExpireOnClose
   * a la sesion que hizo la peticion (si esta autenticada), reemitiendo su
   * cookie con el nuevo comportamiento.
   *
   * Se llama desde el endpoint PUT /config, DESPUES de configRepo.update(patch),
   * pasando el patch original (para saber que campos se tocaron) y el config
   * completo ya resuelto (para tener ambos valores aunque solo uno haya
   * cambiado). No consulta configRepo por su cuenta.
   */
  async applySessionConfig(
    req: Request,
    res: Response,
    patch: Partial<{ sessionDurationMinutes: number; sessionExpireOnClose: boolean }>,
    config: { sessionDurationMinutes: number; sessionExpireOnClose: boolean },
  ): Promise<void> {
    // Si el patch no toca ninguno de estos dos campos, no hay nada que reaplicar.
    if (patch.sessionDurationMinutes === undefined && patch.sessionExpireOnClose === undefined) return;

    const token = req.signedCookies?.[COOKIE] as string | undefined;
    if (!token || !isValid(token)) return;
    applySessionSettings(token, res, config);
  },

  logout(req: Request, res: Response): void {
    const token = req.signedCookies?.[COOKIE] as string | undefined;
    if (token) sessions.delete(token);
    res.clearCookie(COOKIE);
  },

  async changePin(req: Request, currentPin: string, newPin: string): Promise<void> {
    const hash = (await configRepo.getRaw(PIN_HASH_KEY)) ?? '';
    if (!(await bcrypt.compare(currentPin, hash))) throw new HttpError(400, 'El PIN actual no es correcto');
    if (currentPin === newPin) throw new HttpError(400, 'El nuevo PIN debe ser distinto');
    await configRepo.setRaw(PIN_HASH_KEY, await auth.hashPin(newPin));
    // Invalida las demas sesiones; la actual sobrevive.
    const current = req.signedCookies?.[COOKIE] as string | undefined;
    for (const token of [...sessions.keys()]) if (token !== current) sessions.delete(token);
    logger.info('pin changed; other sessions invalidated');
  },

  requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.signedCookies?.[COOKIE] as string | undefined;
    if (!isValid(token)) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    next();
  },
};

/** Error con codigo HTTP para el manejador central. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}