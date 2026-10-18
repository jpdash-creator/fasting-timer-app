// Playwright MCP `browser_run_code_unsafe` body (pass via `filename`). Edit ONLY / THEMES / LANG below, then run.
// Requires: dev server on http://localhost:8081, `npm i -D axe-core`. Set page.__CFG.ROOT to this project's absolute path. See scripts/axe-audit.md.
async (page) => {
const CFG = page.__CFG || {}; // optional overrides, see scripts/axe-audit.md
const ONLY = CFG.ONLY ?? '.';
const THEMES = CFG.THEMES ?? ['light', 'dark'];
const LANG = CFG.LANG ?? '';               // '' or 'ar' etc. (applies to every scenario)
const INC = CFG.INC ?? '';                // regex of incomplete rule ids to print node details for, e.g. 'color-contrast|aria-prohibited-attr'
const DETAIL = CFG.DETAIL ?? false;
const SHOT = CFG.SHOT ?? '';               // dir for per-scenario screenshots ('' = off); files <name>-<theme>[-lang].png
const W = CFG.W ?? 390, H = CFG.H ?? 844;       // viewport (use 320x640 for narrow runs)          // true -> print node details for violations
const ROOT = CFG.ROOT ?? (typeof process !== 'undefined' ? process.cwd() : '.'); // absolute project path; set CFG.ROOT if the MCP server's cwd differs
const AXE = ROOT + '/node_modules/axe-core/axe.min.js';
const BASE = 'http://localhost:8081';

const seed = (o) => {
  const now = Date.now(), HR = 3600e3, DAY = 24 * HR;
  const mk = (i, startAgo, durH, mood, note) => ({ id: 'f' + i, protocolId: '16_8', startAt: now - startAgo, endAt: now - startAgo + durH * HR, targetMinutes: 960, goalMet: durH >= 16, mood, note: note || '', stagesReached: durH >= 16 ? ['fed', 'early', 'fatburn'] : ['fed', 'early'], createdAt: now - startAgo, updatedAt: now - startAgo });
  const fasts = [];
  let active = null;
  if (o.history) for (let i = 0; i < 14; i++) fasts.push(mk(i, (i + 1) * DAY + 2 * HR, 14 + (i % 5), (i % 5) + 1, i % 3 === 0 ? 'Felt good today' : ''));
  if (o.fastMode === 'running') { fasts.push({ ...mk('a', 5 * HR, 0, null), endAt: null, goalMet: null, stagesReached: [] }); active = 'fa'; }
  if (o.fastMode === 'over') { fasts.push({ ...mk('a', 20 * HR, 0, null), endAt: null, goalMet: null, stagesReached: [] }); active = 'fa'; }
  if (o.fastMode === 'safety') { fasts.push({ ...mk('a', 25 * HR, 0, null), endAt: null, goalMet: null, stagesReached: [] }); active = 'fa'; }
  if (o.fastMode === 'stale') { fasts.push({ ...mk('a', 9 * DAY, 0, null), endAt: null, goalMet: null, stagesReached: [] }); active = 'fa'; }
  if (o.fastMode === 'eating') fasts.push(mk('e', 19 * HR, 17, 4));
  const settings = { onboardingDone: o.onboarding !== true, safetyAcknowledged: true, goal: 'routine', experience: 'new', activeProtocolId: o.proto || '16_8', accentTheme: o.accent || 'teal', customProtocols: [], units: { weight: 'kg', volume: 'ml' }, theme: o.theme, haptics: true, language: o.lang || '', reminders: { fastStart: true, fastEnd: true, halfway: true, oneHourLeft: true, windowClosing: true, windowClosingOffsetMin: 30, quietHours: { enabled: false, from: '22:00', to: '07:00' } }, firstMeal: '12:00', lastMeal: '20:00', waterGoalMl: 2000, goalWeightKg: o.logs ? 70 : null, autoStartNextFast: false, paywallMode: 'soft', firstLaunchAt: now - 30 * DAY };
  const weights = [], water = [];
  if (o.nw) for (let i = 0; i < o.nw; i++) weights.push({ id: 'w' + i, at: now - (o.nw - i) * DAY, kg: 78 - i * 0.3 });
  if (o.nh) for (let i = 0; i < o.nh; i++) water.push({ id: 'h' + i, at: now - i * 60e3 * 10, ml: 250 });
  if (o.logs) { for (let i = 0; i < 10; i++) weights.push({ id: 'w' + i, at: now - (10 - i) * DAY, kg: 78 - i * 0.3 }); for (let i = 0; i < 8; i++) water.push({ id: 'h' + i, at: now - i * 3 * HR, ml: 250 }); }
  return {
    'fw.settings': { state: { settings }, version: 1 },
    'fw.fasts': { state: { fasts, activeFastId: active }, version: 1 },
    'fw.logs': { state: { weights, water }, version: 1 },
    'fw.purchase': { state: { isPro: !!(o.pro || o.lapsed), source: (o.pro || o.lapsed) ? 'subscription' : 'none', expiresAt: o.lapsed ? now - 9 * DAY : o.pro ? now + 30 * DAY : null, billingIssue: false, lastCheckedAt: now, mockPro: !!o.pro && !o.lapsed }, version: 1 },
    'fw.paywallMeta': { state: { planReady: false, everPro: !!o.pro, postFastShown: true, lastExpiredShownAt: now }, version: 1 },
  };
};
const click = (txt) => async (p) => { await p.getByText(txt, { exact: false }).first().click(); await p.waitForTimeout(700); };
const clickRole = (role, name) => async (p) => { await p.getByRole(role, { name }).first().click(); await p.waitForTimeout(700); };
const chain = (...fs) => async (p) => { for (const f of fs) await f(p); };

// Locale-independent variants (used when LANG is set, because labels are translated).
const nthBtn = (i) => async (p) => { const l = p.locator('[role=button], button'); await (i < 0 ? l.nth((await l.count()) + i) : l.nth(i)).click(); await p.waitForTimeout(700); };
const nthTab = (i) => async (p) => { await p.getByRole('tab').nth(i).click(); await p.waitForTimeout(700); };
const L = (en, alt) => (LANG ? alt : en);

const S = [
  { name: 'ob-welcome', onboarding: true, route: '/welcome' },
  { name: 'ob-goal', onboarding: true, route: '/goal' },
  { name: 'ob-experience', onboarding: true, route: '/experience' },
  { name: 'ob-schedule', onboarding: true, route: '/schedule' },
  { name: 'ob-safety', onboarding: true, route: '/safety' },
  { name: 'ob-protocol', onboarding: true, route: '/protocol' },
  { name: 'ob-reminders', onboarding: true, route: '/reminders' },
  { name: 'ob-plan', onboarding: true, route: '/plan-summary' },
  { name: 'paywall', route: '/paywall?trigger=settings' },
  { name: 'timer-idle', route: '/' },
  { name: 'timer-fasting', fastMode: 'running', history: true, route: '/' },
  { name: 'timer-over', fastMode: 'over', history: true, route: '/' },
  { name: 'timer-eating', fastMode: 'eating', history: true, route: '/' },
  { name: 'stage-info', fastMode: 'running', route: '/stage-info' },
  { name: 'protocol-picker', route: '/protocol-picker' },
  { name: 'protocol-picker-pro', pro: true, route: '/protocol-picker' },
  { name: 'history-empty', route: '/history' },
  { name: 'history-pop', history: true, fastMode: 'running', route: '/history' },
  { name: 'history-pop-pro', history: true, pro: true, route: '/history' },
  { name: 'fast-editor-new', route: '/fast-editor' },
  { name: 'fast-editor-edit', history: true, route: '/fast-editor?id=f1' },
  { name: 'fast-summary', history: true, route: '/fast-summary?id=f1' },
  { name: 'stats-empty', route: '/stats' },
  { name: 'stats-free', history: true, logs: true, route: '/stats' },
  { name: 'stats-pro', history: true, logs: true, pro: true, route: '/stats' },
  { name: 'log-weight', logs: true, route: '/log-weight' },
  { name: 'log-water', logs: true, route: '/log-water' },
  { name: 'settings', history: true, route: '/settings' },
  { name: 'settings-pro', pro: true, route: '/settings' },
  { name: 'share-card', history: true, pro: true, route: '/share-card?fastId=f1' },
  { name: 'safety-sheet', fastMode: 'safety', history: true, route: '/' },
  { name: 'history-day-filter', history: true, pro: true, route: '/history', act: async (p) => { await p.locator('[aria-pressed="false"]').first().click(); await p.waitForTimeout(700); } },
  { name: 'stats-weight-empty', history: true, pro: true, route: '/stats', act: L(clickRole('tab', /weight/i), nthTab(1)) },
  { name: 'settings-theme', route: '/settings', act: L(click('Theme'), nthBtn(4)) },
  // interactive states (use `act` after load)
  { name: 'start-sheet', route: '/', act: L(clickRole('button', /start/i), nthBtn(1)) },
  { name: 'end-sheet', fastMode: 'running', history: true, route: '/', act: L(clickRole('button', /end fast/i), nthBtn(2)) },
  { name: 'stats-weight', history: true, logs: true, pro: true, route: '/stats', act: L(clickRole('tab', /weight/i), nthTab(1)) },
  { name: 'stats-water', history: true, logs: true, pro: true, route: '/stats', act: L(clickRole('tab', /water/i), nthTab(2)) },
  { name: 'settings-language', route: '/settings', act: L(click('Language'), nthBtn(5)) },
  { name: 'settings-units', route: '/settings', act: L(click('Weight unit'), nthBtn(2)) },
  { name: 'settings-export', pro: true, route: '/settings', act: L(click('Export'), nthBtn(-7)) },
  { name: 'settings-legal', route: '/settings', act: L(click('Privacy policy'), nthBtn(-4)) },
  { name: 'settings-delete', route: '/settings', act: L(click('Delete all'), nthBtn(-1)) },
  // --- appearance / palettes / banners / edge states (added in the 2nd pass) ---
  { name: 'settings-appearance', route: '/settings', scroll: '[role=radiogroup]' },
  { name: 'settings-appearance-pro', pro: true, route: '/settings', scroll: '[role=radiogroup]' },
  { name: 'appearance-locked-tap', route: '/settings', scroll: '[role=radiogroup]', act: async (p) => { await p.locator('[role=radio]').nth(1).click(); await p.waitForTimeout(900); } },
  { name: 'appearance-icon-web', pro: true, route: '/settings', scroll: '[role=radiogroup]', act: async (p) => { await p.locator('[role=radio]').nth(6).click(); await p.waitForTimeout(900); }, after: '[aria-live=polite]' },
  { name: 'settings-reminders-free', route: '/settings', scroll: '[role=switch] >> nth=3' },
  { name: 'timer-lapsed', lapsed: true, history: true, route: '/' },
  { name: 'timer-52-idle', pro: true, proto: '5_2', history: true, route: '/' },
  { name: 'history-52', pro: true, proto: '5_2', history: true, route: '/history' },
  { name: 'history-deeplink', history: true, pro: true, route: '/history?date=' + new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10) },
  { name: 'timer-alias', route: '/timer' },
  { name: 'timer-stale', fastMode: 'stale', route: '/' },
  { name: 'end-sheet-stale', fastMode: 'stale', route: '/', act: async (p) => { await p.locator('[role=dialog] [role=button], [role=dialog] button').last().click(); await p.waitForTimeout(900); } },
  { name: 'fast-editor-free-chip', route: '/fast-editor' },
  { name: 'fast-editor-chip-tap', route: '/fast-editor', act: async (p) => { await p.getByText(/·/).first().click(); await p.waitForTimeout(900); } },
  { name: 'log-water-9', nh: 9, route: '/log-water', bottom: true },
  { name: 'log-weight-9', nw: 9, route: '/log-weight', bottom: true },
];
for (const ac of ['ocean', 'dusk', 'sunrise']) {
  const A = { accent: ac, pro: true };
  S.push(
    { name: `pal-${ac}-timer-fasting`, ...A, fastMode: 'running', history: true, route: '/' },
    { name: `pal-${ac}-timer-over`, ...A, fastMode: 'over', history: true, route: '/' },
    { name: `pal-${ac}-timer-idle`, ...A, history: true, route: '/' },
    { name: `pal-${ac}-stats`, ...A, history: true, logs: true, route: '/stats' },
    { name: `pal-${ac}-history`, ...A, history: true, route: '/history' },
    { name: `pal-${ac}-settings`, ...A, history: true, route: '/settings', scroll: '[role=radiogroup]' },
    { name: `pal-${ac}-paywall`, ...A, route: '/paywall?trigger=settings' },
    { name: `pal-${ac}-share`, ...A, history: true, route: '/share-card?fastId=f1' },
  );
}

