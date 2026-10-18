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
