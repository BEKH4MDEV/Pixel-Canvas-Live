import type { Color } from '@pcl/contracts';

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

export function normalizeHex(input: string): string | null {
  const value = input.trim();
  if (HEX6.test(value)) return value.toUpperCase();
  if (HEX3.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

export function resolveColor(token: string, palette: Color[]): string | null {
  const hex = normalizeHex(token);
  if (hex) return hex;
  const named = palette.find((c) => c.name.toLowerCase() === token.toLowerCase());
  return named ? named.hex.toUpperCase() : null;
}

export function randomColor(palette: Color[]): string {
  if (palette.length === 0) return '#FFFFFF';
  return palette[Math.floor(Math.random() * palette.length)]!.hex.toUpperCase();
}
