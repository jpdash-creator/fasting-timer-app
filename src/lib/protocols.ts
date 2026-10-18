import type { Protocol, ProtocolId, Settings } from '../types';

const h = (n: number) => n * 60;

export const PRESET_PROTOCOLS: Protocol[] = [
  { id: '12_12', name: '12:12', fastingMinutes: h(12), eatingMinutes: h(12), isCustom: false, color: '#6BAA9B', proOnly: true },
  { id: '14_10', name: '14:10', fastingMinutes: h(14), eatingMinutes: h(10), isCustom: false, color: '#4C9A87', proOnly: true },
  { id: '16_8', name: '16:8', fastingMinutes: h(16), eatingMinutes: h(8), isCustom: false, color: '#2E7D6B' },
  { id: '18_6', name: '18:6', fastingMinutes: h(18), eatingMinutes: h(6), isCustom: false, color: '#2A6F8E', proOnly: true },
  { id: '20_4', name: '20:4', fastingMinutes: h(20), eatingMinutes: h(4), isCustom: false, color: '#4A5FA8', proOnly: true },
  { id: 'OMAD', name: 'OMAD (23:1)', fastingMinutes: h(23), eatingMinutes: h(1), isCustom: false, color: '#7A4FA0', proOnly: true },
  { id: '5_2', name: '5:2', fastingMinutes: h(24), eatingMinutes: 0, isCustom: false, color: '#B5557A', proOnly: true, weeklyPattern: { fastingDays: [2, 5] } },
  { id: '36H', name: '36 h', fastingMinutes: h(36), eatingMinutes: 0, isCustom: false, color: '#C0603A', proOnly: true },
];

export function allProtocols(settings: Pick<Settings, 'customProtocols'>): Protocol[] {
  return [...PRESET_PROTOCOLS, ...settings.customProtocols];
}

export function getProtocol(id: ProtocolId, settings: Pick<Settings, 'customProtocols'>): Protocol {
  return allProtocols(settings).find((p) => p.id === id) ?? PRESET_PROTOCOLS[2];
}

/** BR-04 */
export function recommendProtocol(
  firstMeal: string,
  lastMeal: string,
  experience: Settings['experience'],
): ProtocolId {
  const toMin = (t: string) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  let windowMin = toMin(lastMeal) - toMin(firstMeal);
  if (windowMin <= 0) windowMin += 24 * 60;
  let rec: ProtocolId = windowMin <= 8 * 60 ? '16_8' : windowMin <= 10 * 60 ? '14_10' : '12_12';
  if (experience === 'experienced') rec = '18_6';
  if (experience === 'new' && ['18_6', '20_4', 'OMAD'].includes(rec)) rec = '16_8';
  return rec;
}

/** ISO weekday (1 = Mon ... 7 = Sun) of a local date. */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Spec 16.11: is `d` one of the protocol's planned fasting days (5:2)? Always false without a weekly pattern. */
export function isPlannedFastingDay(p: Pick<Protocol, 'weeklyPattern'>, d: Date): boolean {
  return !!p.weeklyPattern?.fastingDays.includes(isoWeekday(d));
}

/** The next planned fasting day strictly after `from` (local midnight), or null without a weekly pattern. */
export function nextPlannedFastingDay(p: Pick<Protocol, 'weeklyPattern'>, from: Date): Date | null {
  if (!p.weeklyPattern?.fastingDays.length) return null;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (isPlannedFastingDay(p, d)) return d;
  }
  return null;
}
