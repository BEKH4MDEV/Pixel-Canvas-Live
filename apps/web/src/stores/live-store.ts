import { create } from 'zustand';
import type { ConnectionState, GameSnapshot, GameStatus, Leaderboard } from '@pcl/contracts';

interface LiveStore {
  status: GameStatus;
  connectionState: ConnectionState;
  /** Inicio en curso (conteo o conexión previa a activar). */
  starting: boolean;
  endedAt: string | null;
  /** Nombre del canal; NO viene por el SSE, se carga por HTTP (config). */
  channel: string;
  /** Top de la ronda actual (para «ronda actual» de Estadísticas). */
  leaderboard: Leaderboard;
  applyState: (state: GameSnapshot) => void;
  setLeaderboard: (leaderboard: Leaderboard) => void;
  setChannel: (channel: string) => void;
}

/**
 * Estado en vivo del panel, alimentado EXCLUSIVAMENTE por el SSE del admin (`state` y
 * `leaderboard`). El canal se rellena aparte por HTTP. Ningún evento de pintado toca este store.
 */
export const useLiveStore = create<LiveStore>((set) => ({
  status: 'INACTIVE',
  connectionState: 'disconnected',
  starting: false,
  endedAt: null,
  channel: '',
  leaderboard: [],
  applyState: (state) =>
    set({
      status: state.status,
      connectionState: state.connectionState,
      starting: state.starting,
      endedAt: state.endedAt,
    }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setChannel: (channel) => set({ channel }),
}));
