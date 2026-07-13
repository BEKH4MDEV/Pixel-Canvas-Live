import type { Color } from '@pcl/contracts';

/** Resolucion y normalizacion de colores (documento 04, §2). */

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

/** Normaliza a `#RRGGBB` en mayusculas; expande la forma de 3 digitos. */
export function normalizeHex(input: string): string | null {
  const value = input.trim();
  if (HEX6.test(value)) return value.toUpperCase();
  if (HEX3.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null;
}

/**
 * Resuelve un token de color en el orden del documento 04, §2:
 * hex de 6 -> hex de 3 -> nombre del catalogo -> error (null).
 */
export function resolveColor(token: string, palette: Color[]): string | null {
  const hex = normalizeHex(token);
  if (hex) return hex;
  const named = palette.find((c) => c.name.toLowerCase() === token.toLowerCase());
  return named ? named.hex.toUpperCase() : null;
}

/** Elige un color al azar del catalogo (para «Aleatorio»). */
export function randomColor(palette: Color[]): string {
  if (palette.length === 0) return '#FFFFFF';
  const pick = palette[Math.floor(Math.random() * palette.length)]!;
  return pick.hex.toUpperCase();
}

/** Nombre legible de un hex si esta en el catalogo; si no, el propio hex. */
export function colorLabel(hex: string, palette: Color[]): string {
  const match = palette.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
  return match ? match.name : hex.toUpperCase();
}

/** Contraste legible (texto claro u oscuro) sobre un fondo hex. */
export function readableText(hex: string): '#000000' | '#FFFFFF' {
  const norm = normalizeHex(hex) ?? '#000000';
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  // Luminancia relativa simplificada
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}
