import { useFastStore } from '../stores/fastStore';
import { isProNow } from '../stores/purchaseStore';
import { useSettingsStore } from '../stores/settingsStore';
import { validateFastTimes } from './fastMath';
import { decideAutoStart } from './autoStartDecision';
import { getProtocol } from './protocols';
import { rescheduleNotifications } from './timerNotify';
import type { Fast } from '../types';

/** The most recently ended fast, or null. */
export function lastEndedFast(fasts: Fast[]): Fast | null {
  let best: Fast | null = null;
  for (const f of fasts) if (f.endAt !== null && (!best || f.endAt > (best.endAt ?? 0))) best = f;
  return best;
}

let handledEndAt: number | null = null;

/**
 * BR-08 (FR-09, Pro). If auto-start is on, no fast is running and the eating window of the last
 * fast has closed, start the next fast with startAt = windowEnd (5:2: start of the next fasting
 * day). Called on Timer focus, on app launch / foreground, and every tick while idle. Never
 * back-dates more than 12 h or past the fast's own target, never starts twice for the same
 * ended fast, then re-plans notifications. Returns the created fast, or null.
 */
export function maybeAutoStartNextFast(now = Date.now()): Fast | null {
  const settings = useSettingsStore.getState().settings;
  if (!settings.autoStartNextFast) return null;
  const fs = useFastStore.getState();
  const last = lastEndedFast(fs.fasts);
  const next = getProtocol(settings.activeProtocolId, settings);
  const decision = decideAutoStart({
    enabled: settings.autoStartNextFast,
    pro: isProNow(now),
    hasActiveFast: !!fs.activeFastId,
    now,
    lastEndAt: last?.endAt ?? null,
    lastEatingMinutes: last ? getProtocol(last.protocolId, settings).eatingMinutes : 0,
    next: { fastingMinutes: next.fastingMinutes, weeklyPattern: next.weeklyPattern },
    handledEndAt,
    overlaps: (startAt) => !!validateFastTimes(startAt, null, fs.fasts, undefined, now),
  });
  if (decision.kind !== 'start' || !last) return null;
  handledEndAt = last.endAt;
  const fast = fs.startFast(next, decision.startAt);
  rescheduleNotifications();
  return fast;
}
