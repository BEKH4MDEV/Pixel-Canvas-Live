import type { Request, Response } from 'express';
import type { AdminEvent, CanvasEvent } from '@pcl/contracts';
import { adminBus } from './admin-bus';
import { canvasBus } from './canvas-bus';
import type { EventBus } from './event-bus';

/**
 * Dos flujos SSE independientes, uno por bus. Cada flujo mantiene su propio conjunto de
 * clientes y su propio keep-alive; una caída en el del lienzo no afecta al del panel.
 */

type WireEvent = { type: string; payload: unknown };

function wire(event: WireEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
}

function createStream<E extends WireEvent>(bus: EventBus<E>) {
  const clients = new Set<Response>();
  const remove = (res: Response): void => {
    clients.delete(res);
  };
  const write = (res: Response, data: string): void => {
    if (res.destroyed || res.writableEnded) {
      remove(res);
      return;
    }
    try {
      res.write(data);
    } catch {
      remove(res);
    }
  };

  bus.subscribe((event) => {
    const data = wire(event);
    for (const res of clients) write(res, data);
  });

  const keepAlive = setInterval(() => {
    for (const res of clients) write(res, ': keep-alive\n\n');
  }, 15_000);
  keepAlive.unref?.();

  return {
    handle(req: Request, res: Response): void {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      clients.add(res);
      req.on('close', () => remove(res));
      res.on('close', () => remove(res));
      res.on('error', () => remove(res));
    },
    count: (): number => clients.size,
  };
}

const canvasStream = createStream<CanvasEvent>(canvasBus);
const adminStream = createStream<AdminEvent>(adminBus);

/** SSE público del lienzo. */
export function handleCanvasSse(req: Request, res: Response): void {
  canvasStream.handle(req, res);
}

/** SSE del panel (se monta tras `requireAuth`). */
export function handleAdminSse(req: Request, res: Response): void {
  adminStream.handle(req, res);
}

export function canvasClientCount(): number {
  return canvasStream.count();
}
export function adminClientCount(): number {
  return adminStream.count();
}
