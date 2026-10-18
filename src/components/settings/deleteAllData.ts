import { useFastStore } from '../../stores/fastStore';
import { useLogStore } from '../../stores/logStore';
import { useSettingsStore } from '../../stores/settingsStore';

/** FR-24 / AC-16: wipes fasts, logs and settings (keeps purchase state) and cancels notifications. */
export async function deleteAllData(): Promise<void> {
  try {
    // Owned by another module; import lazily so a missing export never blocks deletion.
    const mod: { cancelAll?: () => Promise<void> } = await import('../../services/notifications');
    await mod.cancelAll?.();
  } catch {
    // Notifications unavailable (web / Expo Go limits): nothing scheduled to cancel.
  }
  useFastStore.getState().clearAll();
  useLogStore.getState().clearAll();
  // Resets onboardingDone, so the root layout routes back to onboarding.
  useSettingsStore.getState().reset();
}
