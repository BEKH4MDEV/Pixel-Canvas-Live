import type { DisconnectReason } from '@pcl/contracts';

/**
 * Puerto de la plataforma de live. El dominio depende de esta interfaz, nunca de TikTok.
 * `TikTokLivePlatform` es el adaptador real; `MockLivePlatform` es la audiencia simulada;
 * `CombinedLivePlatform` permite que ambos convivan (toggle «Audiencia simulada»).
 */
export interface LivePlatform {
  connect(channel: string): Promise<void>;
  disconnect(): Promise<void>;
  onComment(handler: (username: string, message: string) => void): void;
  onGift(handler: (username: string, giftId: string, giftName: string) => void): void;
  onDisconnect(handler: (reason: DisconnectReason) => void): void;
  isConnected(): boolean;
}

/** Perfil de la audiencia simulada; lo actualiza el motor en cada cambio de estado/config. */
export interface AmbientProfile {
  enabled: boolean;
  commandPrefix: string;
  command: string;
  colorNames: string[];
  width: number;
  height: number;
}

/** Extras de simulación que el motor invoca (sobre el mock o el combinado). */
export interface SimulationControl {
  setAmbientProfile(profile: Partial<AmbientProfile>): void;
  simulateDrop(reason: DisconnectReason): void;
}

const VIEWERS = [
  'pixelmancer', 'nova_kit', 'kira', 'dot_dot', 'mr_grid', 'lumen', 'byte_bee',
  'cyan_oh', 'vexel', 'pico', 'glitchy', 'rasterboy', 'neon_n', 'sora', 'tiko',
];

/** Regalos que puede enviar la audiencia simulada (deben existir en la BD con efectos). */
const SIM_GIFTS: ReadonlyArray<{ giftId: string; name: string }> = [
  { giftId: '5655', name: 'Rose' },
  { giftId: '13311', name: 'Love Qatar' },
  { giftId: '5879', name: 'Doughnut' },
  { giftId: '5874', name: 'Lion 222' },
  { giftId: '5954', name: 'Planet' },
  { giftId: '97035', name: 'Garixito' },
  { giftId: '11046', name: 'Galaxy' },
];

const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: ReadonlyArray<T>): T => arr[randInt(0, arr.length - 1)]!;

/**
 * Audiencia simulada. No se conecta a ninguna plataforma real, pero emite comentarios y
 * regalos por el MISMO pipeline que el adaptador real, de modo que para el motor un evento
 * simulado es indistinguible de uno real. El bucle de emisión se gobierna por `enabled`
 * (desacoplado de `connect`), para que el combinado pueda encenderlo/apagarlo en caliente.
 */
export class MockLivePlatform implements LivePlatform, SimulationControl {
  private connected = false;
  private commentHandler: ((u: string, m: string) => void) | null = null;
  private giftHandler: ((u: string, id: string, name: string) => void) | null = null;
  private disconnectHandler: ((r: DisconnectReason) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private profile: AmbientProfile = {
    enabled: false,
    commandPrefix: '!',
    command: 'p',
    colorNames: [],
    width: 160,
    height: 90,
  };

  setAmbientProfile(partial: Partial<AmbientProfile>): void {
    this.profile = { ...this.profile, ...partial };
    if (this.profile.enabled) this.startAmbient();
    else this.stopAmbient();
  }

  simulateDrop(reason: DisconnectReason): void {
    this.stopAmbient();
    this.connected = false;
    this.disconnectHandler?.(reason);
  }

  /** Conexión instantánea: no hay un live real que establecer. */
  connect(_channel: string): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.stopAmbient();
    this.connected = false;
    return Promise.resolve();
  }

  onComment(handler: (u: string, m: string) => void): void {
    this.commentHandler = handler;
  }
  onGift(handler: (u: string, id: string, name: string) => void): void {
    this.giftHandler = handler;
  }
  onDisconnect(handler: (r: DisconnectReason) => void): void {
    this.disconnectHandler = handler;
  }
  isConnected(): boolean {
    return this.connected;
  }

