import type { StageDef } from '../types';

/** Spec 11.3 stage thresholds. Pure (no i18n) so it can be unit-checked. */
export const STAGES: StageDef[] = [
  { id: 'fed', startHour: 0 },
  { id: 'early', startHour: 4 },
  { id: 'fatburn', startHour: 12 },
  { id: 'ketosis', startHour: 16 },
  { id: 'deep', startHour: 24 },
];

export function stageAt(elapsedMs: number): StageDef {
  const hours = Math.max(0, elapsedMs) / 3_600_000;
  let cur = STAGES[0];
  for (const s of STAGES) if (hours >= s.startHour) cur = s;
  return cur;
}

export function stagesReached(elapsedMs: number): string[] {
  const hours = Math.max(0, elapsedMs) / 3_600_000;
  return STAGES.filter((s) => hours >= s.startHour).map((s) => s.id);
}
