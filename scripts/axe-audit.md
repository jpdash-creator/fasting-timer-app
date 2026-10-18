# axe-core accessibility audit (Expo web build)

Covers the web build only (react-native-web DOM). It does NOT cover native VoiceOver/TalkBack; test those by hand.

## Setup
1. `npm i -D axe-core` (already a devDependency).
2. Start the dev server yourself: `npx expo start --web --port 8081`. NOTE: Metro's file watcher can miss edits on some setups (seen on Windows, including OneDrive-synced folders); if a change does not show up, restart Metro with `--clear`.
3. Use the Playwright MCP (`browser_run_code_unsafe`). Its `filename` must live under the MCP allowed roots (the folder that contains this project, e.g. `Apps/.playwright-mcp/`), so copy `scripts/axe-harness.js` there, or install it once on the page (`page.__H = <harness>`) and run `page.__CFG = {ROOT, ONLY, THEMES, LANG, DETAIL, INC, SHOT, W, H}; return page.__H(page)` (`ROOT` = absolute path of this project, used to find `node_modules/axe-core`; `ONLY` = regex of scenario names, `LANG` = `''`/`'ar'`/..., `DETAIL` prints violation nodes, `INC` prints incomplete nodes, `SHOT` = directory for per-scenario screenshots, `W`/`H` = viewport, e.g. 320x640). About 20 scenario runs fit in one call (7 s each), so run it in chunks, e.g. `ONLY='^(ob-|paywall)'`.
4. The harness retries navigation for up to 2 min, so a Metro restart (after editing source) does not abort a run, but wait ~30 s after an edit before trusting results.

## What the harness does (per scenario x theme)
- viewport 390x844, `emulateMedia({colorScheme})`, reducedMotion no-preference.
- Opens `/`, writes localStorage, then navigates to the route and waits 3.5 s:
  - `fw.settings` = `{state:{settings:{...}},version:1}` (`onboardingDone` true except `ob-*`; `theme` set to light/dark; `language` from `LANG`)
  - `fw.fasts` = `{state:{fasts:[...],activeFastId},version:1}` (14 completed fasts when `history`, one running fast 5 h old for `running`, 20 h old for `over` (goal 16 h), one ended 2 h ago for `eating`)
  - `fw.logs` = `{state:{weights,water},version:1}`, `fw.purchase` (`isPro`/`mockPro` for Pro), `fw.paywallMeta`.
- Injects `node_modules/axe-core/axe.min.js` via `page.addScriptTag({path})` and runs
  `axe.run({include:[document],exclude:[['#error-toast']]}, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})`.
  `#error-toast` is the Expo dev-only error overlay, not app UI.
- Prints `scenario|theme route V=<violation node count> ids | inc <incomplete rule:count>`.

## Reaching screens
Direct routes (expo-router groups are not in the URL): onboarding `/welcome /goal /experience /schedule /safety /protocol /reminders /plan-summary` (needs `onboardingDone:false`), `/paywall?trigger=settings`, tabs `/ /history /stats /settings`, modals `/stage-info /protocol-picker /fast-editor[?id=f1] /fast-summary?id=f1 /log-weight /log-water /share-card?fastId=f1`.
Interactive states use an `act` click after load: Start sheet, End sheet, Stats Weight/Water tabs, Settings sheets (Language, Weight unit, Export, Delete all data).
RTL: set `LANG = 'ar'` and re-run (the layout sets `<html lang dir>`).

## Manual checks (not automatable by axe)
- Keyboard only: Tab reaches every control in visual order, focus ring visible (global `:focus-visible` style injected in `src/app/_layout.tsx`), Escape closes sheets/modals (RN Modal `onRequestClose`).
- `prefers-reduced-motion`: `emulateMedia({reducedMotion:'reduce'})`; confetti/ring animations should stop.
- Review every axe `incomplete` item (mostly `color-contrast` on gradients/overlapping text and `aria-prohibited-attr` on labelled generic Views).

## Results (final code state, 2nd pass 2026-10-18)
Violations = axe node count with tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice. Every scenario in `scripts/axe-harness.js` was run in English light+dark and Arabic (RTL) light+dark after the last source edit (the palette scenarios and the Settings group were re-run again after the very last edit, `role="img"` on the preview card).

