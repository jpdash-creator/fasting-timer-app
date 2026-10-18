import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { t } from '../lib/i18n';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

let alerted = false;
let failureHandler: (name: string, error: unknown) => void = () => {
  if (alerted) return;
  alerted = true;
  try {
    Alert.alert(
      t('common.storageErrorTitle', { defaultValue: 'Could not save your data' }),
      t('common.storageErrorBody', {
        defaultValue: 'Your latest changes are kept while the app is open but may be lost when it closes. Free up some storage space and try again.',
      }),
    );
  } catch { /* nothing else to do */ }
};

/** Lets tests / the UI replace the default alert. */
export function setStorageFailureHandler(fn: (name: string, error: unknown) => void) {
  failureHandler = fn;
}

/**
 * Spec 16.7: a failed write is retried once; if it fails again the user is told once and the
 * in-memory state is kept (the error is swallowed so zustand does not roll back).
 */
export function resilient(base: Pick<StateStorage, 'getItem' | 'setItem' | 'removeItem'>): StateStorage {
  return {
    getItem: (name) => base.getItem(name),
    removeItem: (name) => base.removeItem(name),
    setItem: async (name, value) => {
      try {
        await base.setItem(name, value);
      } catch {
        try {
          await base.setItem(name, value);
        } catch (e2) {
          failureHandler(name, e2);
        }
      }
    },
  };
}

export const storage = createJSONStorage(() => resilient(AsyncStorage));
