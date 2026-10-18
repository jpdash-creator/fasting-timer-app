import { format } from 'date-fns';
import { useFastStore } from '../stores/fastStore';
import { useLogStore } from '../stores/logStore';
import { fastsToCsv, waterToCsv, weightsToCsv } from './csv';

export type ExportKind = 'fasts' | 'weight' | 'water';

export type ExportResult = 'shared' | 'saved' | 'unavailable' | 'empty';

export function buildExport(kind: ExportKind): { name: string; csv: string; rows: number } {
  const stamp = format(new Date(), 'yyyy-MM-dd');
  if (kind === 'fasts') {
    const fasts = useFastStore.getState().fasts;
    return { name: `fastline-fasts-${stamp}.csv`, csv: fastsToCsv(fasts), rows: fasts.length };
  }
  const logs = useLogStore.getState();
  if (kind === 'weight') {
    return { name: `fastline-weight-${stamp}.csv`, csv: weightsToCsv(logs.weights), rows: logs.weights.length };
  }
  return { name: `fastline-water-${stamp}.csv`, csv: waterToCsv(logs.water), rows: logs.water.length };
}
