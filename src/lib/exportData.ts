import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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

/** Writes the CSV and opens the share sheet (native) or downloads it (web). */
export async function exportCsv(kind: ExportKind): Promise<ExportResult> {
  const { name, csv, rows } = buildExport(kind);
  if (rows === 0) return 'empty';

  if (Platform.OS === 'web') {
    // BOM so Excel detects UTF-8.
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  }

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write('\ufeff' + csv);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: name,
  });
  return 'shared';
}
