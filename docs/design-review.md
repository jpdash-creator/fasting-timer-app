# Fastline design review (source-level, read-only)

Scope: src/theme.ts, src/components/{ui,timer,onboarding,paywall,history,stats,logs,settings,share,banners}, src/app/(tabs), (onboarding), paywall, fast-summary, stage-info, protocol-picker, fast-editor, log-weight, log-water, share-card. No browser was used and no source was edited. Contrast numbers were computed from the theme hex values (WCAG relative luminance); the chart palette was run through the dataviz `validate_palette.js`.

Skills actually invoked through the Skill tool (all five loaded successfully, none failed):
1. `impeccable:impeccable` (critique + audit). Loaded. `impeccable context` reported NO_PRODUCT_MD and no DESIGN.md, so the incumbent code was treated as design authority. The detector hook was not run (read-only, no edits).
2. `taste-skill:taste-skill`. Loaded. It is scoped to landing pages and portfolios and explicitly excludes native product UI. I applied only its portable parts: AI-tell list, em-dash ban, one accent and one radius scale, button/form contrast checks, empty/loading/error states, reduced motion, dark mode parity. Its web-only rules (hero, bento, Tailwind, GSAP) were not applicable.
3. `design:design-critique`. Loaded, applied as the critique frame (first impression, usability, hierarchy, consistency, accessibility).
4. `design:accessibility-review`. Loaded, applied as a WCAG 2.1 AA pass. Source-level only: no screen reader, no keyboard walk, no zoom test.
5. `dataviz`. Loaded. Palette validator run; findings in section 4.

Spec rules (section 15): calm, encouraging, science-aware; teal accent; 16pt cards; 28pt buttons; system font; tabular numerals; ring centre 56pt/600; titles 28/700; body 17; captions 13; one primary button per screen; empty state = one sentence + one action; ring eases 600 ms on focus; confetti at most 1.5 s.

What already works (keep): copy tone is warm and never shaming and has no em-dashes; one accent hue; semantic tokens for light and dark; 56pt buttons and 44pt+ targets almost everywhere; every chart has a visible text summary and the graphic is hidden from screen readers; reduce-motion is honoured for confetti and ring; tabular numerals on timers; undo instead of confirm for deletes; non-dismissible safety sheets; the Pro-gating is honest (no fake social proof).

---

## 1. P0: broken, illegible or inaccessible

| # | Where | Problem | Exact change |
|---|---|---|---|
| P0-1 | `src/app/fast-summary.tsx:36-48` | `usePostFastPaywall()` is called at line 48, after an early `return` at line 37. If the fast disappears or is not found on one render and exists on the next (undo, store rehydrate, deep link), React throws "rendered more hooks than previous render". | Move `const maybePaywall = usePostFastPaywall();` (and the `useMemo`/`useState` already above) to before the `if (!fast ...)` guard, i.e. directly after line 34. |
| P0-2 | `src/theme.ts:14` `eatingRing: '#E8931F'` | Amber is 2.43:1 on white and 2.06:1 on the track. Fails WCAG 1.4.11 (3:1 for graphics) and the dataviz contrast check. Used for the eating-window ring (`app/(tabs)/index.tsx:154`), the weight goal line (`stats/WeightPanel.tsx:75`) and the safety warning border (`(onboarding)/safety.tsx:60`). The goal line is unlabelled, so the dataviz rule "WARN requires visible labels" is also unmet. | Light `eatingRing: '#C27400'` (3.63:1 on white, 3.06:1 on `track`). Dark value `#F5B45E` already passes (9.0:1). Keep `eatingText`. Add a direct label for the goal line (see section 4). |
| P0-3 | `src/theme.ts:15,22` `border` | `#E6E6E0` on white is 1.25:1 (dark 1.28:1). It is the only boundary of text inputs, search field, chips and unselected option cards, so those controls have no perceivable boundary (WCAG 1.4.11). Affects `FilterBar.tsx:16`, `fast-summary.tsx:137-139`, `fast-editor.tsx:166`, `log-water.tsx:93`, `log-weight.tsx:98`, `protocol-picker.tsx:196`, `TimeRow` text input `SettingsRows.tsx:226`, unselected `OptionCard` (`OnboardingScaffold.tsx:103`). | Add a token `controlBorder` (light `#8A8A82` = 3.5:1 on white; dark `#7A8681` = 4.3:1 on surface). Use it for input/search/unselected-chip borders; keep `border` for card hairlines and separators only. |
| P0-4 | `src/components/stats/Widgets.tsx:19-35` SegmentedControl | Selected segment is `surface` on `track` = 1.18:1; selection is carried only by 700 vs 500 weight. Not a perceivable state change for low vision/colour-blind users. | Selected segment: add `borderWidth: 1.5, borderColor: colors.accent` and `color: colors.accent`; or fill the selected pill with `accentSoft` plus accent text (5.0:1). |
| P0-5 | `src/app/(tabs)/index.tsx:123`, `theme.ts:15` | Spec says "Fasting (>= goal, ring full, green)", but `success === accent === fastingRing` (`#26705F`). Reaching the goal changes nothing about the ring; the same applies to `WaterRing` (`WaterPanel.tsx:28`) and FastRow (`FastRow.tsx:74`). The only signal is a small checkmark line. This is the single most important moment of the product and it is visually silent. | Add an overtime treatment, not a new hue: when `over`, draw a second thin arc (stroke 6) inside the ring in `colors.success` at 100% for the first lap, set the centre fill to `accentSoft`, and keep the check-circle. If a distinct green is wanted use `success: '#2E8B57'` light / `#5CC98F` dark (both >= 4.5:1 on surface), never reuse it for series 4. |

