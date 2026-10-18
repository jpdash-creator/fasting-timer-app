import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';
import { defaultSettings, mergeSettings } from '../lib/defaultSettings';
import { storage } from './storage';

export { defaultSettings, mergeSettings };

interface SettingsState {
  settings: Settings;
  hasHydrated: boolean;
  update: (patch: Partial<Settings>) => void;
  updateReminders: (patch: Partial<Settings['reminders']>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      hasHydrated: false,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateReminders: (patch) =>
        set((s) => ({ settings: { ...s.settings, reminders: { ...s.settings.reminders, ...patch } } })),
      reset: () => set({ settings: { ...defaultSettings, firstLaunchAt: Date.now() } }),
    }),
    {
      name: 'fw.settings',
      version: 1,
      storage,
      partialize: (s) => ({ settings: s.settings }) as any,
      /** Deep-merge onto defaults so fields added in later versions never come back undefined. */
      merge: (persisted, current) => ({
        ...current,
        settings: mergeSettings((persisted as { settings?: Partial<Settings> } | undefined)?.settings),
      }),
      onRehydrateStorage: () => () => useSettingsStore.setState({ hasHydrated: true }),
    },
  ),
);
