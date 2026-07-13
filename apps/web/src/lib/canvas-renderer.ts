import type { Pixel, RainEvent, ShapeEvent } from '@pcl/contracts';
import { ERASE_DURATION_MS } from '@pcl/contracts';

/**
 * Render imperativo del lienzo, desacoplado de React (documento 01, §3 / 05, §4).
 * Sistema de coordenadas **1-based**: la primera fila y columna son la coordenada 1;
 * (0,0) no existe. Origen abajo-izquierda; Y crece hacia arriba. Lienzo blanco; el
 * blanco no se dibuja. Las coordenadas viven en un margen propio (gutter).
 */

export interface RendererConfig {
  pixelSize: number;
  showGrid: boolean;
  showCoords: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

const DEFAULT_CONFIG: RendererConfig = { pixelSize: 10, showGrid: false, showCoords: true, canvasWidth: 160, canvasHeight: 90 };

interface RainParticle {
  x: number;
  destY: number;
  color: string;
  startAt: number;
  fallMs: number;
}
interface ShapeReveal {
  x: number;
  y: number;
  color: string;
  appearAt: number;
  committed: boolean;
}
interface Pop {
  x: number;
  y: number;
  color: string;
  startAt: number;
  /** Aterrizaje de lluvia: el pixel ya esta a tamano completo, no crece desde 0. */
  land?: boolean;
}
interface Erase {
  startAt: number;
  durationMs: number;
}

const POP_DURATION_MS = 360;
const RAIN_FALL_MS = 650;
const FONT_SIZE = 10;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Rebote: arranca en 0, sobrepasa ~1.12 y se asienta en 1. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Rebote de aterrizaje: el pixel ya esta a tamano completo (cayo), asi que no colapsa a 0;
 * solo da un breve impulso (~1.11) y se asienta. Comparte el destello con el pop normal,
 * de modo que un pixel de lluvia al aterrizar se ve como un pixel pintado individualmente.
 */
function impactScale(t: number): number {
  return 1 + 0.2 * Math.sin(Math.PI * t) * (1 - t);
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RendererConfig = { ...DEFAULT_CONFIG };

  private cols = 0;
  private rows = 0;
  private dpr = 1;
  private gutterLeft = 0;
  private gutterBottom = 0;

  private pixels = new Map<string, string>();
  private rain: RainParticle[] = [];
  private reveals: ShapeReveal[] = [];
  private pops: Pop[] = [];
  private erase: Erase | null = null;

  private rafId = 0;
  private dirty = true;
  private running = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D');
    this.ctx = ctx;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (): void => {
      if (!this.running) return;
      this.tick();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  configure(partial: Partial<RendererConfig>): void {
    this.config = { ...this.config, ...partial };
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const availW = parent?.clientWidth ?? window.innerWidth;
    const availH = parent?.clientHeight ?? window.innerHeight;
    const ps = this.config.pixelSize;

    this.gutterBottom = this.config.showCoords ? 16 : 0;
    this.rows = Math.max(1, Math.floor((availH - this.gutterBottom) / ps));
    const yDigits = String(this.rows).length;
    this.gutterLeft = this.config.showCoords ? 6 + yDigits * 7 : 0;
    this.cols = Math.max(1, Math.floor((availW - this.gutterLeft) / ps));

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.gutterLeft + this.cols * ps;
    const cssH = this.rows * ps + this.gutterBottom;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.markDirty();
  }

  getGrid(): { cols: number; rows: number; pixelSize: number } {
    return { cols: this.cols, rows: this.rows, pixelSize: this.config.pixelSize };
  }

  setPixels(pixels: Pixel[]): void {
    this.pixels.clear();
    for (const p of pixels) this.pixels.set(`${p.x},${p.y}`, p.color);
    this.rain = [];
    this.reveals = [];
    this.pops = [];
    this.erase = null;
    this.markDirty();
  }

  clearInstant(): void {
    this.pixels.clear();
    this.rain = [];
    this.reveals = [];
    this.pops = [];
    this.erase = null;
    this.markDirty();
  }

  /**
   * Descarta las animaciones entrantes (lluvia cayendo, figuras revelandose, pops) sin
   * tocar los pixeles ya pintados. Al finalizar la partida evita que un evento que entro
   * justo antes del cierre siga pintando detras de la pantalla de resultados.
   */
  cancelIncoming(): void {
    this.rain = [];
    this.reveals = [];
    this.pops = [];
    this.markDirty();
  }

  /**
   * Fija un pixel y lanza su animacion de aparicion (el "pop"). Es la unica via para que
   * un pixel aparezca, de modo que el pixel individual, la figura y la lluvia al aterrizar
   * reproduzcan exactamente la misma animacion.
   */
  private commitPixel(x: number, y: number, color: string, now: number, land = false): void {
    this.pixels.set(`${x},${y}`, color);
    this.pops.push({ x, y, color, startAt: now, land });
  }

  paintPixel(x: number, y: number, color: string): void {
    this.commitPixel(x, y, color, performance.now());
    this.markDirty();
  }

  playShape(event: ShapeEvent): void {
    const now = performance.now();
    for (const p of event.pixels) {
      this.reveals.push({ x: p.x, y: p.y, color: event.color, appearAt: now + p.frame * event.frameIntervalMs, committed: false });
    }
    this.markDirty();
  }

  playRain(event: RainEvent): void {
    const now = performance.now();
    for (const p of event.pixels) {
      this.rain.push({ x: p.x, destY: p.destinationY, color: p.color, startAt: now + p.delayMs, fallMs: RAIN_FALL_MS });
    }
    this.markDirty();
  }

  playErase(): void {
    this.erase = { startAt: performance.now(), durationMs: ERASE_DURATION_MS };
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private hasActiveAnimations(): boolean {
    return this.rain.length > 0 || this.reveals.length > 0 || this.pops.length > 0 || this.erase !== null;
  }

  private tick(): void {
    const now = performance.now();
    let changed = false;

    for (const r of this.reveals) {
      if (!r.committed && now >= r.appearAt) {
        r.committed = true;
        this.commitPixel(r.x, r.y, r.color, now);
        changed = true;
      }
    }
    this.reveals = this.reveals.filter((r) => !r.committed || now < r.appearAt + POP_DURATION_MS);

    for (const p of this.rain) {
      const landAt = p.startAt + p.fallMs;
      if (now >= landAt && p.startAt >= 0) {
        // Al aterrizar reproduce el destello del pixel individual, con un rebote de
        // impacto (no colapsa a 0, porque la caida ya lo dejo a tamano completo).
        this.commitPixel(p.x, p.destY, p.color, now, true);
        p.startAt = -1;
        changed = true;
      }
    }
    this.rain = this.rain.filter((p) => p.startAt >= 0);

    this.pops = this.pops.filter((p) => now < p.startAt + POP_DURATION_MS);

    if (this.erase && now >= this.erase.startAt + this.erase.durationMs) {
      this.pixels.clear();
      this.erase = null;
      changed = true;
    }

    if (changed) this.markDirty();
    if (!this.dirty && !this.hasActiveAnimations()) return;

    this.draw(now);
    this.dirty = this.hasActiveAnimations();
  }

  // Coordenadas 1-based: la celda de la coordenada c empieza en (c-1)*ps.
  private screenX(x: number): number {
    return this.gutterLeft + (x - 1) * this.config.pixelSize;
  }
  private screenY(y: number): number {
    return (this.rows - y) * this.config.pixelSize;
  }

  private draw(now: number): void {
    const { ctx } = this;
    const ps = this.config.pixelSize;
    const playW = this.cols * ps;
    const playH = this.rows * ps;
    const fullW = this.gutterLeft + playW;
    const fullH = playH + this.gutterBottom;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, fullW, fullH);

    const erasingP = this.erase ? Math.min(1, (now - this.erase.startAt) / this.erase.durationMs) : 0;
    const wipeRow = erasingP * this.rows;

    // Las celdas con un pop activo las dibuja el pop (animadas), no el render base.
    const popping = new Set(this.pops.map((p) => `${p.x},${p.y}`));

    for (const [key, color] of this.pixels) {
      if (color === '#FFFFFF' || popping.has(key)) continue;
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (x < 1 || x > this.cols || y < 1 || y > this.rows) continue;
      const screenRowIndex = this.rows - y;
      if (this.erase && screenRowIndex < wipeRow) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(this.screenX(x)), Math.round(this.screenY(y)), ps, ps);
    }

    // Pops: rebote desde el centro + destello blanco que se desvanece.
    for (const p of this.pops) {
      if (p.x < 1 || p.x > this.cols || p.y < 1 || p.y > this.rows) continue;
      const t = Math.min(1, (now - p.startAt) / POP_DURATION_MS);
      const scale = p.land ? impactScale(t) : Math.max(0, easeOutBack(t));
      const size = ps * scale;
      const off = (ps - size) / 2;
      const sx = Math.round(this.screenX(p.x) + off);
      const sy = Math.round(this.screenY(p.y) + off);
      const drawSize = Math.ceil(size);
  
      ctx.fillStyle = p.color === '#FFFFFF' ? '#EDEDED' : p.color;
      ctx.fillRect(sx, sy, drawSize, drawSize);
      const flash = Math.max(0, 0.85 * (1 - t * 1.8));
      if (flash > 0) {
        ctx.globalAlpha = flash;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx, sy, drawSize, drawSize);
        ctx.globalAlpha = 1;
      }
    }

    for (const p of this.rain) {
      if (now < p.startAt || p.startAt < 0) continue;
      const t = Math.min(1, (now - p.startAt) / p.fallMs);
      const eased = easeOutCubic(t);
      const destSy = this.screenY(p.destY);
      const sy = -ps + (destSy + ps) * eased;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(this.screenX(p.x)), Math.round(sy), ps, ps);
    }