| Screen / state (scenario names) | EN light | EN dark | AR light | AR dark |
|---|---|---|---|---|
| Onboarding 1-8 (`ob-*`) | 0 | 0 | 0 | 0 |
| Paywall free, gate via locked theme tap / locked protocol chip (`paywall`, `appearance-locked-tap`, `fast-editor-chip-tap`) | 0 | 0 (1 intermittent, see below) | 0 (1 intermittent) | 0 |
| Timer idle / fasting / over goal / eating / alias `/timer` (`timer-*`) | 0 | 0 | 0 | 0 |
| Timer: VerifyLapsedBanner, 5:2 idle, stale 9-day fast with 72 h safety sheet (`timer-lapsed`, `timer-52-idle`, `timer-stale`) | 0 | 0 | 0 | 0 |
| Stage info, protocol picker free/Pro, start/end/safety sheets, end sheet for >7-day fast | 0 | 0 | 0 | 0 |
| History: empty, populated free/Pro, day filter, 5:2 planned days, deep link `?date=` | 0 | 0 | 0 | 0 |
| Fast editor new/edit/free chip gating, fast summary | 0 | 0 | 0 | 0 |
| Stats: empty, free, Pro, Weight, Weight empty, Water | 0 | 0 | 0 | 0 |
| Log weight / water, with 9 entries (Upgrade row), share card | 0 | 0 | 0 | 0 |
| Settings free/Pro, Appearance group (free, Pro, locked tap, icon picker on web), free reminder rows, theme/language/units/export/legal/delete sheets | 0 | 0 | 0 | 0 |
| Palettes ocean / dusk / sunrise (Pro): timer fasting, over goal, idle, stats, history, settings, share card (`pal-*`) | 0 | 0 | 0 | 0 |

Intermittent: `scrollable-region-focusable` x1 was reported twice in about 12 runs on the paywall right after a tap on a locked control (screen transition frame); it did not reproduce in a 40-sample probe and never on direct paywall navigation. Not fixed.
Not reachable on web: NotificationPermissionBanner (`getPermissionStatus()` returns `unavailable` on web, it needs the native permission API); paywall in a non-teal palette (Pro users are redirected away from the paywall, free users always render teal).

Remaining `incomplete` items (axe could not decide; reviewed by hand):
- `color-contrast` (about 170 nodes over the 4 palettes): icon-font glyph elements ("content contains only non-text characters") and the timer text over the ring SVG ("contains an image node"). Text/background token pairs for all 4 palettes x light/dark are asserted (30 pairs each) by `scripts/checks/theme-contrast.check.ts` (`npm run check`).
- `label-content-name-mismatch` (1-12): icon-only buttons whose visible text is an icon-font glyph; the accessible name is the translated label.

## Manual checks done
- Keyboard only (Tab / Shift+Tab / Enter / Space / Arrows / Escape): Tab order follows visual order; every focused control shows the 3 px accent outline. Appearance group: each accent chip and icon is a tab stop, Enter and Space select (Space on role radio/tab/checkbox is handled by a global web key handler in `_layout.tsx`, react-native-web only handles Enter), locked chips open the paywall, the icon picker shows "App icons can only be changed in the Android and iOS apps." on web. Banners: Retry is reachable by Tab and activates with Enter. All bottom sheets take focus, keep Tab inside and close on Escape; the 24 h safety sheet intentionally stays open on Escape.
- History calendar: roving tab stop (one tab stop per month instead of one per marked day, was ~14-30), Arrow keys / Home / End move between marked days, Enter toggles the day filter.
- `prefers-reduced-motion`: honoured in code via `useReduceMotion()`.
- Visual: light+dark screenshots of every palette on Timer (fasting, over goal, idle), Stats, History, Settings, Share card; German 390 and 320, Hindi and Arabic checked for the new strings and banners. The Share card stays teal on purpose; "goal reached" success colour stays green in every palette on purpose.
- Not covered: native VoiceOver and TalkBack, real alternate app icon switching (needs a dev build), native notification permission banner.
