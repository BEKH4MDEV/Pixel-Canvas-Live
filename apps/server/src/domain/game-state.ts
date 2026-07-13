import type { ConnectionState, GameStatus, Leaderboard, Pixel, ReconnectInfo } from '@pcl/contracts';

/**
 * Estado efimero de la sesion. Vive solo en memoria; al reiniciar el servidor siempre se
 * empieza de cero. Es la unica via para leer o mutar el lienzo y el estado de juego; no toca
 * la base de datos.
 */
class GameStateService {
  private status: GameStatus = 'INACTIVE';
  private endedAt: string | null = null;
  private countdownEndsAt: string | null = null;
  private endTriggeredBy: string | null = null;
  private pixels = new Map<string, string>();
  private cooldowns = new Map<string, number>();
  private connectionState: ConnectionState = 'disconnected';
  private reconnect: ReconnectInfo | null = null;
  private lastLeaderboard: Leaderboard = [];

  getStatus(): GameStatus {
    return this.status;
  }
  setStatus(status: GameStatus): void {
    this.status = status;
  }

  getEndedAt(): string | null {
    return this.endedAt;
  }
  setEndedAt(value: string | null): void {
    this.endedAt = value;
  }

  getCountdownEndsAt(): string | null {
    return this.countdownEndsAt;
  }
  setCountdownEndsAt(value: string | null): void {
    this.countdownEndsAt = value;
  }

  getEndTriggeredBy(): string | null {
    return this.endTriggeredBy;
  }
  setEndTriggeredBy(value: string | null): void {
    this.endTriggeredBy = value;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }

  getReconnect(): ReconnectInfo | null {
    return this.reconnect;
  }
  setReconnect(info: ReconnectInfo | null): void {
    this.reconnect = info;
  }

  getLastLeaderboard(): Leaderboard {
    return this.lastLeaderboard;
  }
  setLastLeaderboard(board: Leaderboard): void {
    this.lastLeaderboard = board;
  }

  setPixel(x: number, y: number, color: string): void {
    this.pixels.set(`${x},${y}`, color);
  }
  clearPixels(): void {
    this.pixels.clear();
  }
  getPixels(): Pixel[] {
    return [...this.pixels].map(([key, color]) => {
      const [x, y] = key.split(',');
      return { x: Number(x), y: Number(y), color };
    });
  }

  inCooldown(key: string, now: number): boolean {
    const until = this.cooldowns.get(key);
    return until !== undefined && until > now;
  }
  setCooldown(key: string, until: number): void {
    this.cooldowns.set(key, until);
  }
  clearCooldowns(): void {
    this.cooldowns.clear();
  }
}

export const gameState = new GameStateService();
