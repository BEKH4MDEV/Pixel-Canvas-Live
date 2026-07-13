import { SECTIONS, type SectionId } from './sections';
import { cn } from '@/lib/cn';

const GROUPS = ['Partida', 'Configuración', 'Contenido', 'Sistema'];

export function Sidebar({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-border">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => (
          <div key={group}>
            <div className="px-3 pb-1.5 font-mono text-2xs uppercase tracking-[0.18em] text-fg-faint">{group}</div>
            <div className="flex flex-col gap-0.5">
              {SECTIONS.filter((sec) => sec.group === group).map((sec) => {
                const Icon = sec.icon;
                const isActive = sec.id === active;
                return (
                  <button
                    key={sec.id}
                    onClick={() => onSelect(sec.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-left text-base transition-colors',
                      isActive ? 'bg-brand-soft text-brand-strong' : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-strong' : 'text-fg-subtle')} />
                    <span className="truncate">{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
