// @ts-nocheck - run with: npx tsx scripts/check-csv.ts
import assert from 'node:assert/strict';
import { csvEscape, fastsToCsv, weightsToCsv, waterToCsv } from '../src/lib/csv';

assert.equal(csvEscape('plain'), 'plain');
assert.equal(csvEscape('a,b'), '"a,b"');
assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
assert.equal(csvEscape('=SUM(A1)'), "'=SUM(A1)");
assert.equal(csvEscape(null), '');
assert.equal(csvEscape(12.5), '12.5');
assert.equal(csvEscape(false), 'false');

const fast = {
  id: 'f1', protocolId: '16_8' as const, startAt: Date.UTC(2026, 0, 1, 20), endAt: Date.UTC(2026, 0, 2, 12),
  targetMinutes: 960, goalMet: true, mood: 4 as const, note: 'felt, "great"', stagesReached: ['fed', 'early'],
  createdAt: 0, updatedAt: 0,
};
const out = fastsToCsv([fast]);
const lines = out.trim().split('\r\n');
assert.equal(lines.length, 2);
assert.equal(lines[1], 'f1,16_8,2026-01-01T20:00:00.000Z,2026-01-02T12:00:00.000Z,16.00,16.00,true,4,fed early,"felt, ""great"""');
assert.ok(weightsToCsv([{ id: 'w', at: 0, kg: 70 }]).includes('1970-01-01T00:00:00.000Z,70.0'));
assert.ok(waterToCsv([{ id: 'x', at: 0, ml: 250 }]).endsWith('250\r\n'));
console.log('csv ok');
