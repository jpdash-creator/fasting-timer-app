import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Fast, Protocol } from '../types';
import { isGoalMet } from '../lib/fastMath';
import { stagesReached } from '../lib/stageData';
import { storage, uid } from './storage';

interface FastState {
  fasts: Fast[];
  activeFastId: string | null;
  hasHydrated: boolean;
  startFast: (protocol: Protocol, startAt?: number) => Fast;
  endFast: (endAt?: number) => Fast | null;
  updateFast: (id: string, patch: Partial<Fast>) => void;
  addFast: (f: Omit<Fast, 'id' | 'createdAt' | 'updatedAt'>) => Fast;
  deleteFast: (id: string) => Fast | null;
  restoreFast: (f: Fast) => void;
  setActiveTarget: (protocol: Protocol) => void;
  clearAll: () => void;
}

export const useFastStore = create<FastState>()(
  persist(
    (set, get) => ({
      fasts: [],
      activeFastId: null,
      hasHydrated: false,
      startFast: (protocol, startAt = Date.now()) => {
        // Spec 16.4: never two running fasts. Return the one that is already running.
        const running = get().fasts.find((x) => x.id === get().activeFastId && x.endAt === null);
        if (running) return running;
        const now = Date.now();
        const fast: Fast = {
          id: uid(), protocolId: protocol.id, startAt, endAt: null,
          targetMinutes: protocol.fastingMinutes, goalMet: null, mood: null, note: '',
          stagesReached: [], createdAt: now, updatedAt: now,
        };
        set((s) => ({ fasts: [...s.fasts, fast], activeFastId: fast.id }));
        return fast;
      },
      endFast: (endAt = Date.now()) => {
        const { fasts, activeFastId } = get();
        const f = fasts.find((x) => x.id === activeFastId);
        if (!f) return null;
        const done: Fast = {
          ...f, endAt, goalMet: isGoalMet(f, endAt),
          stagesReached: stagesReached(endAt - f.startAt), updatedAt: Date.now(),
        };
        set({ fasts: fasts.map((x) => (x.id === f.id ? done : x)), activeFastId: null });
        return done;
      },
      updateFast: (id, patch) =>
        set((s) => ({
          fasts: s.fasts.map((f) => {
            if (f.id !== id) return f;
            const next = { ...f, ...patch, updatedAt: Date.now() };
            if (next.endAt) {
              next.goalMet = isGoalMet(next, next.endAt);
              next.stagesReached = stagesReached(next.endAt - next.startAt);
            }
            return next;
          }),
        })),
      addFast: (f) => {
        const now = Date.now();
        const fast: Fast = { ...f, id: uid(), createdAt: now, updatedAt: now };
        if (fast.endAt === null && get().activeFastId) {
          // Same guard as startFast: a second running fast is never created.
          const running = get().fasts.find((x) => x.id === get().activeFastId);
          if (running) return running;
        }
        if (fast.endAt) {
          fast.goalMet = isGoalMet(fast, fast.endAt);
          fast.stagesReached = stagesReached(fast.endAt - fast.startAt);
        }
        set((s) => ({ fasts: [...s.fasts, fast], activeFastId: fast.endAt ? s.activeFastId : fast.id }));
        return fast;
      },
      deleteFast: (id) => {
        const f = get().fasts.find((x) => x.id === id) ?? null;
        set((s) => ({
          fasts: s.fasts.filter((x) => x.id !== id),
          activeFastId: s.activeFastId === id ? null : s.activeFastId,
        }));
        return f;
      },
      restoreFast: (f) =>
        set((s) => ({
          fasts: [...s.fasts, f],
          activeFastId: f.endAt === null ? f.id : s.activeFastId,
        })),
      setActiveTarget: (protocol) =>
        set((s) => ({
          fasts: s.fasts.map((f) =>
            f.id === s.activeFastId
              ? { ...f, protocolId: protocol.id, targetMinutes: protocol.fastingMinutes, updatedAt: Date.now() }
              : f,
          ),
        })),
      clearAll: () => set({ fasts: [], activeFastId: null }),
    }),
    {
      name: 'fw.fasts',
      version: 1,
      storage,
      partialize: (s) => ({ fasts: s.fasts, activeFastId: s.activeFastId }) as any,
      onRehydrateStorage: () => () => useFastStore.setState({ hasHydrated: true }),
    },
  ),
);

export const selectActiveFast = (s: { fasts: Fast[]; activeFastId: string | null }) =>
  s.fasts.find((f) => f.id === s.activeFastId) ?? null;
