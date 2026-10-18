import { check, describe } from './harness';

// The two original standalone scripts keep working on their own (`npx tsx scripts/check-csv.ts`);
// they assert at import time, so requiring them inside a check runs them.
describe('legacy standalone scripts');
check('scripts/check-csv.ts', () => { require('../check-csv'); });
check('scripts/check-autostart.ts', () => { require('../check-autostart'); });
