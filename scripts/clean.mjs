// Removes build outputs and caches. Usage: npm run clean  (add --all to also delete node_modules)
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  'android/app/build', 'android/build', 'android/.gradle', 'android/app/.cxx',
  'ios/build', 'ios/Pods', 'dist', 'web-build', 'node_modules/.cache', 'node_modules/.vite',
];
if (process.argv.includes('--all')) targets.push('node_modules');
for (const t of targets) {
  const p = join(root, t);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log('removed', t);
  }
}
