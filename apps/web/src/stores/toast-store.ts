import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastData {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toast: ToastData | null;
  show: (type: ToastType, message: string) => void;
  dismiss: () => void;
}

/** Un unico toast a la vez (documento 06, §5); el nuevo reemplaza al anterior. */
export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  show: (type, message) => set({ toast: { id: Date.now(), type, message } }),
  dismiss: () => set({ toast: null }),
}));

/** Helper imperativo para usar fuera de componentes. */
export const toast = {
  success: (m: string) => useToastStore.getState().show('success', m),
  error: (m: string) => useToastStore.getState().show('error', m),
  info: (m: string) => useToastStore.getState().show('info', m),
};
