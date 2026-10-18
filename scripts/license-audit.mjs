// License audit for PRODUCTION dependencies (no extra runtime dependency).
// Usage: node scripts/license-audit.mjs [--all]    (--all includes devDependencies, informational)
// Exits 1 if any production package has a license outside ALLOW and is not listed in EXCEPTIONS.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const includeDev = process.argv.includes('--all');

const ALLOW = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'CC0-1.0', 'Unlicense',
  'OFL-1.1', // icon fonts
  'BlueOak-1.0.0', 'Python-2.0',
  'CC-BY-4.0', // data only (e.g. caniuse-lite)
]);

// Explicit exceptions: "name" -> justification. Keep this list short and reviewed.
// A trailing * matches a name prefix.
const EXCEPTIONS = {
  'make-plural': 'Unicode-DFS-2016 (permissive, MIT-like; needs the notice kept). Pulled in by i18n-js for plural rules.',
};

const cmd = `npm ls --all --parseable ${includeDev ? '' : '--omit=dev'}`;
let out = '';
try {
  out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
} catch (e) {
  out = e.stdout?.toString() ?? ''; // npm ls exits non-zero on extraneous/missing peers; the listing is still valid
}
const dirs = [...new Set(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))].filter((d) => d !== root);

/** Normalise the many shapes of the license field to a list of SPDX-ish ids. */
function licenseIds(pkg) {
  const raw = pkg.license ?? pkg.licenses;
  const arr = Array.isArray(raw) ? raw : [raw];
  const ids = [];
  for (const x of arr) {
    if (!x) continue;
    const s = typeof x === 'string' ? x : x.type ?? x.name;
    if (s) ids.push(String(s).trim());
  }
  return ids;
}
/** An SPDX expression passes if (for OR) any alternative is allowed, (for AND) all are. */
function expressionOk(expr) {
  const e = expr.replace(/[()]/g, ' ').trim();
  if (/\sOR\s/i.test(e)) return e.split(/\sOR\s/i).some((p) => expressionOk(p));
  if (/\sAND\s/i.test(e)) return e.split(/\sAND\s/i).every((p) => expressionOk(p));
  return ALLOW.has(e.trim());
}

const isException = (name) => Object.keys(EXCEPTIONS).some((k) => (k.endsWith('*') ? name.startsWith(k.slice(0, -1)) : k === name));
const byLicense = new Map();
const bad = [];
let count = 0;
const seen = new Set();
for (const d of dirs) {
  const pj = join(d, 'package.json');
  if (!existsSync(pj)) continue;
  let pkg;
  try { pkg = JSON.parse(readFileSync(pj, 'utf8')); } catch { continue; }
  if (!pkg.name || !pkg.version) continue;
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  count++;
  const ids = licenseIds(pkg);
  const label = ids.length ? ids.join(' / ') : 'UNKNOWN';
  if (!byLicense.has(label)) byLicense.set(label, []);
  byLicense.get(label).push(key);
  const ok = ids.length > 0 && ids.every((i) => expressionOk(i));
  if (!ok) {
    if (isException(pkg.name)) continue;
    bad.push({ key, label });
  }
}

console.log(`License audit (${includeDev ? 'all' : 'production'} dependencies): ${count} packages\n`);
for (const [lic, pkgs] of [...byLicense.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const listed = pkgs.length > 12 ? pkgs.slice(0, 12).join(', ') + `, ... (+${pkgs.length - 12})` : pkgs.join(', ');
  console.log(`${lic.padEnd(28)} ${String(pkgs.length).padStart(4)}  ${lic === 'MIT' ? '' : listed}`);
}
if (Object.keys(EXCEPTIONS).length) {
  console.log('\nExplicit exceptions:');
  for (const [n, why] of Object.entries(EXCEPTIONS)) console.log(`  ${n}: ${why}`);
}
if (bad.length) {
  console.error('\nNOT ALLOWLISTED:');
  for (const b of bad) console.error(`  ${b.key}  ->  ${b.label}`);
  process.exit(1);
}
console.log('\nOK: all production dependency licenses are allowlisted.');
