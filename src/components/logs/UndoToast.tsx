import React, { useEffect } from 'react';
import { Toast } from '../ui';
import { space } from '../../theme';
import { t } from '../../lib/i18n';

export interface ToastState { id: number; message: string; onUndo: () => void }

/** Bottom toast with an Undo action (shared <Toast>); auto-dismisses after `duration` ms (spec: 5 s). */
export function UndoToast({ toast, onDismiss, duration = 5000, bottom = space.lg }: {
  toast: ToastState | null; onDismiss: () => void; duration?: number; bottom?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(onDismiss, duration);
    return () => clearTimeout(h);
  }, [toast, duration, onDismiss]);
  if (!toast) return null;
  return (
    <Toast
      message={toast.message} bottom={bottom}
      actionLabel={t('common.undo')} onAction={() => { toast.onUndo(); onDismiss(); }}
    />
  );
}
