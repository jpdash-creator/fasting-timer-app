import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WaterEntry, WeightEntry } from '../types';
import { storage, uid } from './storage';

interface LogState {
  weights: WeightEntry[];
  water: WaterEntry[];
  hasHydrated: boolean;
  addWeight: (kg: number, at?: number, note?: string) => void;
  deleteWeight: (id: string) => void;
  addWater: (ml: number, at?: number) => void;
  deleteWater: (id: string) => void;
  clearAll: () => void;
}

export const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      weights: [],
      water: [],
      hasHydrated: false,
      addWeight: (kg, at = Date.now(), note) =>
        set((s) => ({ weights: [...s.weights, { id: uid(), at, kg, note }].sort((a, b) => a.at - b.at) })),
      deleteWeight: (id) => set((s) => ({ weights: s.weights.filter((w) => w.id !== id) })),
      addWater: (ml, at = Date.now()) => set((s) => ({ water: [...s.water, { id: uid(), at, ml }] })),
      deleteWater: (id) => set((s) => ({ water: s.water.filter((w) => w.id !== id) })),
      clearAll: () => set({ weights: [], water: [] }),
    }),
    {
      name: 'fw.logs',
      version: 1,
      storage,
      partialize: (s) => ({ weights: s.weights, water: s.water }) as any,
      onRehydrateStorage: () => () => useLogStore.setState({ hasHydrated: true }),
    },
  ),
);
