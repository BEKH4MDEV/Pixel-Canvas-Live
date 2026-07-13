import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiLogOut } from 'react-icons/fi';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useConfig } from '@/data/queries';
import { adminSse, type SseStatus } from '@/data/admin-realtime';
import { useLiveStore } from '@/stores/live-store';
import { useLogsStore } from '@/stores/logs-store';
import { GlobalLoading } from '@/components/GlobalLoading';
import { Logo } from '@/components/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { Tooltip } from '@/components/ui/Tooltip';
import { MobileRail } from './MobileRail';
import { Sidebar } from './Sidebar';
import { LivePreview } from './LivePreview';
import { LogsConsole } from './LogsConsole';
import { SECTIONS, type SectionId } from './sections';
import { RemountContext } from './section-remount';
import { cn } from '@/lib/cn';

export function AppShell() {
  const qc = useQueryClient();
  const [active, setActive] = useState<SectionId>('estado');
  const [remountNonce, setRemountNonce] = useState(0);
  const requestRemount = useCallback(() => setRemountNonce((n) => n + 1), []);

  const [sseStatus, setSseStatus] = useState<SseStatus>('connecting');
  const [everConnected, setEverConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const { data: config } = useConfig();

  const status = useLiveStore((s) => s.status);
  const connectionState = useLiveStore((s) => s.connectionState);
  const applyState = useLiveStore((s) => s.applyState);
  const setLeaderboard = useLiveStore((s) => s.setLeaderboard);
  const setChannel = useLiveStore((s) => s.setChannel);

  const pushLog = useLogsStore((s) => s.push);
  const setAllLogs = useLogsStore((s) => s.setAll);

  // ── SSE del panel: solo estado, top de ronda y consola ───────
  useEffect(() => {
    let cancelled = false;
    const loadLive = (): void => {
      void api
        .getLive()
        .then(({ state, logs, leaderboard }) => {
          if (cancelled) return;
          applyState(state);
          setLeaderboard(leaderboard);
          setAllLogs(logs);
          setLoading(false);
        })
        .catch(() => {
          /* 401: api.ts ya redirige al login */
        });
    };

    const offEvents = adminSse.subscribe((event) => {
      if (event.type === 'state') applyState(event.payload);
      else if (event.type === 'leaderboard') setLeaderboard(event.payload);
      else if (event.type === 'log') pushLog(event.payload);
    });
    const offStatus = adminSse.onStatus((s) => {
      setSseStatus(s);
      if (s === 'connected') {
        setEverConnected(true);
        loadLive();
      }
    });
    adminSse.start();

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        adminSse.close();
      } else {
        setLoading(true);
        adminSse.reconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      offEvents();
      offStatus();
      adminSse.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El canal no viene por el SSE; se rellena desde la config (HTTP).
  useEffect(() => {
    if (config?.liveChannel) setChannel(config.liveChannel);
  }, [config?.liveChannel, setChannel]);

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });

  const statusTone =
    status === 'INACTIVE'
      ? { tone: 'neutral' as const, pulse: false }
      : status === 'ACTIVE' && connectionState === 'connected'
        ? { tone: 'success' as const, pulse: true }
        : { tone: 'warning' as const, pulse: connectionState === 'reconnecting' };

  const ActiveComponent = SECTIONS.find((s) => s.id === active)?.Component ?? SECTIONS[0]!.Component;
  const rail = (
    <>
      <LivePreview />
      <LogsConsole />
    </>
  );

  const blocking = sseStatus === 'failed' || loading || (sseStatus === 'connecting' && everConnected);
  const loadingMessage =
    sseStatus === 'failed'
      ? 'No se pudo conectar con el servidor. Recarga la página para reintentar'
      : loading
        ? 'Cargando el panel'
        : 'Reconectando con el servidor';

  return (
    <div className="flex h-screen flex-col bg-canvas text-fg">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
        <Logo status={statusTone} />
        <div className="flex-1" />
        <span className="text-sm text-fg-subtle">{config?.adminName}</span>
        <Tooltip content="Cerrar sesión">
          <button
            onClick={() => logout.mutate()}
            className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-fg-subtle hover:bg-white/5 hover:text-fg"
            aria-label="Cerrar sesión"
          >
            {logout.isPending ? <Spinner className="h-4 w-4" /> : <FiLogOut />}
          </button>
        </Tooltip>
      </header>

      {/* Navegacion movil */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 lg:hidden">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm',
                s.id === active ? 'bg-brand-soft text-brand-strong' : 'text-fg-muted hover:bg-white/5',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:flex">
          <Sidebar active={active} onSelect={setActive} />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <RemountContext.Provider value={requestRemount}>
            <ActiveComponent key={`${active}:${remountNonce}`} />
          </RemountContext.Provider>
        </main>
        <aside className="hidden w-[400px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4 xl:flex">{rail}</aside>
      </div>

      <MobileRail>{rail}</MobileRail>

      <GlobalLoading show={blocking} spinner={sseStatus !== 'failed'} message={loadingMessage} />
    </div>
  );
}
