# Web build test report (Phase C2)

Target: react-native-web + Vite 8 dev server (`npm run web`, http://localhost:8081), Playwright MCP (Chromium, headless), viewport 390x844 (320x640 on key screens), localStorage seeding with the keys `fw.settings`, `fw.fasts`, `fw.logs`, `fw.purchase`, `fw.paywallMeta` (shape `{state,version:1}`, verified still the store keys). Run on 2026-10-18/19. Only scenarios run in the final code state are marked pass.

## Defects found and fixed

| # | Defect | Root cause | Fix (file) |
|---|---|---|---|
| 1 | Vite failed to load the app: `ReferenceError: require is not defined` | `require('...png')` in ESM-only Vite | `import` of the PNGs + `*.png` module declaration: `src/components/settings/AppearanceSection.tsx`, `src/app/paywall.tsx`, `src/platform/assets.d.ts` |
| 2 | Console error "BackHandler is not supported on web" on every paywall open | `BackHandler.addEventListener` unconditionally (also present in the Expo build) | guard `Platform.OS === 'android'`: `src/app/paywall.tsx` |
| 3 | Close / back on a deep-linked or reloaded modal (e.g. `/protocol-picker`, `/log-water`) did nothing, user stranded | `router.back()`/`dismiss()` no-op when the stack has one route | fall back to `replace('/')` (Timer tab): `src/router/index.ts` |
| 4 | Space did not toggle `role="switch"` (Settings switches), only Enter | global web Space handler covered radio/tab/checkbox only | added `switch`: `src/navigation/webEffects.ts` |
| 5 | axe `scrollable-region-focusable` flake (about 40% of runs after tapping a locked control, paywall) | NOT an app defect: headless Chromium produces no frame after the last paint, so the reanimated CSS entering animation (`visibility:hidden` until it starts) stays pending (`Animation.pending=true`); any pointer move starts it. Real content is focusable | test-harness only: pointer move before axe in `scripts/axe-harness.js` (rule not disabled); 24/24 clean afterwards |

## Scenario matrix (final code state)

| Area | Result |
|---|---|
| Boot, hydration, no flash, fresh storage -> `/welcome`, onboarded storage -> Timer | pass |
| All routes: `/welcome /goal /experience /schedule /safety /protocol /reminders /plan-summary /paywall /history /stats /settings /protocol-picker /fast-editor /fast-summary /log-weight /log-water /stage-info /share-card /timer /unknown` (44 route x storage-state loads): zero console warnings/errors, zero failed requests | pass (after fixes 1, 2) |
| Unknown route -> Timer (onboarded) / Welcome (fresh); onboarding routes with onboarding done -> Timer; app routes with fresh storage -> Welcome | pass (no 404 page, same redirect model as designed) |
| `?date=` selects the day, `/paywall?trigger=gate&feature=themes`, back/forward, reload on deep route; tab back goes to first tab | pass |
| Deep-linked modal Close | fixed (3) |
| Onboarding 8 steps, Back keeps selections, safety warning then proceed, reminders, plan summary -> paywall -> close after delay | pass |
| Paywall mock annual purchase -> Pro (`source: trial`), restore purchases | pass |
| Timer: start now, start early (eating window), edit start (overlap error), ring + stage chip -> stage-info, over-goal, 24 h safety sheet (Escape intentionally does not close), end now -> summary (mood, note, save) -> eating window | pass |
| Clock control: elapsed derives from timestamps (+3 h, +13 h, +17 h, +25 h correct) | pass |
| Protocol picker (free gating -> paywall, Pro switch with mid-fast confirm, custom protocol create + persisted) | pass |
| Water quick add + custom amount, undo toast; Log weight/water 7-entry free limit + Upgrade row | pass |
| History: calendar, day filter, add past fast, edit + overlap error, delete + undo, free locked preview, 5:2 | pass |
| Stats Overview/Weight/Water free and Pro, charts render (17 svg), tooltip on tap | pass |
| Settings: theme (light/dark/system), weight/water units, all 6 languages (de/es/pt-BR/hi/ar/en; `<html lang dir>`, ar = rtl), restore, manage subscription (opens mock store URL in a new tab), privacy/terms (in-app reader, no URLs in dev env), support mailto, delete all -> Welcome (Pro cache kept) | pass |
| CSV export (fasts, weight, water): real download with BOM, headers `id,protocol,start_iso,...`, ISO dates | pass |
| Appearance palettes (covered by axe pal-*), locked chip -> paywall, icon picker web message | pass |
| Keyboard: Tab order = visual order, 3 px focus ring, Space/Enter on checkbox/radio/switch (fixed 4), sheet focus + Escape returns focus | pass |
| `prefers-reduced-motion` honoured (reanimated dev notice only) | pass |
| Persisted state across reload | pass |
| Visual vs `docs/screenshots` baselines (light+dark, pixel diff + eyeballed): identical for static screens (onboarding, picker, share card, sheets, history empty, settings sheets); other differences are seeded data/time only. Ionicons, gradients, shadows, charts, tab bar landmark render. Baseline Timer tab bar was clipped; migrated is not | pass |
| Perf: cold load to Timer 0.6 s (warm Vite deps), 17 DOM mutations/s with Timer at 1 Hz, 3 long tasks (50-56 ms, startup), JS heap 68.3 -> 67.6 MB over 2 min, all requests same-origin | pass |
| Banners: VerifyLapsed (axe `timer-lapsed`) | pass |

## axe-core (wcag2a/aa, 21a/aa, 22aa, best-practice), final code, harness `scripts/axe-harness.js`

83 scenarios x light+dark = 166 runs per language.

| | EN light | EN dark | AR light | AR dark |
|---|---|---|---|---|
| all 83 scenarios (incl. 24 palette scenarios) | 0 | 0 | 0 | 0 |

320x640 (paywall, timer idle/fasting, settings, stats Pro, history Pro, safety, picker): 0 violations, no horizontal scroll. `incomplete` items unchanged (icon-font `color-contrast`, `label-content-name-mismatch` on icon buttons; contrast pairs asserted in `npm run check`). One transient run was lost to a Vite restart (connection refused) and repeated in full.

Screenshots: `docs/screenshots/migrated/` (390x844, `<scenario>-light|dark[-ar].png`, 170 files) and `docs/screenshots/migrated/320/`.

## Known web-only console notes
- Dev only: `[Reanimated] Reduced motion setting is enabled` when reduced motion is emulated.
- `[vite] connecting/connected`, analytics `console.log` lines (debug level).

## Not coverable on web (needs a device)
Local notifications and permission banner (always "unavailable" on web), real Play/App Store billing (mock only), haptics, native share sheet (web shows the unavailable message), alternate app icons, splash, VoiceOver/TalkBack, safe-area insets on notched devices, native back gesture, deep links via `fastline://`, notifee background events.
