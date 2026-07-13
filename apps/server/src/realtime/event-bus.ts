import { logger } from '../observability/logger';

type Listener<E> = (event: E) => void;

/**
 * Bus de eventos genérico en memoria. Un fallo en un suscriptor nunca tumba al resto ni al
 * emisor. Se usa una instancia por cara del producto: `canvasBus` y `adminBus`, cada una con
 * su propio catálogo de eventos y su propio SSE.
 */
export class EventBus<E> {
  private listeners = new Set<Listener<E>>();

  subscribe(listener: Listener<E>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected publish(event: E): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (err) {
        logger.error({ err }, 'event subscriber failed');
      }
    }
  }
}
