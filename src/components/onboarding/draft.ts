import { create } from 'zustand';
import type { ProtocolId, Settings } from '../../types';
import { PRESET_PROTOCOLS } from '../../lib/protocols';

/** In-memory onboarding selections (null = not chosen yet, so Continue stays disabled). */
interface Draft {
  goal: Settings['goal'] | null;
  experience: Settings['experience'] | null;
  protocolId: ProtocolId | null;
  safety: [boolean, boolean, boolean];
  setGoal: (g: Settings['goal']) => void;
  setExperience: (e: Settings['experience']) => void;
  setProtocol: (p: ProtocolId) => void;
  toggleSafety: (i: 0 | 1 | 2) => void;
}

export const useOnboardingDraft = create<Draft>((set) => ({
  goal: null, experience: null, protocolId: null, safety: [false, false, false],
  setGoal: (goal) => set({ goal }),
  setExperience: (experience) => set({ experience }),
  setProtocol: (protocolId) => set({ protocolId }),
  toggleSafety: (i) => set((s) => {
    const next = [...s.safety] as Draft['safety'];
    next[i] = !next[i];
    return { safety: next };
  }),
}));

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Eating window implied by the first meal and chosen protocol. Falls back to lastMeal for 5:2 / 36 h. */
export function planWindow(firstMeal: string, lastMeal: string, protocolId: ProtocolId, customEating?: number) {
  const eating = customEating ?? PRESET_PROTOCOLS.find((p) => p.id === protocolId)?.eatingMinutes ?? 0;
  const to = eating > 0 ? fmt(toMin(firstMeal) + eating) : lastMeal;
  return { from: firstMeal, to };
}

export function windowHours(firstMeal: string, lastMeal: string) {
  let m = toMin(lastMeal) - toMin(firstMeal);
  if (m <= 0) m += 1440;
  return Math.round((m / 60) * 10) / 10;
}