---

## 2. P1: clear UX and visual weaknesses

| # | Where | Problem | Exact change |
|---|---|---|---|
| P1-1 | `src/app/fast-summary.tsx:92-104` ("Stages reached" on a fresh summary) | `stagesReached()` always includes `fed` (startHour 0, `lib/stages.ts:5,19-22`), so a 30-minute fast shows a card titled "Stages reached" with one chip "Fed". Manually added fasts store `[]` (`fast-editor.tsx:56`) giving a card with a title and no content. | Render the card only when `fast.stagesReached.filter(s => s !== 'fed').length > 0`; otherwise render nothing. Optional: if reached, replace the title with the highest stage name as an `accentSoft` hero chip and list the others below as `Caption`. |
| P1-2 | `src/app/(tabs)/_layout.tsx:6-10,22` tab bar | Icon size is the navigator default (about 25), label 11/14. Icons are visually small against the 56pt controls elsewhere, and 11pt is the smallest text in the app. | `tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? focused_ : name} size={26} color={color} />`; `tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' }`; `tabBarItemStyle: { paddingTop: 4 }`; keep `tabBarStyle` hairline top border. Hide nothing: always show labels. |
| P1-3 | `src/components/timer/ProgressRing.tsx:16-19` (ring motion) | `progress` changes every second, and each change starts a new 600 ms `Easing.out(cubic)` tween, so the arc advances in decelerating micro-steps (visible stutter). The spec's "ease over 600 ms on focus" is never triggered on focus; it only runs on first mount. | Split the two behaviours: on focus/mount tween 0 to target with 600 ms out-cubic (use `useFocusEffect` in `index.tsx` to bump a `replayKey` prop); on live ticks (`Math.abs(target - p.value) < 0.02`) set `p.value = withTiming(target, { duration: 1000, easing: Easing.linear })`. Also add `accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}` at line 23 (WaterRing already has it). |
| P1-4 | `src/app/(tabs)/index.tsx:128-148,166-174` (ring typography) | Idle ring puts the protocol name in the 56pt slot (a long custom name shrinks via `adjustsFontSizeToFit`, so ring text size varies per user) and repeats the protocol already shown in the header chip (lines 203-204). A `leaf-outline` icon over it is a generic wellness cliche. Active state shows `HH:MM:SS` at 56pt, which shrinks on 320 pt-wide devices (inner width 224 vs about 235 needed). | Idle centre: goal as a number, e.g. `16h` at 56/600, caption "Ready" and a second caption "then 8h eating"; delete the leaf. Active centre: render `HH:MM` at 56/600 and `:SS` at 28/500 in `textSecondary` in the same baseline row (cuts width by about 30 percent, removes the shrink jitter, and the per-second churn happens in the small digits). Keep tabular numerals. |
| P1-5 | `src/components/stats/Widgets.tsx:154` + `WeightPanel.tsx:113`; `history/LockedHistory.tsx:37` + FAB `history.tsx:163-176` | Two filled primary buttons on one screen: Weight tab (Log weight + Unlock card), History for free users (Unlock + Add FAB). Violates "one primary per screen" and makes the paywall CTA compete with the daily action. | `LockedCard` and `LockedHistory` use `variant="secondary"` for their buttons. Keep the log/add action as the single filled button. |
| P1-6 | `src/app/(tabs)/stats.tsx:40-49` | Empty state has icon + title + body but no action (spec: one sentence + one action). The Weight tab has one, Overview does not. | Add `<PrimaryButton label={t('stats.empty.cta')} onPress={() => router.replace('/')} />` ("Start a fast") under the body. Same for History empty (`history.tsx:144`): make "Start a fast" the primary action and keep "Add a past fast" as a ghost link, because for a new user starting is the next step, not back-filling. |
| P1-7 | Tab screens horizontal padding | Timer uses `space.xl` (24, `index.tsx:188`), Stats/History/Settings use `space.lg` (16, `stats.tsx:73`, `history.tsx:160`, `settings.tsx:163`); the large title jumps 8 pt sideways when switching tabs. Modals mix both too (`log-*` 16, `fast-summary`/`protocol-picker` 24). | Add `layout.screenX = 20` (or 24) to `theme.ts` and use it in all tab and modal scroll containers. Also centralise bottom inset (`paddingBottom` literals 112, 120, 64). |
| P1-8 | Modal close buttons | Four variants: `ModalHeader` (44 circle, accentSoft, 22 icon), bare 26 icon in `fast-editor.tsx:84`, `log-water.tsx:77`, `log-weight.tsx:65`, `share-card.tsx:64` (text-colour), `paywall.tsx:195` (textSecondary). Also two header title styles (28pt `Title` vs 17pt bold in `share-card.tsx:61`). | Replace the hand-rolled headers with `<ModalHeader title=... />` in fast-editor, log-water, log-weight, share-card. Give `ModalHeader` an optional `variant="plain"` for the paywall if the circle is unwanted. |
| P1-9 | Two bottom-sheet systems | `timer/Sheet.tsx` (slide, drag handle, radius literal 24, 28pt `Title`) vs `settings/Sheets.tsx:13,24` `SheetFrame` (fade, no handle, radius `card+8`, 17pt bold title). The same gesture looks different depending on where it was opened. | Make `SheetFrame` a thin wrapper over `Sheet` (add `showTitle` prop) or delete it; set one `radius.sheet = 24` and use `animationType="slide"`. |
| P1-10 | Toasts (4 implementations) | `index.tsx:383-392`, `settings.tsx:337-346`, `paywall.tsx:288-301`, `logs/UndoToast.tsx`. Different colours, radii (chip vs card), durations (2.2 s, 3.5 s, 1.3 s, 5 s), and `UndoToast` nests `accessibilityRole="alert"` inside a polite live region (double announce). Timer toast timeouts are never cleared (`index.tsx:100-103`). | Extract one `<Toast message action? />` into `components/ui.tsx` (bg `colors.text`, fg `colors.bg`, radius `card`, 16 inset, `accessibilityLiveRegion="polite"` only). Reuse in all four places; keep 5 s when it has an action, 3 s otherwise. Remove the hex literals at `paywall.tsx:294-299`. |
| P1-11 | `src/components/stats/*` charts | See section 4 (legend, labels, widths, sizes). | See section 4. |
| P1-12 | `src/app/stage-info.tsx:53` | While a fast is running, only the current stage shows its description; reached and upcoming stages are one-liners, so the screen that exists to explain the science hides the explanation for 4 of 5 stages. | Show the description for every stage (they are short); dim upcoming ones with `textSecondary`. Or add a per-card chevron that expands; do not hide by default. |
| P1-13 | `src/components/stats/WaterPanel.tsx:12-37` | A third ring implementation: not animated, ignores reduce-motion, stroke 16 hardcoded, no `fill`. Welcome (`welcome.tsx:13-26`, stroke 14) and ShareCard (`ShareCard.tsx:42`, stroke 56*s) make four. | Make `ProgressRing` the only ring: add optional `gapAngle`, `startCap`, and `valueText` slots, then use it in WaterRing, welcome and Share. Define `ring = { stroke: 16, strokeHero: 14 }` tokens. |
| P1-14 | `src/app/(tabs)/settings.tsx:312-326` | Accessibility statement, medical disclaimer and privacy note are rows inside the "About" card with `header` roles, at the same visual weight as navigation rows. Settings has 9 groups and about 28 rows. | Move the three text blocks out of the card as `Caption` footers under the About group (`SettingsGroup footer=`), and collapse the five reminder toggles' hints behind one "Reminders" `LinkRow` that opens a sheet or screen if the page gets longer. |
| P1-15 | Tokens | See section 5. | See section 5. |
| P1-16 | `OnboardingScaffold.tsx:107-127` | `OptionCard` signals selection four times (border 2, accentSoft fill, icon colour, filled radio). Unselected radio ring is `textSecondary` (good) but the card border is the 1.25:1 hairline (P0-3). | Keep radio + border; drop the fill change or the icon recolour to cut noise. |
| P1-17 | `src/components/timer/Confetti.tsx:5` | Palette includes `#4A5FA8` blue and `#B5557A` pink, off-brand next to a one-accent system. | Use `[accent, eatingRing, accentSoft, success]` from the theme. Keep count 26, 1.4 s. |
| P1-18 | `welcome.tsx:43-44` and several fixed-size texts | Text inside the 200pt hero disc does not cap dynamic type; at 200 percent the "16:8" and tagline overflow the ring. | Add `maxFontSizeMultiplier={1.2}` to both texts, as the Timer ring already does. |

