import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheck, FiCloudRain, FiLayers, FiRefreshCw } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import type { NotificationKind, OverlayNotification } from './types';
import { cn } from '@/lib/cn';

const ICONS: Record<NotificationKind, IconType> = {
  success: FiCheck,
  error: FiAlertCircle,
  shape: FiLayers,
  rain: FiCloudRain,
  reset: FiRefreshCw,
};

const TONE: Record<NotificationKind, string> = {
  success: 'text-success',
  error: 'text-danger',
  shape: 'text-brand-strong',
  rain: 'text-info',
  reset: 'text-warning',
};

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-[3px] ring-1 ring-white/30"
      style={{ backgroundColor: color }}
    />
  );
}

function NotificationBody({
  n,
  resolveColorName,
}: {
  n: OverlayNotification;
  resolveColorName: (hex: string) => string;
}) {
  switch (n.kind) {
    case 'success':
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <b className="font-bold text-white">{n.actor}</b> pintó
          <span className="font-mono tabular text-white">
            ({n.x}, {n.y})
          </span>
          {n.color && (
            <>
              <Swatch color={n.color} />
              <span className="text-white">{resolveColorName(n.color)}</span>
            </>
          )}
        </span>
      );
    case 'shape':
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <b className="font-bold text-white">{n.actor}</b> lanzó
          <span className="text-white">«{n.figureName}»</span>
          {n.color && <Swatch color={n.color} />}
          <span className="font-mono tabular text-white">
            ({n.x}, {n.y})
          </span>
        </span>
      );
    case 'rain':
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <b className="font-bold text-white">{n.actor}</b> lanzó lluvia
          {n.multicolor ? (
            <span className="text-white">multicolor</span>
          ) : (
            n.color && (
              <>
                <Swatch color={n.color} />
                <span className="text-white">{resolveColorName(n.color)}</span>
              </>
            )
          )}
          <span className="text-white">· {n.count} píxeles</span>
        </span>
      );
    case 'reset':
      return (
        <span>
          <b className="font-bold text-white">{n.actor}</b> reinició el lienzo
        </span>
      );
    case 'error':
      return <span className="text-white">{n.message}</span>;
  }
}

export function NotificationOverlay({
  notifications,
  resolveColorName,
}: {
  notifications: OverlayNotification[];
  resolveColorName: (hex: string) => string;
}) {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex w-[min(440px,85vw)] flex-col items-end gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {notifications.map((n) => {
          const Icon = ICONS[n.kind];
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-[var(--radius-md)] border border-white/10',
                'bg-black/35 px-3.5 py-2.5 text-base font-semibold text-white backdrop-blur-[1.5px]',
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE[n.kind])} />
              <div className="min-w-0">
                <NotificationBody n={n} resolveColorName={resolveColorName} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
