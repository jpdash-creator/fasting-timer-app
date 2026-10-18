import { assert, check, describe } from './harness';
import {
  buildLinkingScreens, normalizeIncomingPath, normalizePathname, parseHref, resolveHref,
} from '../../src/navigation/hrefs';
// Pure JS (no React Native): the same parser React Navigation uses for the linking config.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getStateFromPath, getPathFromState } = require('@react-navigation/core');

describe('Navigation hrefs (old expo-router paths)');
check('group segments, index, trailing slash and /timer alias are normalised', () => {
  assert.equal(normalizePathname('/'), '');
  assert.equal(normalizePathname('/(tabs)'), '');
  assert.equal(normalizePathname('/(tabs)/index'), '');
  assert.equal(normalizePathname('/(tabs)/history/'), 'history');
  assert.equal(normalizePathname('/(onboarding)/plan-summary'), 'plan-summary');
  assert.equal(normalizePathname('/timer'), '');
  assert.equal(normalizePathname('/paywall?trigger=gate#x'), 'paywall');
});
check('string and object hrefs parse query + params (numbers stringified, undefined dropped)', () => {
  assert.deepEqual(parseHref('/history?date=2026-01-02'), { path: 'history', params: { date: '2026-01-02' } });
  assert.deepEqual(parseHref({ pathname: '/paywall', params: { trigger: 'gate', feature: 'themes', x: undefined } }).params, { trigger: 'gate', feature: 'themes' });
  assert.deepEqual(parseHref({ pathname: '/log-weight', params: { step: 5 } }).params, { step: '5' });
  assert.deepEqual(parseHref('/fast-editor?id=a%20b&flag').params, { id: 'a b', flag: '' });
});
check('every old href resolves to the right named route', () => {
  const want: Array<[string, string, string]> = [
    ['/', 'tab', 'Timer'], ['/timer', 'tab', 'Timer'], ['/history', 'tab', 'History'], ['/stats', 'tab', 'Stats'],
    ['/settings', 'tab', 'Settings'],
    ['/welcome', 'onboarding', 'Welcome'], ['/(onboarding)/welcome', 'onboarding', 'Welcome'],
    ['/(onboarding)/goal', 'onboarding', 'Goal'], ['/(onboarding)/experience', 'onboarding', 'Experience'],
    ['/(onboarding)/schedule', 'onboarding', 'Schedule'], ['/(onboarding)/safety', 'onboarding', 'Safety'],
    ['/(onboarding)/protocol', 'onboarding', 'Protocol'], ['/(onboarding)/reminders', 'onboarding', 'Reminders'],
    ['/(onboarding)/plan-summary', 'onboarding', 'PlanSummary'],
    ['/paywall', 'root', 'Paywall'], ['/protocol-picker', 'root', 'ProtocolPicker'], ['/fast-editor', 'root', 'FastEditor'],
    ['/fast-summary', 'root', 'FastSummary'], ['/log-weight', 'root', 'LogWeight'], ['/log-water', 'root', 'LogWater'],
    ['/stage-info', 'root', 'StageInfo'], ['/share-card', 'root', 'ShareCard'],
  ];
  for (const [href, kind, name] of want) {
    const r = resolveHref(href);
    assert.ok(r, href);
    assert.equal(r.kind, kind, href);
    assert.equal(r.name, name, href);
  }
  assert.equal(resolveHref('/nope'), null);
});

describe('Navigation linking path map (web URLs / deep links)');
const config = { screens: buildLinkingScreens() };
const parse = (p: string) => getStateFromPath(normalizeIncomingPath(p), config);
const leaf = (p: string) => {
  const s = parse(p);
  const top = s.routes[s.routes.length - 1];
  const nested = top.state?.routes[top.state.routes.length - 1];
  return { root: top.name, nested: nested?.name, params: nested?.params ?? top.params };
};
check('web URLs map to the same screens as before', () => {
  assert.deepEqual(leaf('/'), { root: 'Tabs', nested: 'Timer', params: undefined });
  assert.equal(leaf('/timer').nested, 'Timer');
  assert.equal(leaf('/history').nested, 'History');
  assert.equal(leaf('/stats').nested, 'Stats');
  assert.equal(leaf('/settings').nested, 'Settings');
  for (const [p, n] of [['welcome', 'Welcome'], ['goal', 'Goal'], ['experience', 'Experience'], ['schedule', 'Schedule'],
    ['safety', 'Safety'], ['protocol', 'Protocol'], ['reminders', 'Reminders'], ['plan-summary', 'PlanSummary']]) {
    const l = leaf('/' + p);
    assert.equal(l.root, 'Onboarding', p);
    assert.equal(l.nested, n, p);
  }
  for (const [p, n] of [['paywall', 'Paywall'], ['protocol-picker', 'ProtocolPicker'], ['fast-editor', 'FastEditor'],
    ['fast-summary', 'FastSummary'], ['log-weight', 'LogWeight'], ['log-water', 'LogWater'],
    ['stage-info', 'StageInfo'], ['share-card', 'ShareCard']]) {
    assert.equal(leaf('/' + p).root, n, p);
  }
});
check('query params arrive as route params (history date, paywall trigger/feature)', () => {
  assert.deepEqual(leaf('/history?date=2026-03-04').params, { date: '2026-03-04' });
  assert.deepEqual(leaf('/paywall?trigger=gate&feature=themes').params, { trigger: 'gate', feature: 'themes' });
});
check('native deep links: fastline://timer, fastline://paywall, fastline://history?date=', () => {
  // React Navigation strips the `fastline://` prefix; the remaining path may lack the leading slash.
  assert.equal(leaf('timer').nested, 'Timer');
  assert.equal(leaf('paywall').root, 'Paywall');
  assert.deepEqual(leaf('history?date=2026-03-04'), { root: 'Tabs', nested: 'History', params: { date: '2026-03-04' } });
});
check('state -> URL round-trips to the old web URLs', () => {
  const url = (p: string) => getPathFromState(parse(p), config);
  assert.equal(url('/'), '/');
  assert.equal(url('/history?date=2026-03-04'), '/history?date=2026-03-04');
  assert.equal(url('/plan-summary'), '/plan-summary');
  assert.equal(url('/paywall?trigger=gate&feature=themes'), '/paywall?trigger=gate&feature=themes');
});
