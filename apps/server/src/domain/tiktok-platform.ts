import {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent,
  WebcastWebConfigDefaults,
  WebSocketConfigDefaults
} from 'tiktok-live-connector';
import type { DisconnectReason } from '@pcl/contracts';
import { logger } from '../observability/logger';
import type { LivePlatform } from './platform';

const GENERIC_NAME = 'unknown-user';

/**
 * Adaptador real de la plataforma de live (Fase 3). Implementa el mismo puerto
 * `LivePlatform` que `MockLivePlatform`, de modo que el motor de juego no cambia: solo
 * traduce los eventos de `tiktok-live-connector` (chat, regalos, fin/caída de conexión) al
 * pipeline existente. No incluye los helpers de simulación del mock (el motor ya los trata
 * como opcionales).
 */

/**
 * Nombre del usuario: siempre el `uniqueId` (el @handle estable; en el proto v3 viaja como
 * `displayId`). Sólo si falta o está vacío se usa el `nickname` como respaldo.
 */
function resolveUsername(user: { uniqueId?: string; displayId?: string; nickname?: string } | undefined): string {
  const uniqueId = user?.uniqueId?.trim() || user?.displayId?.trim();
  if (uniqueId) return uniqueId;
  return user?.nickname?.trim() ?? GENERIC_NAME;
}

export class TikTokLivePlatform implements LivePlatform {
  private connection: TikTokLiveConnection | null = null;
  private connected = false;
  /** Marca un cierre solicitado por nosotros (disconnect) para no tratarlo como caída. */
  private intentional = false;
  /** Marca que el host terminó la transmisión, para no emitir además un 'error'. */
  private endedByStream = false;

  private commentHandler: ((username: string, message: string) => void) | null = null;
  private giftHandler: ((username: string, giftId: string, giftName: string) => void) | null = null;
  private disconnectHandler: ((reason: DisconnectReason) => void) | null = null;

  onComment(handler: (username: string, message: string) => void): void {
    this.commentHandler = handler;
  }
  onGift(handler: (username: string, giftId: string, giftName: string) => void): void {
    this.giftHandler = handler;
  }
  onDisconnect(handler: (reason: DisconnectReason) => void): void {
    this.disconnectHandler = handler;
  }
  isConnected(): boolean {
    return this.connected;
  }

  async connect(channel: string): Promise<void> {
    // Cada conexión parte de cero (también en las reconexiones que dispara el motor).
    await this.teardown();
    this.intentional = false;
    this.endedByStream = false;

    // `processInitialData: false`: no reproducimos el historial de chat al conectar, para no
    // pintar comandos antiguos como si fueran nuevos.
    const connection = new TikTokLiveConnection(channel, {
      processInitialData: false,
      // Asegura que todos los regalos vengan con el mismo id
      webConfigOverrides: {
        DEFAULT_HTTP_CLIENT_PARAMS: {
          ...WebcastWebConfigDefaults.DEFAULT_HTTP_CLIENT_PARAMS,
          app_language: 'en-US'
        }
      },
      wsConfigOverrides: {
        DEFAULT_WS_CLIENT_PARAMS: {
          ...WebSocketConfigDefaults.DEFAULT_WS_CLIENT_PARAMS,
          app_language: 'en-US'
        }
      }
    });
    this.connection = connection;

    const currentTime = Date.now();

    connection.on(WebcastEvent.CHAT, (data) => {
      const message = data.content?.trim();
      if (!message) return;
      const createTime = Number(data.common?.createTime);
      if (!Number.isNaN(createTime) && createTime < currentTime) return;
      const username = resolveUsername(data.user);
      this.commentHandler?.(username, message);
    });

    connection.on(WebcastEvent.GIFT, (data) => {
      // Regalos en racha (gift.type 1): sólo se procesan al terminar la racha (repeatEnd > 0),
      // para no disparar el efecto en cada incremento del contador.
      const gift = data.gift;
      const giftId = data.giftId?.trim();
      const createTime = Number(data.common?.createTime);

      if (
        !gift ||
        (gift.type === 1 && !data.repeatEnd) ||
        !giftId ||
        (!Number.isNaN(createTime) && createTime < currentTime)
      ) return;

      const giftName = gift.name?.trim();
      this.giftHandler?.(resolveUsername(data.user), giftId, giftName);
    });

    connection.on(WebcastEvent.STREAM_END, () => {
      this.endedByStream = true;
      this.connected = false;
      this.disconnectHandler?.('stream_end');
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      this.connected = false;
      // El fin de transmisión y los cierres pedidos por nosotros ya se gestionan aparte.
      if (this.intentional || this.endedByStream) return;
      this.disconnectHandler?.('error');
    });

    connection.on(ControlEvent.ERROR, (err) => {
      logger.error({ err }, 'tiktok-live-connector error');
    });

    await connection.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.intentional = true;
    await this.teardown();
  }

  private async teardown(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.connected = false;
    if (!connection) return;
    // Quitamos los listeners antes de cerrar para que la conexión saliente no dispare
    // eventos (p. ej. 'disconnected') sobre la nueva.
    connection.removeAllListeners();
    try {
      await connection.disconnect();
    } catch (err) {
      logger.warn({ err }, 'tiktok-live-connector disconnect failed');
    }
  }
}
