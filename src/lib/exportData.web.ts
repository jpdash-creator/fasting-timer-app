import { buildExport, type ExportKind, type ExportResult } from './exportBuild';

export type { ExportKind, ExportResult };
export { buildExport };

/** Web: downloads the CSV through a temporary object URL. */
export async function exportCsv(kind: ExportKind): Promise<ExportResult> {
  const { name, csv, rows } = buildExport(kind);
  if (rows === 0) return 'empty';
  // BOM so Excel detects UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
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