---

## 3. P2: delight and refinement

| # | Where | Idea |
|---|---|---|
| P2-1 | `welcome.tsx:36-46` hero circle | The previously empty circle now holds "16:8" and a tagline, but the 67 percent arc is static and sits on a gradient disc (`LinearGradient accentSoft to bg`) that fades to the page colour, so the hero edge disappears in dark mode. Replace the SVG with `ProgressRing` animating 0 to 0.67 over 900 ms (skip under reduce motion) and drop the gradient. |
| P2-2 | `welcome.tsx:53-58` | Centered hero plus three check-circle bullets is the generic AI/onboarding template. Rewrite bullets as one concrete line each with distinct icons (timer, bell, chart) or drop to two sentences. Same for `paywall.tsx:217-219` (three generic outline icons). |
| P2-3 | Mood pickers | Three copies of `['😣','😕','😐','🙂','😄']` (`index.tsx:26`, `fast-summary.tsx:21`, `history/moods.ts`). Centralise in `moods.ts`; consider Ionicons faces (`sad-outline` to `happy-outline`) so appearance does not vary per OS. |
| P2-4 | Fast end moment | `EndSheet` to `fast-summary` is the emotional peak. Add a one-time ring "settle" (ring snaps to full then fades the hero duration up from 0.9 scale, 300 ms) and show the ring snapshot above the duration instead of bare text (`fast-summary.tsx:61-66`). |
| P2-5 | `plan-summary.tsx:18-35` | `CheckRow` spring ignores reduce-motion; guard with `useReduceMotion()` and set `s.value = 1` directly. |
| P2-6 | `WeightPanel.tsx:98` | Em-dash placeholder `'—'`; use `'0.0'` in `textSecondary` or a hyphen to match the project's no-em-dash voice. |
| P2-7 | `PrimaryButton` disabled (`ui.tsx:79`) | `opacity .45` on a teal fill leaves white text at about 1.8:1. Exempt from AA, but looks broken in onboarding. Use `track` fill and `textSecondary` label when disabled. |
| P2-8 | `share-card.tsx:99`, `history.tsx:171` | `shadowColor '#000'`; tint shadows to `colors.text` at low opacity; replace the share preview shadow with a hairline border in dark mode. |
| P2-9 | `ShareCard.tsx:59` | Gradient hexes (`#1B5446,#2E7D6B,#3B9580`) are the spec's old accent, not the current theme accent `#26705F`; white on `#3B9580` is only 3.6:1 (fine for the large type, not for the 40*s date line). Source the gradient from theme tokens and darken the last stop to `#2F8571` (4.5:1). |
| P2-10 | `settings.tsx:170-191` Pro row | Sparkles icon with accent border is the stock "AI feature" cue. Use `ribbon`/`star-outline` for both states, keep the border. |
| P2-11 | Dev affordance | `settings.tsx:305-311` long-press on version toggles mock Pro in `__DEV__` or mock builds only; fine, but gate it to `__DEV__` alone before release. |
| P2-12 | Android pickers | `TimeChooser.tsx:21-33,68` uses deprecated `onChange` with `e.type` checks; `DateTimeField.tsx:45`, `TimeField.tsx:58`, `SettingsRows.tsx:197,211` mix `onChange` and `onValueChange` (v9.2.1 supports both; `onChange` is flagged deprecated). Pick `onValueChange` + `onDismiss` everywhere. |

