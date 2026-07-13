import { FIGURE_ANIMATION_DURATION_MS, type FigurePattern } from '@pcl/contracts';

/**
 * Matematica de figuras: escalado EPX/Scale2x y orden de animacion en espiral
 * desde el centro (documento 04, §5). Logica pura, compartida por el render y el
 * backend simulado.
 */

type Matrix = number[][];

function dims(m: Matrix): { rows: number; cols: number } {
  return { rows: m.length, cols: m[0]?.length ?? 0 };
}

/** Una pasada de EPX/Scale2x: duplica la resolucion conservando bordes nitidos. */
function scale2xOnce(src: Matrix): Matrix {
  const { rows, cols } = dims(src);
  const at = (r: number, c: number): number => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return -1; // fuera = "distinto"
    return src[r]![c]!;
  };
  const out: Matrix = Array.from({ length: rows * 2 }, () => new Array<number>(cols * 2).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = src[r]![c]!;
      const a = at(r - 1, c); // arriba
      const b = at(r, c + 1); // derecha
      const d = at(r, c - 1); // izquierda
      const f = at(r + 1, c); // abajo
      let e0 = p;
      let e1 = p;
      let e2 = p;
      let e3 = p;
      if (d === a && d !== f && a !== b) e0 = a;
      if (a === b && a !== d && b !== f) e1 = b;
      if (f === d && f !== b && d !== a) e2 = d;
      if (b === f && b !== a && f !== d) e3 = f;
      out[r * 2]![c * 2] = e0;
      out[r * 2]![c * 2 + 1] = e1;
      out[r * 2 + 1]![c * 2] = e2;
      out[r * 2 + 1]![c * 2 + 1] = e3;
    }
  }
  return out;
}

/** Escala una figura por un factor potencia de 2 aplicando EPX de forma compuesta. */
export function scaleFigure(pattern: FigurePattern, scale: number): Matrix {
  let result: Matrix = pattern.map((row) => [...row]);
  let factor = scale;
  while (factor > 1) {
    result = scale2xOnce(result);
    factor /= 2;
  }
  return result;
}

/**
 * Orden en espiral desde el centro hacia el exterior para una rejilla cols×rows.
 * Devuelve coordenadas [col, row] empezando por la celda central.
 */
export function spiralOrder(cols: number, rows: number): Array<[number, number]> {
  const order: Array<[number, number]> = [];
  const seen = new Set<string>();
  let cx = Math.floor((cols - 1) / 2);
  let cy = Math.floor((rows - 1) / 2);

  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    order.push([x, y]);
  };

  push(cx, cy);
  // Direcciones: derecha, abajo, izquierda, arriba; longitud de paso crece cada 2 giros.
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  let step = 1;
  let dir = 0;
  while (order.length < cols * rows) {
    for (let twice = 0; twice < 2; twice++) {
      const [dx, dy] = dirs[dir % 4]!;
      for (let s = 0; s < step; s++) {
        cx += dx;
        cy += dy;
        push(cx, cy);
      }
      dir++;
    }
    step++;
  }
  return order;
}

export interface FigureFramePixel {
  /** Desplazamiento dentro de la figura (col, row con row 0 = arriba). */
  col: number;
  row: number;
  frame: number;
}

export interface FigureFrames {
  pixels: FigureFramePixel[];
  frameCount: number;
  frameIntervalMs: number;
}

/**
 * A partir de una matriz escalada, produce los pixeles encendidos con su frame
 * de aparicion siguiendo el orden en espiral. La animacion dura 1000 ms.
 */
export function buildFigureFrames(scaled: Matrix, maxFrames = 30): FigureFrames {
  const { rows, cols } = dims(scaled);
  const order = spiralOrder(cols, rows);
  const lit = order.filter(([c, r]) => scaled[r]![c] === 1);
  const total = lit.length || 1;
  const frameCount = Math.max(1, Math.min(maxFrames, total));
  const perFrame = Math.ceil(total / frameCount);

  const pixels: FigureFramePixel[] = lit.map(([c, r], index) => ({
    col: c,
    row: r,
    frame: Math.min(frameCount - 1, Math.floor(index / perFrame)),
  }));

  return {
    pixels,
    frameCount,
    frameIntervalMs: FIGURE_ANIMATION_DURATION_MS / frameCount,
  };
}

/** Dimensiones base (sin escalar) de un patron. */
export function patternDims(pattern: FigurePattern): { cols: number; rows: number } {
  return { rows: pattern.length, cols: pattern[0]?.length ?? 0 };
}
