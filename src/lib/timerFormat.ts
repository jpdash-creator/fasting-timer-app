import { t } from './i18n';
import { MIN } from './fastMath';
import { isToday } from './fastMath';

/** Locale clock time, with a short weekday when not today. */
export function clockLabel(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday(ms)) return time;
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

/** "10 hours 12 minutes" for screen readers. */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MIN));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(t('timer.spoken.hours', { count: h }));
  if (m > 0 || h === 0) parts.push(t('timer.spoken.minutes', { count: m }));
  return parts.join(' ');
}

/** "Oct 17, 8:30 PM" */
export function dateTimeLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
