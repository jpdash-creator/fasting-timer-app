// Web: the vibration API is blocked until the first user interaction (console error otherwise).
export type HapticKind = 'light' | 'success' | 'warning';

export function triggerHaptic(kind: HapticKind = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const active = (navigator as { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive;
  if (!active) return;
  try { navigator.vibrate(kind === 'light' ? 10 : kind === 'success' ? [10, 40, 10] : [30, 50, 30]); } catch {}
}
