/** The 'appearance' namespace has identical keys and placeholders in all 6 languages. */
import fs from 'node:fs';
import path from 'node:path';
import { assert, check, describe } from './harness';

const LOCALES = path.join(__dirname, '..', '..', 'src', 'locales');
const LANGS = ['en', 'es', 'pt-BR', 'de', 'hi', 'ar'];
const flat = (o: unknown, pre = ''): Record<string, string> =>
  Object.entries(o as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === 'object' && v) Object.assign(acc, flat(v, `${pre}${k}.`)); else acc[`${pre}${k}`] = String(v);
    return acc;
  }, {});
const load = (l: string) => flat(JSON.parse(fs.readFileSync(path.join(LOCALES, l, 'appearance.json'), 'utf8')));
const ph = (s: string) => (s.match(/%\{\w+\}/g) ?? []).sort().join(',');

describe('Appearance i18n parity');
const en = load('en');
for (const l of LANGS.slice(1)) {
  check(`${l} has the same keys and placeholders as en`, () => {
    const x = load(l);
    assert.deepEqual(Object.keys(x).sort(), Object.keys(en).sort());
    for (const k of Object.keys(en)) {
      assert.ok(x[k].trim().length > 0, `${l}.${k} empty`);
      assert.equal(ph(x[k]), ph(en[k]), `${l}.${k} placeholders`);
    }
  });
}
