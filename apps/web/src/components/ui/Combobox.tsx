import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import { cn } from '@/lib/cn';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/** Select con busqueda (p. ej. elegir regalo sin efectos). */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona…',
  emptyMessage = 'Sin resultados',
  disabled,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    // 1. Agregamos modal={true} para que herede correctamente el contexto de capas de Radix
    <Popover.Root open={open} onOpenChange={setOpen} modal={true}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-input px-3',
          'text-base text-fg enabled:hover:border-white/20 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand/30',
          'disabled:opacity-50',
        )}
      >
        <span className={cn('truncate', !selected && 'text-fg-faint')}>
          {selected ? selected.label : placeholder}
        </span>
        <FiChevronDown className="shrink-0 text-fg-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[var(--radius-sm)]',
            'border border-border-strong bg-surface-overlay shadow-[var(--shadow-pop)]',
            'data-[state=open]:animate-[var(--animate-pop-in)]',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <FiSearch className="text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-9 w-full bg-transparent text-base text-fg placeholder:text-fg-faint focus:outline-none"
            />
          </div>
          {/* El scroll táctil ahora responderá nativamente sin ser bloqueado por el Dialog */}
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm text-fg-subtle">{emptyMessage}</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-[5px] px-2 py-1.5 text-left text-base text-fg',
                    'hover:bg-white/[0.06]',
                    opt.value === value && 'bg-brand-soft text-brand-strong',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.hint && <span className="shrink-0 font-mono text-2xs text-fg-subtle">{opt.hint}</span>}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
