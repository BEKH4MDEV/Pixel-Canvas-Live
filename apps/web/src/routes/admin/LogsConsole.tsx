import { useEffect, useRef, useState } from 'react';
import { FiArrowDown, FiDownload, FiTerminal, FiTrash2 } from 'react-icons/fi';
import type { LogType } from '@pcl/contracts';
import { useLogsStore } from '@/stores/logs-store';
import { clock } from '@/lib/format';
import { cn } from '@/lib/cn';

const TYPE_COLOR: Record<LogType, string> = {
  INFO: 'text-info',
  OK: 'text-success',
  ERROR: 'text-danger',
  GIFT: 'text-brand-strong',
  MANUAL: 'text-warning',
  SYSTEM: 'text-fg-subtle',
};

export function LogsConsole() {
  const lines = useLogsStore((s) => s.lines);
  const clear = useLogsStore((s) => s.clear);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
      setNewCount(0);
    } else {
      setNewCount((n) => n + 1);
    }
  }, [lines]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom.current) setNewCount(0);
  };

  const toBottom = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    setNewCount(0);
  };

  const exportTxt = () => {
    const text = lines.map((l) => `[${clock(new Date(l.at))}] ${l.type} ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `logs_${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-[220px] flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-fg-subtle">
          <FiTerminal className="h-3.5 w-3.5" /> Consola
        </span>
        <div className="flex gap-1">
          <button onClick={exportTxt} className="grid h-7 w-7 place-items-center rounded text-fg-subtle hover:bg-white/5 hover:text-fg" aria-label="Exportar logs">
            <FiDownload className="h-3.5 w-3.5" />
          </button>
          <button onClick={clear} className="grid h-7 w-7 place-items-center rounded text-fg-subtle hover:bg-white/5 hover:text-danger" aria-label="Limpiar consola">
            <FiTrash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-md)] border border-border bg-[#070809]">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto p-3 font-mono text-xs leading-relaxed">
          {lines.length === 0 ? (
            <p className="text-fg-faint">Sin actividad todavía…</p>
          ) : (
            lines.map((l) => (
              <div key={l.id} className="flex gap-2 whitespace-pre-wrap break-words">
                <span className="shrink-0 text-fg-faint">[{clock(new Date(l.at))}]</span>
                <span className={cn('shrink-0 font-semibold', TYPE_COLOR[l.type])}>{l.type}</span>
                <span className="text-fg-muted">{l.message}</span>
              </div>
            ))
          )}
        </div>

        {newCount > 0 && (
          <button
            onClick={toBottom}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-surface-overlay px-3 py-1 text-2xs text-fg shadow-[var(--shadow-pop)]"
          >
            <FiArrowDown className="h-3 w-3" /> {newCount} {newCount === 1 ? 'línea nueva' : 'líneas nuevas'}
          </button>
        )}
      </div>
    </div>
  );
}