---

## 4. Charts (dataviz rules)

Inventory: four plot charts (weekly hours bars, 30-day trend line/area, weekday bars, weight line with 7-day average and goal line) plus two ring gauges (WaterRing, fasting ring) and the calendar heat dots.

What passes: single teal hue for single-series charts; thin bars with 4 px rounded data ends; recessive rules (`border`); 7-day smoothing; direct text summaries (`ChartCard.tsx:41-44`) used as the text alternative; the graphic is hidden from AT so there is no double reading; empty states ("need two entries").

| # | Where | Rule | Change |
|---|---|---|---|
| C-1 | `WeightPanel.tsx:66-76` | >= 2 series need a legend; the weight chart has raw points (`textSecondary`), 7-day average (accent) and a goal line (amber) and none is labelled. Goal line also fails 3:1 on light (P0-2). | Add a one-row legend under the chart: dot "Entries", line "7-day average", dash "Goal 72 kg" (text in `textSecondary`, marks in series colours). Use `#C27400` light for the dashed goal line. Direct-label the goal on the right end (`referenceLine1Config.labelText`, 11pt, `eatingText`). |
| C-2 | Colour semantics | Amber means "eating window" on the Timer and "goal" on Weight; the same colour carries two meanings. | Draw the goal line in `textSecondary` dashed with the direct label (neutral, structural), and reserve amber for the eating window only. |
| C-3 | Y axes everywhere | No unit on any axis; only the summary names it. `yAxisTextStyle` 11pt. | Add the unit to the card title ("Weekly fasting hours (h)") and set tick font to 12 (`type.chartLabel`). |
| C-4 | `OverviewCharts.tsx:11` vs `WeightPanel.tsx:31` | Chart width computed two ways: `CHART_PAD = 16*2 + 16*2 + 40` vs `32 + 32 + 48`. Weight chart is 8 px narrower with a different y-axis gutter. Heights are 130 / 130 / 110 / 150. | One `useChartWidth()` in `ChartCard.tsx` (reads `layout.screenX`, card padding, `YAXIS_W`), and `CHART_H = 140` for all four; weight 160 only if the range chips need the room. |
| C-5 | `OverviewCharts.tsx:80` weekday chart | Highlights the top weekday with accent and the rest with `fastingRing + '99'` (string alpha hack). That is magnitude-agnostic emphasis: fine, but hex-concat breaks if the token ever becomes `rgb()`. | Add `accentMuted` token (light `#9CC5BB`, dark `#2E5F54`) and use it. |
| C-6 | Hover/inspection | No tooltip or press-to-read on any chart; values are only readable as the summary or the axis. | `gifted-charts` supports `pointerConfig` (line) and `renderTooltip` on bars; add a per-mark readout for the line charts and a persistent value label above the best bar. Keep summaries as the screen-reader path. |
| C-7 | Light/dark | Both modes use the same series mapping (teal), which is good; dark accent `#4FB59E` passes 6.6:1 on surface. Validator on `#4FB59E,#F5B45E,#A8B0AC` (dark) flagged lightness band and normal-vision floor between grey and amber (14.4 ΔE, floor 15). | Not an issue while only one coloured series per chart. If a 2nd coloured series is ever added, run `validate_palette.js` first and drop the grey. |
| C-8 | Light validator | `#26705F,#E8931F,#6B6B6B`: CVD and normal-vision separation pass (ΔE 20.6), chroma floor flags the grey (expected for a neutral context series), contrast WARN on amber 2.37:1 (P0-2). | Fix amber as in P0-2; the neutral grey raw-data series is acceptable as neutral. |
| C-9 | Fallback | `SimpleBars` (`ChartCard.tsx:14-29`) is used when the library throws; for the weight chart it plots `value - lo` as bars with no indication of the offset, which misrepresents the data. | Render the fallback as a plain list of the first/last/min/max values (the summary string is already there) instead of bars. |
| C-10 | Gauges | `WaterRing` (`WaterPanel.tsx:12-37`) has no animation, no `fill`, text sizes 40/13 (fine); `reached` uses `success` which equals accent (P0-5). | After P1-13 it inherits both from `ProgressRing`. |
| C-11 | Calendar (`HistoryCalendar.tsx`) | One hue; state is carried by filled vs outlined dot plus snowflake icon (secondary encoding present) and a legend. Dots are 7 px, below the 8 px marker minimum. | Dot 8 px, ring 1.5 px, 2 px surface gap; make days tappable to filter the list (currently `role="image"` only). |