  private startAmbient(): void {
    if (this.timer) return; // ya corriendo
    const loop = (): void => {
      this.timer = null;
      if (!this.profile.enabled) return;
      this.tick();
      this.timer = setTimeout(loop, this.nextDelayMs());
    };
    this.timer = setTimeout(loop, this.nextDelayMs());
  }

  private stopAmbient(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Delay aleatorio amplio (~100 ms .. ~10 s), sesgado hacia lo corto: algunos eventos casi
   * inmediatos y otros con pausas largas, como el ritmo irregular de un live real.
   */
  private nextDelayMs(): number {
    const min = 500;
    const max = 20_000;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private tick(): void {
    const viewer = pick(VIEWERS);
    // 10% → regalo (solo de la lista fija).
    if (Math.random() < 0.05) {
      const gift = pick(SIM_GIFTS);
      this.giftHandler?.(viewer, gift.giftId, gift.name);
      return;
    }
    // 80% → píxel individual aleatorio en cualquier parte del área de juego.
    if (this.profile.colorNames.length === 0) return;
    const x = randInt(1, this.profile.width);
    const y = randInt(1, this.profile.height);
    const color = pick(this.profile.colorNames);
    this.commentHandler?.(viewer, `${this.profile.commandPrefix}${this.profile.command} ${x} ${y} ${color}`);
  }
}

/**
 * Plataforma combinada. Envuelve el adaptador real y el simulador y los presenta al motor
 * como una sola `LivePlatform`, de modo que todo pasa por la misma lógica ya existente.
 *
 * La **conexión es SIEMPRE la del live real**: el toggle de simulación NO altera nada del
 * comportamiento original (conexión, reconexión, pausa, cuenta atrás, fin, etc.). El simulador
 * es únicamente un **inyector de eventos** que entra por los mismos handlers que el live real;
 * el motor lo enciende/apaga con el perfil de ambiente (`setAmbientProfile`), y solo lo habilita
 * cuando la partida está en directo, conectada y el lienzo visible esperando eventos —
 * exactamente las condiciones en las que se procesarían los eventos reales.
 */
export class CombinedLivePlatform implements LivePlatform, SimulationControl {
  private commentHandler: ((u: string, m: string) => void) | null = null;
  private giftHandler: ((u: string, id: string, name: string) => void) | null = null;
  private disconnectHandler: ((r: DisconnectReason) => void) | null = null;

  constructor(
    private readonly real: LivePlatform,
    private readonly sim: MockLivePlatform,
  ) {
    // Tanto el live real como el simulador entran por los mismos handlers del motor.
    this.real.onComment((u, m) => this.commentHandler?.(u, m));
    this.real.onGift((u, id, name) => this.giftHandler?.(u, id, name));
    this.real.onDisconnect((r) => this.disconnectHandler?.(r));
    this.sim.onComment((u, m) => this.commentHandler?.(u, m));
    this.sim.onGift((u, id, name) => this.giftHandler?.(u, id, name));
    this.sim.onDisconnect((r) => this.disconnectHandler?.(r));
  }

  // La conexión, la reconexión y el estado son SIEMPRE los del live real; el simulador no toca nada.
  connect(channel: string): Promise<void> {
    return this.real.connect(channel);
  }
  async disconnect(): Promise<void> {
    await Promise.allSettled([this.real.disconnect(), this.sim.disconnect()]);
  }
  isConnected(): boolean {
    return this.real.isConnected();
  }

  onComment(handler: (u: string, m: string) => void): void {
    this.commentHandler = handler;
  }
  onGift(handler: (u: string, id: string, name: string) => void): void {
    this.giftHandler = handler;
  }
  onDisconnect(handler: (r: DisconnectReason) => void): void {
    this.disconnectHandler = handler;
  }

  // ── Control del simulador (lo usa el motor vía refreshAmbient) ──
  setAmbientProfile(profile: Partial<AmbientProfile>): void {
    this.sim.setAmbientProfile(profile);
  }
  simulateDrop(reason: DisconnectReason): void {
    this.sim.simulateDrop(reason);
  }
}
