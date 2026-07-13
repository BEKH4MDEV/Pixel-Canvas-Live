/**
 * Reproduccion de sonidos del lienzo. Todos son globales.
 * - Mismo tipo: se cancela y vuelve a sonar.
 * - Distinto tipo: se solapan sin interrumpirse.
 * - Silencio global: nada suena.
 * - Autoplay bloqueado: se observa el AudioContext para mostrar el banner.
 */
export type SoundKey = 'pixel' | 'rain' | 'reset' | 'figure' | 'end';

type BlockedListener = (blocked: boolean) => void;

export class AudioManager {
  private channels = new Map<string, HTMLAudioElement>();
  private muted = false;
  private tabSilenced = false; // ?sound=false en la URL
  private ctx: AudioContext | null = null;
  private blocked = false;
  private listeners = new Set<BlockedListener>();

  constructor() {
    this.ensureContext();
  }

  private ensureContext(): void {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      // El banner solo aparece cuando una reproduccion real es bloqueada (ver play()),
      // no por el estado inicial del AudioContext: si no hay sonidos, nunca molesta.
    } catch {
      /* sin audio disponible */
    }
  }

  private setBlocked(blocked: boolean): void {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    for (const l of this.listeners) l(blocked);
  }

  onBlockedChange(listener: BlockedListener): () => void {
    this.listeners.add(listener);
    listener(this.blocked);
    return () => this.listeners.delete(listener);
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  /** Intento de desbloqueo tras un gesto del usuario. */
  async unlock(): Promise<void> {
    this.ensureContext();
    try {
      await this.ctx?.resume();
    } catch {
      /* ignorar */
    }
    // El gesto del usuario desbloquea el audio del documento.
    this.setBlocked(false);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setTabSilenced(silenced: boolean): void {
    this.tabSilenced = silenced;
  }

  play(key: SoundKey, src: string | null, volume: number): void {
    if (this.muted || this.tabSilenced || !src) return;
    let el = this.channels.get(key);
    if (!el || el.src !== absolute(src)) {
      el = new Audio(src);
      this.channels.set(key, el);
    }
    el.volume = Math.max(0, Math.min(1, volume / 100));
    el.currentTime = 0;
    el.play().catch(() => this.setBlocked(true));
  }

  /** Detiene todos los sonidos en curso (p. ej. al finalizar la partida). */
  stopAll(): void {
    for (const el of this.channels.values()) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignorar */
      }
    }
  }

  dispose(): void {
    this.channels.clear();
    this.listeners.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}

function absolute(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}