---

## 5. Tokens to centralise (inconsistent today)

Measured from the source:

* **Type**: `theme.ts` defines only title 28, body 17, caption 13, ring 56. The code uses 20 distinct font sizes: 17 (17 times), 15 (17), 11 (10), 16 (7), 14 (5), 12 (5), 22 (4), 13 (4), 48/40/26 (3 each), 34/28 (2 each) plus 60, 56, 52, 44, 30, 18, 150. Proposed scale in `theme.ts`: `caption 13`, `label 15 (600)`, `body 17`, `bodyEmphasis 17/600`, `subtitle 22/700`, `title 28/700`, `stat 26/34/48 (three numeric display sizes, tabular)`, `ring 56/600`, `chart 12`, `micro 12 (badges)`. Remove 11, 14, 16, 18 entirely.
* **Colour**: add `controlBorder`, `accentMuted`, `success` (distinct or documented as equal), `overlay` (`rgba(0,0,0,0.45)` appears in `Sheet.tsx:25` and `Sheets.tsx:18`), `toastBg/toastFg`, `onDark` for share card. Remove hex literals in `paywall.tsx:294-299`, `Confetti.tsx:5`, `ShareCard.tsx:59`, `history.tsx:171`, `share-card.tsx:99`, `protocol-picker.tsx:20` (swatches should live in `theme.ts` as `protocolSwatches`).
* **Accent drift**: spec accent `#2E7D6B`; theme accent `#26705F` (darkened for contrast, correct) but `ShareCard`, `Confetti`, swatch[0] still use `#2E7D6B`. Pick one and reference the token.
* **Radius**: tokens `card 16, button 28, chip 999` exist, but literals 28 (x5, e.g. `WaterPanel.tsx:57`), 22 (x5), 24 (x4, `Sheet.tsx:30`), 12 (x5), 999 (x4), 4 (x4), 7 (x2) are used. Add `radius.sheet 24`, `radius.control 12`, `radius.circle(size)` helper, `radius.bar 4`.
* **Spacing**: `space` exists (4/8/12/16/24/32) but literals `2`, `6`, `8`, `10`, `88`, `112`, `120` pad layouts (`marginTop: 4` in `ChartCard.tsx:24`, `paddingBottom: 120` in `stats.tsx:73`, `log-water.tsx:82`). Add `layout.screenX`, `layout.scrollBottom` (tab-aware, from `useBottomTabBarHeight` plus 16), `layout.sectionGap`.
* **Sizes**: `hit.min = 44`, `hit.comfortable = 56` (row min-height, button height); circle sizes 24/26/28/36/40/44/48/52/56/72/96 are ad hoc. Provide `icon.sm 18 / md 22 / lg 26 / hero 44`.
* **Shadow/elevation**: only two ad hoc shadows; add `elevation.fab`, `elevation.card` (or none).
* **Motion**: durations 250/380/450/500/600/1400 and springs `{damping 12, stiffness 160}` are inline. Add `motion = { fast: 200, base: 350, ring: 600, celebrate: 1400 }`, one `useMotion()` returning 0 when reduce-motion.
* **Component duplicates to merge**: Toast (4), Sheet (2), ModalHeader/inline headers (4), ring (4), mood array (3), time pickers (`TimeRow`, `TimeField`, `TimeChooser`, `DateTimeField`), chip/pill (history FilterBar, fast-editor protocol chips, TimeChooser chip: three near-identical Pressables).

