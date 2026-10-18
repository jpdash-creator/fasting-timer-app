import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { buildExport, type ExportKind, type ExportResult } from './exportBuild';

export type { ExportKind, ExportResult };
export { buildExport };

/** Writes the CSV to the cache directory and opens the native share sheet (web: exportData.web.ts downloads it). */
export async function exportCsv(kind: ExportKind): Promise<ExportResult> {
  const { name, csv, rows } = buildExport(kind);
  if (rows === 0) return 'empty';

  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${name}`;
  // BOM so Excel detects UTF-8.
  await ReactNativeBlobUtil.fs.writeFile(path, '﻿' + csv, 'utf8');
  try {
    await Share.open({
      url: `file://${path}`,
      type: 'text/csv',
      filename: name.replace(/\.csv$/, ''),
      title: name,
      failOnCancel: false,
    });
  } catch {
    return 'unavailable';
  }
  return 'shared';
}