    if (this.config.showGrid) this.drawGrid(playW, playH);
    if (this.config.showCoords) this.drawCoords(playH);

    if (this.erase && erasingP < 1) {
      ctx.fillStyle = 'rgba(124,108,255,0.9)';
      ctx.fillRect(this.gutterLeft, Math.round(wipeRow * ps) - 1, playW, 2);
    }
  }

  private drawGrid(playW: number, playH: number): void {
    const { ctx } = this;
    const ps = this.config.pixelSize;
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= this.cols; c++) {
      const x = Math.round(this.gutterLeft + c * ps) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, playH);
    }
    for (let r = 0; r <= this.rows; r++) {
      const y = Math.round(r * ps) + 0.5;
      ctx.moveTo(this.gutterLeft, y);
      ctx.lineTo(this.gutterLeft + playW, y);
    }
    ctx.stroke();
  }

  private drawCoords(playH: number): void {
    const { ctx } = this;
    const ps = this.config.pixelSize;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = `${FONT_SIZE}px "JetBrains Mono Variable", monospace`;

    // Mismo intervalo en ambos ejes (el mayor de los dos, para que ninguno se solape) y el
    // patrón arranca SIEMPRE desde la coordenada 1: 1, 1+step, 1+2·step… (p. ej. 1,3,5,7).
    const step = Math.max(
      niceStep(Math.ceil((String(this.cols).length * FONT_SIZE * 0.62 + 3) / ps)),
      niceStep(Math.ceil((FONT_SIZE + 3) / ps)),
    );

    // Eje X (gutter inferior). Coordenadas desde 1.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let x = 1; x <= this.cols; x++) {
      if ((x - 1) % step !== 0) continue;
      ctx.fillText(String(x), this.screenX(x) + ps / 2, playH + this.gutterBottom / 2);
    }

    // Eje Y (gutter izquierdo). Coordenadas desde 1.
    ctx.textAlign = 'right';
    for (let y = 1; y <= this.rows; y++) {
      if ((y - 1) % step !== 0) continue;
      ctx.fillText(String(y), this.gutterLeft - 3, this.screenY(y) + ps / 2);
    }
  }
}

function niceStep(step: number): number {
  if (step <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(step)));
  const base = step / pow;
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return nice * pow;
}