---

## 6. AI-slop and generic patterns found

* Icon-in-tinted-circle empty states (`stats.tsx:41-43`, `history.tsx:139-141`) repeated verbatim with the same 96 px circle: replace with a small ring illustration that matches the app icon, or remove the circle and let the title lead.
* Three check-circle bullets on welcome and three outline-icon benefits on paywall (see P2-2).
* `sparkles` icon on the Pro row; `leaf-outline` in the idle ring (P1-4); `bulb-outline` on InsightCard (`Widgets.tsx:100`), generic wellness iconography.
* Emoji as UI (mood rows) with OS-dependent rendering (P2-3).
* Uppercase 13pt bold week headers (`history.tsx:106`) plus uppercase 13pt group titles (`SettingsGroup.tsx:19`): fine individually, but the same device on two screens; keep one.
* Opacity as the universal pressed state (0.7 to 0.9 depending on the component) instead of a defined press style; settle on `0.85` plus `scale .98` for buttons and `background accentSoft` for rows.
* Good: no gradient text, no glow, no purple, no "Quietly trusted by", no fake ratings (guarded by `SHOW_SOCIAL_PROOF=false`), no em-dashes in copy.

---

## 7. Accessibility checklist (WCAG 2.1 AA, source-level)

| Criterion | Status | Notes |
|---|---|---|
| 1.4.3 text contrast | Pass | `textSecondary` on bg/surface/accentSoft/track = 5.1/5.3/4.55/4.50 (light) and 7.4+ (dark); accent on surface 5.9/6.6; danger on surface 5.3/6.3; onAccent on accent 5.9/7.5. Tightest: `textSecondary` on `track` 4.50 and `danger` on `accentSoft` 4.53 (light). |
| 1.4.11 non-text contrast | Fail | P0-2, P0-3, P0-4; also switch off-state outline passes (4.5:1). |
| 1.4.4 resize text | Partial | Ring and buttons cap at 1.2/1.3 (good); tab labels, welcome hero text and fixed 56pt heights are not capped or are too rigid for 200 percent. |
| 2.5.5 target size | Pass | Interactive elements are 44+ (calendar day 40x44 is the narrowest; badge/legend are not interactive). |
| 2.4.7 focus visible | Not verifiable at source level | Web build uses default outline; custom `WebDateTimeInput` sets `outlineColor` (good). |
| 1.1.1 non-text | Pass | Charts: visible summary plus hidden graphic; rings have labels; decorative icons hidden. |
| 4.1.2 name/role/value | Mostly pass | Rings: add `accessibilityValue` to `ProgressRing` (P1-3). `UndoToast` double role (P1-10). Segmented control uses `tab` role (fine). |
| 2.3.3 / motion | Pass with exceptions | Confetti and ring honour reduce-motion; `plan-summary` spring and `entering` animations do not (P2-5). |
| 3.3.1/3.3.2 forms | Pass | Labels above inputs; inline errors with `alert`. Placeholder-only note field on `log-weight.tsx:94-100` uses placeholder as the only visible label; add a `Caption` label. |

