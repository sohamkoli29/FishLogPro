import { create } from 'zustand';

interface AppState {
  businessName: string;
  setBusinessName: (name: string) => void;
  pricesVisible: boolean;
  togglePricesVisible: () => void;
  isDbReady: boolean;
  setDbReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  businessName: 'My Fish Business',
  setBusinessName: (name) => set({ businessName: name }),
  pricesVisible: false,
  togglePricesVisible: () => set((s) => ({ pricesVisible: !s.pricesVisible })),
  isDbReady: false,
  setDbReady: (ready) => set({ isDbReady: ready }),
}));