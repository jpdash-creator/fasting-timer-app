import type { Fast, WaterEntry, WeightEntry } from '../types';

/** RFC 4180 field escaping. Also neutralises spreadsheet formula injection in free text. */
export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(',');
}

export function buildCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join('\r\n') + '\r\n';
}

const iso = (ms: number | null) => (ms === null ? '' : new Date(ms).toISOString());

export const FASTS_HEADER = [
  'id', 'protocol', 'start_iso', 'end_iso', 'duration_hours', 'target_hours', 'goal_met', 'mood', 'stages_reached', 'note',
];

export function fastsToCsv(fasts: Fast[]): string {
  const sorted = [...fasts].sort((a, b) => a.startAt - b.startAt);
  return buildCsv(FASTS_HEADER, sorted.map((f) => [
    f.id, f.protocolId, iso(f.startAt), iso(f.endAt),
    f.endAt === null ? '' : ((f.endAt - f.startAt) / 3_600_000).toFixed(2),
    (f.targetMinutes / 60).toFixed(2), f.goalMet === null ? '' : f.goalMet, f.mood ?? '',
    f.stagesReached.join(' '), f.note,
  ]));
}

export const WEIGHT_HEADER = ['id', 'date_iso', 'weight_kg', 'note'];
export function weightsToCsv(weights: WeightEntry[]): string {
  return buildCsv(WEIGHT_HEADER, [...weights].sort((a, b) => a.at - b.at)
    .map((w) => [w.id, iso(w.at), w.kg.toFixed(1), w.note ?? '']));
}

export const WATER_HEADER = ['id', 'date_iso', 'amount_ml'];
export function waterToCsv(water: WaterEntry[]): string {
  return buildCsv(WATER_HEADER, [...water].sort((a, b) => a.at - b.at).map((w) => [w.id, iso(w.at), w.ml]));
}
