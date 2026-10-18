/**
 * Runs every pure-logic check. Usage: `npm run check` (= npx --yes tsx scripts/checks/run.ts).
 * Optional filter: `npm run check -- streaks` runs only files whose name contains "streaks".
 */
import { installStubs, queue } from './harness';

installStubs();
// Expected store-failure warnings from the purchase mocks are noise; set VERBOSE=1 to see them.
if (!process.env.VERBOSE) console.warn = () => {};

const FILES = [
  'timer', 'streaks', 'stats', 'notifications', 'autostart', 'csv', 'entitlement', 'stores', 'purchases', 'legacy', 'theme-contrast', 'appearance-i18n', 'theme-contrast', 'navigation',
];

async function main() {
  const only = process.argv[2];
  for (const f of FILES) {
    if (only && !f.includes(only)) continue;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(`./${f}.check`);
  }
  let pass = 0;
  const failures: string[] = [];
  let lastSuite = '';
  for (const c of queue) {
    if (c.suite !== lastSuite) { console.log(`\n${c.suite}`); lastSuite = c.suite; }
    try {
      await c.fn();
      pass++;
      console.log(`  ok   ${c.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n').slice(0, 6).join('\n         ') : String(e);
      failures.push(`${c.suite} :: ${c.name}\n         ${msg}`);
      console.log(`  FAIL ${c.name}\n         ${msg}`);
    }
  }
  console.log(`\n${pass} passed, ${failures.length} failed (${queue.length} checks)`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
}

void main();
