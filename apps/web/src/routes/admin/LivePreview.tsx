import { useEffect, useRef, useState } from 'react';
import { FiMonitor } from 'react-icons/fi';
import { useConfig } from '@/data/queries';

const MAX_HEIGHT = 380;

const PREVIEW_SRC =
  '/canvas?overlay=false&sound=false';

export function LivePreview() {
  const { data: config } = useConfig();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = config?.canvasWidth ?? 160;
  const h = config?.canvasHeight ?? 90;
  const ps = config?.pixelSize ?? 10;
  const baseW = w * ps;
  const baseH = h * ps;
  const scale = box.w && box.h ? Math.min(box.w / baseW, box.h / baseH) : 0.2;

  return (
    <div className="shrink-0">
      <div className="mb-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-fg-subtle">
        <FiMonitor className="h-3.5 w-3.5" /> Vista previa en vivo
      </div>
      <div
        ref={ref}
        className="relative mx-auto w-full overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-black ring-1 ring-black/40"
        style={{ aspectRatio: `${w} / ${h}`, maxWidth: (MAX_HEIGHT * w) / h, transform: 'translateZ(0)' }}
      >
        <iframe
          src={PREVIEW_SRC}
          title="Vista previa en vivo"
          className="pointer-events-none absolute left-1/2 top-1/2 border-0"
          style={{
            width: baseW,
            height: baseH,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
    </div>
  );
}