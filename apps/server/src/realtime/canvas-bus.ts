import type { CanvasEvent, CanvasEventPayload, CanvasEventType } from '@pcl/contracts';
import { EventBus } from './event-bus';

/**
 * Bus del lienzo público. Transporta todo lo que `/canvas` necesita en tiempo real:
 * pintado, estado de partida, overlays y conexión con el live. Alimenta el SSE
 * `/api/canvas/events`. Es independiente del bus del panel.
 */
class CanvasBus extends EventBus<CanvasEvent> {
  emit<T extends CanvasEventType>(type: T, payload: CanvasEventPayload<T>): void {
    this.publish({ type, payload } as CanvasEvent);
  }
}

export const canvasBus = new CanvasBus();
