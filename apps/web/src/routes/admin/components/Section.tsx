import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FiRefreshCw } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Card } from '@/components/ui/Card';
import { PixelSpinner } from '@/components/PixelSpinner';
import { Tooltip } from '@/components/ui/Tooltip';
import { useRequestRemount } from '../section-remount';
import { cn } from '@/lib/cn';

/**
 * Cabecera + cuerpo de una seccion del panel. Mientras `loading` (carga inicial) o un
 * refresco manual estan activos solo se muestran el titulo, la descripcion y un spinner
 * centrado; el contenido aparece de golpe cuando la seccion tiene todos sus datos.
 * `refreshKeys` habilita el boton de refrescar (recarga solo las queries de la seccion).
 */
export function Section({
  icon: Icon,
  title,
  description,
  actions,
  loading = false,
  refreshKeys,
  children,
}: {
  icon: IconType;
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  refreshKeys?: ReadonlyArray<readonly unknown[]>;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const requestRemount = useRequestRemount();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = (): void => {
    if (!refreshKeys || refreshing) return;
    setRefreshing(true);
    void Promise.all(refreshKeys.map((key) => qc.refetchQueries({ queryKey: key }))).finally(() => {
      setRefreshing(false);
      requestRemount();
    });
  };
  const showSpinner = loading || refreshing;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 lg:px-8 lg:pt-8 h-full flex flex-col">
      <header className="mb-6 flex items-start justify-between gap-4 w-full">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-brand-soft text-brand-strong">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-fg">{title}</h1>
            {description && <p className="mt-0.5 max-w-prose text-sm text-fg-subtle">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-center">
          {!showSpinner && actions}
          {refreshKeys && (
            <Tooltip content="Refrescar sección" enabled={!showSpinner}>
              <button
                onClick={refresh}
                disabled={showSpinner}
                aria-label="Refrescar sección"
                className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-fg-subtle enabled:hover:bg-white/5 enabled:hover:text-fg disabled:opacity-40 disabled:hover:pointer-none"
              >
                <FiRefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </button>
            </Tooltip>
          )}
        </div>
      </header>
      {showSpinner ? (
        <div className='mx-auto my-auto'>
          <div className="grid">
            <PixelSpinner size="lg" />
          </div>
        </div>
      ) : (
        <div className="space-y-5 pb-6">{children}</div>
      )}
    </div>
  );
}

/** Tarjeta agrupadora dentro de una seccion. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {(title || actions) && (
        <div className={`flex items-center justify-between gap-3 ${children && "border-b border-border"} px-4 py-3`}>
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-fg">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {
        children && (
          <div className={cn('p-4', bodyClassName)}>
            {children}
          </div>
        )
      }
    </Card>
  );
}

/** Fila etiqueta/control para listas y ajustes inline. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2', className)}>{children}</div>
  );
}
