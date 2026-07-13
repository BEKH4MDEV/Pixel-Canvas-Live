import * as Popover from '@radix-ui/react-popover';
import { useEffect, useRef, useState } from 'react';
import { normalizeHex } from '@/lib/colors';
import { cn } from '@/lib/cn';

/** Conversión de color. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex) ?? '#000000';
  return { r: parseInt(n.slice(1, 3), 16), g: parseInt(n.slice(3, 5), 16), b: parseInt(n.slice(5, 7), 16) };
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const initial = rgbToHsv(...(Object.values(hexToRgb(value)) as [number, number, number]));
  const [hsv, setHsv] = useState(initial);
  const [hexText, setHexText] = useState(value);
  const svRef = useRef<HTMLDivElement>(null);

  // Sincroniza desde fuera cuando se abre.
  useEffect(() => {
    if (open) {
      const { r, g, b } = hexToRgb(value);
      setHsv(rgbToHsv(r, g, b));
      setHexText(value);
    }
  }, [open, value]);

  const commit = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const { r, g, b } = hsvToRgb(next.h, next.s, next.v);
    const hex = rgbToHex(r, g, b);
    setHexText(hex);
    onChange(hex);
  };

  const onSVPointer = (e: React.PointerEvent) => {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const move = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      commit({ ...hsv, s, v });
    };
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const hueColor = rgbToHex(...(Object.values(hsvToRgb(hsv.h, 1, 1)) as [number, number, number]));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-9 w-9 shrink-0 rounded-[var(--radius-sm)] border border-border-strong ring-1 ring-inset ring-black/20"
          style={{ backgroundColor: normalizeHex(value) ?? '#000000' }}
          aria-label="Elegir color"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-50 w-56 rounded-[var(--radius-md)] border border-border-strong bg-surface-overlay p-3 shadow-[var(--shadow-pop)] data-[state=open]:animate-[var(--animate-pop-in)]"
        >
          <div
            ref={svRef}
            onPointerDown={onSVPointer}
            className="relative h-36 w-full cursor-crosshair rounded-[var(--radius-sm)]"
            style={{ backgroundColor: hueColor }}
          >
            <div className="absolute inset-0 rounded-[var(--radius-sm)]" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
            <div className="absolute inset-0 rounded-[var(--radius-sm)]" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={360}
            value={hsv.h}
            onChange={(e) => commit({ ...hsv, h: Number(e.target.value) })}
            className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
          />

          <div className="mt-3 flex items-center gap-2">
            <span
              className="h-7 w-7 shrink-0 rounded-[var(--radius-sm)] ring-1 ring-inset ring-black/20"
              style={{ backgroundColor: normalizeHex(hexText) ?? '#000' }}
            />
            <input
              value={hexText}
              onChange={(e) => {
                const t = e.target.value.toUpperCase();
                setHexText(t);
                const norm = normalizeHex(t);
                if (norm) {
                  const { r, g, b } = hexToRgb(norm);
                  setHsv(rgbToHsv(r, g, b));
                  onChange(norm);
                }
              }}
              className={cn(
                'h-8 w-full rounded-[var(--radius-sm)] border bg-input px-2 font-mono text-sm uppercase text-fg focus:outline-none',
                normalizeHex(hexText) ? 'border-border-strong' : 'border-danger',
              )}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