---

## 8. Top 10 fixes, in order

1. `fast-summary.tsx:48`: move `usePostFastPaywall()` above the early return (crash risk).
2. `theme.ts:14`: light `eatingRing` to `#C27400`; label the weight goal line (and make it neutral, C-2).
3. `theme.ts` + inputs: add `controlBorder` (`#8A8A82` / `#7A8681`) for all input, search and unselected-chip borders.
4. Make "goal reached" visible on the ring: overtime arc plus `accentSoft` centre (and same on WaterRing).
5. `fast-summary.tsx:92-104`: hide "Stages reached" unless something beyond `fed` was reached.
6. Tab bar: icon size 26, label 12/16/600 (`(tabs)/_layout.tsx`).
7. `ProgressRing`: separate focus tween (600 ms) from live ticks (linear 1 s) and add `accessibilityValue`; split ring digits into HH:MM 56pt and :SS 28pt.
8. One primary button per screen: `LockedCard` and `LockedHistory` become `secondary`; Stats and History empty states get a single "Start a fast" action.
9. Weight chart legend and direct labels; unify chart width, height and axis units across the four charts (`useChartWidth` in `ChartCard.tsx`).
10. Centralise tokens (type scale, `layout.screenX`, `radius.sheet/control`, `controlBorder`, `accentMuted`, motion) and merge the duplicate Toast, Sheet, ModalHeader and ring components.
