import type { AdminEvent, AdminEventPayload, AdminEventType } from '@pcl/contracts';
import { EventBus } from './event-bus';

/**
 * Bus del panel privado. Solo transporta las 3 cosas que `/admin` necesita en tiempo real:
 * `state` (snapshot de partida), `leaderboard` (top de la ronda actual) y `log` (consola).
 * Alimenta el SSE `/api/admin/events`. Nada de pintado viaja por aquí.
 */
class AdminBus extends EventBus<AdminEvent> {
  emit<T extends AdminEventType>(type: T, payload: AdminEventPayload<T>): void {
    this.publish({ type, payload } as AdminEvent);
  }
}

export const adminBus = new AdminBus();