const axeRun = async () => {
  await page.addScriptTag({ path: AXE }).catch(() => {});
  return page.evaluate(async () => {
    const r = await axe.run({ include: [document], exclude: [['#error-toast']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    const sum = (a) => a.map((v) => ({ id: v.id, n: v.nodes.length, nodes: v.nodes.slice(0, 40).map((n) => ({ t: n.target.join(' ').slice(-120), h: n.html.slice(0, 200), m: (n.any[0] || n.all[0] || n.none[0] || {}).message })) }));
    return { v: sum(r.violations), inc: sum(r.incomplete), incRaw: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ t: n.target.join(' ').slice(-100), h: n.html.slice(0, 140), m: ((n.any[0] || n.all[0] || n.none[0] || {}).message || '').slice(0, 160), d: ((n.any[0] || {}).data && JSON.stringify((n.any[0] || {}).data).slice(0, 200)) || '' })) })) };
  });
};

// Metro restarts after source edits (connection refused for ~20 s): retry navigation.
const go = async (url) => { for (let i = 0; i < 40; i++) { try { await page.goto(url, { waitUntil: 'domcontentloaded' }); return; } catch (e) { await page.waitForTimeout(3000); } } throw new Error('server not reachable'); };
await page.setViewportSize({ width: W, height: H });
const re = new RegExp(ONLY);
const lines = [];
for (const sc of S.filter((s) => re.test(s.name))) for (const th of THEMES) {
  try {
    await page.emulateMedia({ colorScheme: th, reducedMotion: 'no-preference' });
    await go(BASE + '/');
    const data = seed({ ...sc, theme: th, lang: LANG });
    await page.evaluate((d) => { localStorage.clear(); for (const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }, data);
    await go(BASE + (sc.route || '/'));
    await page.waitForTimeout(3500);
    if (sc.scroll) { await page.locator(sc.scroll).first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(400); }
    if (sc.act) { await sc.act(page); await page.waitForTimeout(1800); }
    if (sc.after) { await page.locator(sc.after).first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(300); }
    if (sc.bottom) { await page.mouse.move(200, 400); await page.mouse.wheel(0, 4000); await page.waitForTimeout(500); }
    if (SHOT) await page.screenshot({ path: `${SHOT}/${sc.name}-${th}${LANG ? '-' + LANG : ''}.png` });
    const r = await axeRun();
    const total = r.v.reduce((a, b) => a + b.n, 0);
    const dlg = await page.evaluate(() => { const d = document.querySelector('[role=dialog],[aria-modal=true]'); return d ? (d.getAttribute('aria-label') || 'dialog') : ''; });
    lines.push(`${sc.name}|${th}${LANG ? '|' + LANG : ''} ${page.url().replace(BASE, '')}${dlg ? ' [dialog: ' + dlg + ']' : ''} V=${total} ${r.v.map((v) => v.id + 'x' + v.n).join(',')} | inc ${r.inc.map((v) => v.id + ':' + v.n).join(',')}`);
    if (INC) for (const v of r.incRaw) if (new RegExp(INC).test(v.id)) for (const n of v.nodes) lines.push(`   INC ${v.id} :: ${n.t} :: ${n.h} :: ${n.m} :: ${n.d}`);
    if (DETAIL) for (const v of r.v) for (const n of v.nodes) lines.push(`   ${v.id} :: ${n.t} :: ${n.h} :: ${n.m}`);
  } catch (e) { lines.push(`${sc.name}|${th} ERR ${String(e).slice(0, 160)}`); }
}
return lines.join('\n');
}
