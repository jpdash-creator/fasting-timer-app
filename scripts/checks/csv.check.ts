import { assert, check, describe, mkFast } from './harness';
import {
  FASTS_HEADER, WATER_HEADER, WEIGHT_HEADER, csvEscape, csvRow, fastsToCsv, waterToCsv, weightsToCsv,
} from '../../src/lib/csv';

/** Minimal RFC 4180 parser used to prove the writer round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

describe('CSV escaping (AC-15)');
check('RFC 4180: commas, quotes, CR/LF are quoted; quotes doubled', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape('l1\nl2'), '"l1\nl2"');
  assert.equal(csvEscape('l1\r\nl2'), '"l1\r\nl2"');
  assert.equal(csvEscape(''), '');
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
  assert.equal(csvEscape(0), '0');
  assert.equal(csvEscape(false), 'false');
});
check('formula injection is neutralised for text starting with = + - @ tab CR; numbers are untouched', () => {
  for (const s of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx']) assert.ok(csvEscape(s).startsWith("'") || csvEscape(s).startsWith('"\''), s);
  assert.equal(csvEscape(-5), '-5');
  assert.equal(csvEscape('safe = fine'), 'safe = fine');
});
check('unicode (emoji, Arabic, Hindi) passes through unchanged', () => {
  for (const s of ['😀 great', 'ممتاز', 'बहुत अच्छा', 'naïve café']) assert.equal(csvEscape(s), s);
});

describe('fasts / weight / water CSV');
check('headers and row shape; ISO-8601 UTC instants; sorted by start', () => {
  const a = mkFast({
    id: 'a', startAt: Date.UTC(2026, 0, 2, 20), endAt: Date.UTC(2026, 0, 3, 12), mood: 4, goalMet: true,
    stagesReached: ['fed', 'early'], note: 'felt, "great"\nsecond line',
  });
  const b = mkFast({ id: 'b', startAt: Date.UTC(2026, 0, 1, 20), endAt: Date.UTC(2026, 0, 2, 4), goalMet: false });
  const rows = parseCsv(fastsToCsv([a, b]));
  assert.deepEqual(rows[0], FASTS_HEADER);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], 'b'); // earlier start first
  assert.equal(rows[2][2], '2026-01-02T20:00:00.000Z');
  assert.equal(rows[2][4], '16.00');
  assert.equal(rows[2][6], 'true');
  assert.equal(rows[2][8], 'fed early');
  assert.equal(rows[2][9], 'felt, "great"\nsecond line'); // round-trips exactly
  for (const r of rows.slice(1)) assert.equal(r.length, FASTS_HEADER.length);
});
check('a running fast exports with blank end/duration/goal', () => {
  const r = parseCsv(fastsToCsv([mkFast({ startAt: Date.UTC(2026, 0, 1), endAt: null })]))[1];
  assert.equal(r[3], '');
  assert.equal(r[4], '');
  assert.equal(r[6], '');
});
check('lines end with CRLF and the file ends with CRLF; empty export is just the header', () => {
  const out = fastsToCsv([]);
  assert.equal(out, csvRow(FASTS_HEADER) + '\r\n');
  assert.ok(weightsToCsv([]).endsWith('\r\n'));
});
check('weight (kg, 1 decimal, ISO) and water (ml) exports', () => {
  const w = parseCsv(weightsToCsv([{ id: 'w1', at: Date.UTC(2026, 5, 1), kg: 70.04, note: '=bad' }]));
  assert.deepEqual(w[0], WEIGHT_HEADER);
  assert.deepEqual(w[1], ['w1', '2026-06-01T00:00:00.000Z', '70.0', "'=bad"]);
  const m = parseCsv(waterToCsv([{ id: 'x', at: Date.UTC(2026, 5, 1, 8), ml: 250 }]));
  assert.deepEqual(m[0], WATER_HEADER);
  assert.deepEqual(m[1], ['x', '2026-06-01T08:00:00.000Z', '250']);
});
check('10 000 fasts export quickly and every row parses back to 10 columns', () => {
  const fasts = Array.from({ length: 10_000 }, (_, i) =>
    mkFast({ startAt: 1_700_000_000_000 + i * 90_000_000, endAt: 1_700_000_000_000 + i * 90_000_000 + 57_600_000, note: `n${i}, "q"` }));
  const t0 = Date.now();
  const rows = parseCsv(fastsToCsv(fasts));
  assert.equal(rows.length, 10_001);
  assert.ok(rows.every((r) => r.length === FASTS_HEADER.length));
  assert.ok(Date.now() - t0 < 3000);
});
