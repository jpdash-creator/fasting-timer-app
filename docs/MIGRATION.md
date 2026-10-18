# Expo to bare React Native migration (Phase A: foundation)

Fastline moved from Expo SDK 58 (expo-router, EAS) to a **bare React Native CLI project** (react-native 0.88.0, `@react-native-community/cli` 20.2.0, new architecture + Hermes, Kotlin `MainActivity`, Swift `SceneDelegate`) keeping a web target (react-native-web + Vite). There are no `expo*` packages in `package.json`. Phase A (this document) only built the native/config foundation; application code in `src/` still imports Expo modules until phases B to D migrate it (typecheck currently reports ~116 errors, all in `src/`, all "cannot find module expo-*").

## (a) Package replacement table

| Removed (Expo) | Replacement | Version | License (SPDX) | Purpose / caveats |
|---|---|---|---|---|
| expo, expo-router | `@react-navigation/native`, `/native-stack`, `/bottom-tabs` | 7.5.1 / 7.21.0 / 7.21.0 | MIT | Navigation. Needs `react-native-screens` + `react-native-safe-area-context` (already present). See section (c). |
| @expo/vector-icons | `@react-native-vector-icons/ionicons` | 13.1.5 | MIT (font: Ionicons, MIT) | Ionicons v8 font. Import from `@react-native-vector-icons/ionicons/static` (the default entry loads fonts dynamically and needs expo-font). All icon names used in `src/` exist in the v13 glyphmap. Web: add `@font-face` for `@react-native-vector-icons/ionicons/fonts/Ionicons.ttf` (web agent). |
| expo-notifications | `@notifee/react-native` | 9.1.8 | Apache-2.0 | Local/trigger notifications, channels, permission. **Caveat: last release Dec 2024 (effectively unmaintained); it is an old-architecture module running through the RN interop layer.** Build verified on Android (see section d); runtime behaviour on RN 0.88 must be checked on a device. |
| expo-haptics | `react-native-haptic-feedback` | 3.0.0 | MIT | Haptics. |
| expo-localization | `react-native-localize` | 3.7.2 | MIT | Locale, 24h clock, time zone. Supported locales declared in `ios/Fastline/Info.plist` (`CFBundleLocalizations`) and `android/.../res/xml/locale_config.xml`: en, ar, de, es, hi, pt-BR. |
| expo-file-system, expo-sharing | `react-native-blob-util` + `react-native-share` | 0.25.1 / 12.3.1 | MIT / MIT | Chose blob-util over `react-native-fs`: actively maintained (Sep 2026) vs RNFS last release Feb 2025. blob-util adds legacy storage permissions to the merged manifest; they are removed with `tools:node="remove"` in `AndroidManifest.xml`. |
| expo-splash-screen | `androidx.core:core-splashscreen` 1.0.1 (Android, Apache-2.0) + `LaunchScreen.storyboard` (iOS) | n/a | Apache-2.0 | `react-native-bootsplash` was removed: it pulled 6 `@expo/*` packages and `sharp` (+ LGPL libvips binaries). `npm ls --all` now shows no installed `@expo/*` or `sharp`; only UNMET OPTIONAL peer lines for `expo` / `expo-font` / `expo-linear-gradient` remain (optional peers of vector-icons / gifted-charts, not installed). No explicit hide call: the system splash dismisses on the first drawn frame (`src/platform/splash.ts` `hideSplash()` is a no-op kept for call sites). |
| expo-constants, expo-device | `react-native-device-info` (+ `react-native-config` for env) | 15.0.2 / 1.7.2 | MIT / MIT | App version/build/model. `Constants.expoConfig.extra` and `process.env.EXPO_PUBLIC_*` become `Config.X`. |
| expo-linear-gradient | `react-native-linear-gradient` | 2.8.3 | MIT | Same props (`colors`, `start`, `end`, `locations`). Web: react-native-web needs an alias/shim (web agent). |
| expo-iap | `react-native-iap` + `react-native-nitro-modules` | 17.1.0 / 0.37.1 | MIT / MIT | Store billing (Play Billing 9.x, StoreKit 2). Same maintainer and nearly identical API. Needs iOS 15+, Kotlin 2.1.20+ (template has 2.2.0). |
| expo-alternate-app-icons | `react-native-change-icon` | 5.0.0 | MIT | Alternate icons Ocean/Dusk/Sunrise. **Caveat: last release Aug 2023, old architecture (interop).** Android implementation is hard-wired to `.MainActivity<Name>` activity-aliases (done). |
| expo-linking | React Native `Linking` | built-in | MIT | `Linking.openURL`, `getInitialURL`, `openSettings`. React Navigation handles the `fastline://` scheme itself. |
| expo-status-bar | React Native `StatusBar` | built-in | MIT | `<StatusBar barStyle="dark-content" />`. |
| expo-font | static font embedding | n/a | n/a | Android: library Gradle task copies `Ionicons.ttf`; iOS: `UIAppFonts` in Info.plist. |
| EAS Build / Update / `eas.json` | Gradle / Xcode | n/a | n/a | `npm run android:release`, `npm run android:bundle`. No OTA updates. `eas.json` deleted; its env now lives in `.env.*`. |

Web / tooling (devDependencies): `vite` 8.3.4 (MIT), `@vitejs/plugin-react` 6.1.2 (MIT), `react-native-web` 0.21.4 (MIT, dependency), `react-dom` 19.3.0 (dependency), `tsx` 4.23.15 (MIT), `pngjs` 7.0.0 (MIT, was an undeclared transitive), `@resvg/resvg-js` 2.6.2 and `axe-core` 4.14 (both **MPL-2.0**, pre-existing devDependencies used only by asset generation / accessibility audit; never shipped; not allowlisted for production, flagged here for the owner's licence decision).

Kept as-is: async-storage 2.2.0, datetimepicker 9.2.1, flash-list 2.3.2, gesture-handler 3.3.x, reanimated 4.7.1, worklets 0.13.0, safe-area-context 5.10.x, screens 4.30.x, svg 15.16.0, view-shot 6.1.1, calendars, gifted-charts, zustand, date-fns, i18n-js.

License audit: `npm run license-audit` (production deps, allowlist in `scripts/license-audit.mjs`). Result: 590 packages, all allowlisted; explicit exceptions: `make-plural` (Unicode-DFS-2016, permissive; via i18n-js). `xdate` is `MIT OR GPL-2.0` (we take MIT).

### Native config applied (per library)

| Library | Android | iOS (unverified, no Mac) |
|---|---|---|
| notifee | Manifest: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` (not `USE_EXACT_ALARM`: Play restricts it). Boot receivers + `RECEIVE_BOOT_COMPLETED` + alarm-permission receiver come from notifee's merged manifest. `ACCESS_NOTIFICATION_POLICY` stripped. Small icon: `drawable-*/ic_stat_notification.png` (use `smallIcon: 'ic_stat_notification'`). | none required for local notifications |
| react-native-iap | Billing permission/dependency merged from the library; `compileSdk` 37 OK. | add the **In-App Purchase** capability in Xcode (Signing & Capabilities); Podfile workarounds only if the Folly-coroutine / Swift 6 `AnyMap.swift` errors appear (see openiap.dev setup page). |
| splash | `MainActivity.kt` calls `installSplashScreen()` before `super.onCreate`; `SplashTheme` (parent `Theme.SplashScreen`, `postSplashScreenTheme` = `AppTheme`) in `styles.xml`; `values/splash_colors.xml` (#FAFAF7) + `values-night/splash_colors.xml` (#0F1412); `drawable[-night]-*dpi/splash_icon.png` (coloured ring, not the white adaptive foreground, which is invisible on the light background). | `LaunchScreen.storyboard` (centred `SplashLogo` on named colour `SplashBackground`), `Colors.xcassets/SplashBackground.colorset` + `Images.xcassets/SplashLogo.imageset` (dark appearance included), `UILaunchStoryboardName=LaunchScreen`. Regenerate all with `node scripts/make-assets.js splash`. |
| vector-icons | library Gradle task copies fonts (no manual step) | `UIAppFonts` = `Ionicons.ttf` (via `npx rnvi-update-plist package.json ios/Fastline/Info.plist`; repeat when adding icon sets) |
| reanimated / worklets | `babel.config.js` has `react-native-worklets/plugin` (last) | same |
| gesture-handler | JS only: `import 'react-native-gesture-handler'` first in `index.js`; wrap root in `GestureHandlerRootView` | same |
| change-icon | `MainActivityDefault` (enabled, LAUNCHER) + `MainActivityOcean/Dusk/Sunrise` (disabled aliases); `MainActivity` has no LAUNCHER filter | `CFBundleIcons`/`CFBundleIcons~ipad` > `CFBundleAlternateIcons` Ocean/Dusk/Sunrise; `Ocean|Dusk|Sunrise.appiconset`; build setting `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES`. If Xcode complains about duplicate generated keys, delete the manual plist entries and use `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "Ocean Dusk Sunrise"` instead. |
| react-native-config | `app/build.gradle`: `envConfigFiles` (debug `.env.development`, release `.env.production`) + `dotenv.gradle`; proguard keep rule for `BuildConfig` | `Podfile` post_install sets `ENVFILE` per configuration (Release `.env.production`, otherwise `.env.development`). Not exposed to Info.plist (needs Xcode xcconfig step; not required). |
| localize | `android:localeConfig` + `res/xml/locale_config.xml` | `CFBundleLocalizations` |
| deep links | `fastline://` intent-filter on `MainActivity` | `CFBundleURLTypes` (scheme `fastline`); `SceneDelegate` forwards `openURLContexts` to `RCTLinkingManager` (already in template) |
| app identity | applicationId/namespace `com.fastline.app`, `versionName 1.0.0`, `versionCode 1`, portrait-only (`screenOrientation`), minSdk 24 (template), `usesCleartextTraffic` only in debug (template) | bundle id `com.fastline.app`, `MARKETING_VERSION 1.0.0`, iPhone portrait; iPad portrait + upside-down with `UIRequiresFullScreen`, `ITSAppUsesNonExemptEncryption=false`, `UIUserInterfaceStyle=Automatic` |

Release signing (Android): put `FASTLINE_UPLOAD_STORE_FILE`, `FASTLINE_UPLOAD_STORE_PASSWORD`, `FASTLINE_UPLOAD_KEY_ALIAS`, `FASTLINE_UPLOAD_KEY_PASSWORD` in `~/.gradle/gradle.properties` or as environment variables. Without them the release build is signed with the debug keystore (local smoke tests only). Keystores (`*.keystore` except `debug.keystore`) are git-ignored.

Env selection override: `ENVFILE=.env.something npm run android` (Android) / `ENVFILE=... npx react-native run-ios`.

## (b) API notes for the next agents

Always re-read the installed typings; these are the entry points.

**Notifee** (https://notifee.app/react-native/docs/overview, /triggers, /android/channels)
`import notifee, { TriggerType, AndroidImportance, AndroidNotificationSetting, EventType } from '@notifee/react-native'`
- Permission: `await notifee.requestPermission()` (iOS prompt + Android 13+ POST_NOTIFICATIONS); read state with `notifee.getNotificationSettings()` (`authorizationStatus`, `android.alarm`).
- Channel (Android, create before scheduling): `await notifee.createChannel({ id: 'fast-reminders', name: 'Fasting reminders', importance: AndroidImportance.HIGH })`.
- Schedule: `await notifee.createTriggerNotification({ id, title, body, data, android: { channelId, smallIcon: 'ic_stat_notification', color: '#2E7D6B', pressAction: { id: 'default' } } }, { type: TriggerType.TIMESTAMP, timestamp: date.getTime(), alarmManager: { allowWhileIdle: true } })`. Re-using `id` updates the pending trigger. Limits: 50 timestamp triggers on Android, ~64 on iOS.
- Android 12+ exact alarms: if `settings.android.alarm !== AndroidNotificationSetting.ENABLED` call `await notifee.openAlarmPermissionSettings()`; notifee re-schedules automatically when granted.
- Cancel: `notifee.cancelTriggerNotifications(ids?)`, `cancelNotification(id)`, `getTriggerNotificationIds()`.
- Events: `notifee.onForegroundEvent(({ type, detail }) => ...)` (EventType.PRESS) and **`notifee.onBackgroundEvent(async ...)` must be registered at module top level in `index.js`**, outside any component. Cold-start tap: `await notifee.getInitialNotification()`.
- Replaces `expo-notifications` calls: `setNotificationHandler` (foreground display is automatic via `displayNotification`; there is no handler), `scheduleNotificationAsync` -> `createTriggerNotification`, `addNotificationResponseReceivedListener` -> `onForegroundEvent` PRESS.

**react-native-iap 17** (https://openiap.dev/docs/setup/react-native, API pages on the same site; typings in `node_modules/react-native-iap/src/types.ts`). **Ported in phase B3** (`src/services/purchases/**`).
- Root API (identical names/shapes to expo-iap 6, so `StoreBilling.ts` logic is unchanged): `initConnection()`, `endConnection()`, `fetchProducts({ skus, type: 'subs' | 'in-app' })`, `requestPurchase({ type, request: { apple: { sku }, google: { skus, subscriptionOffers: [{ sku, offerToken }] } } })`, `purchaseUpdatedListener(cb)`, `purchaseErrorListener(cb)`, `subscriptionBillingIssueListener(cb)` (each returns `.remove()`), `finishTransaction({ purchase, isConsumable: false })`, `getAvailablePurchases({ onlyIncludeActiveItemsIOS, includeSuspendedAndroid })`, `restorePurchases()`, `isEligibleForIntroOfferIOS(groupId)`, `ErrorCode.*` (kebab-case strings such as `user-cancelled`, `already-owned`, `service-disconnected`).
- Differences that matter: (1) validation in 17.x is strict: Android `subs` requests reject `offerToken` and `in-app` requests reject `subscriptionOffers` (`developer-error`); each offer needs non-empty `sku` + `offerToken`. (2) `endConnection()` resets listener state and `initConnection()` re-attaches JS listeners that are still registered; on iOS `.remove()` only drops the JS callback (native listener stays for the session). (3) `restorePurchases()` runs `AppStore.sync()` on iOS then re-queries. (4) A debug-only first-purchase console notice is printed by the library (silent in release). (5) Product/offer data: `subscriptionOffers[]` (`offerTokenAndroid`, `pricingPhasesAndroid`, `basePlanIdAndroid`, `paymentMode`, `period`) on both platforms, plus legacy `introductoryPrice*IOS`, `subscriptionGroupIdIOS`. No config plugin: Nitro + autolinking.
- Web: `StorePurchasesService.web.ts` (mock subclass) keeps the library out of the web bundle; `index.ts` uses `Platform.OS === 'web'` or `Config.USE_MOCK_PURCHASES === '1'`.
- iOS needs a real device/TestFlight sandbox; Android needs an Internal-testing build installed from Play.

**react-native-change-icon** (https://github.com/skb1129/react-native-change-icon) **Ported in phase B3** (`src/lib/appIcon.ts`).
`import { changeIcon, getIcon, resetIcon } from 'react-native-change-icon'` (JS wrapper over `NativeModules.ChangeIcon`, old-architecture module through the interop layer). Names are PascalCase: `'Ocean' | 'Dusk' | 'Sunrise'`; `'Default'` (or `resetIcon()`) restores teal; `getIcon()` resolves `'Default'` or the name. `appIcon.ts` maps teal to `'Default'`, treats `ICON_ALREADY_USED` rejections as success, `IOS:NOT_SUPPORTED` / missing native module as `unsupportedBuild`, web as `unsupportedWeb`. On Android the activity is finished to swap aliases (the app closes and the launcher shows the new icon); on iOS the system shows a confirmation. Native side verified against the library docs and source: aliases `.MainActivity<Name>` (class `<applicationId>.MainActivity<Name>`, applicationId == namespace == `com.fastline.app`), only `MainActivityDefault` `enabled="true"`, every alias `exported` with MAIN/LAUNCHER and `targetActivity=".MainActivity"`, `MainActivity` has no LAUNCHER filter; iOS `CFBundleIcons` + `CFBundleIcons~ipad` > `CFBundleAlternateIcons` keys Ocean/Dusk/Sunrise with `CFBundleIconFiles` = appiconset names and `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES`. Changes vs expo-alternate-app-icons: names are strings from `getIcon()` (promise, not sync), default is `'Default'` not `null`, no `supportsAlternateIcons` flag. Known library limitation: Android `getIcon()` derives the icon from the running activity's component, so after a cold start through a deep link/notification (component is `MainActivity`, not an alias) it reports `Default`.

**Haptics** (https://github.com/mkuczera/react-native-haptic-feedback)
`import { trigger } from 'react-native-haptic-feedback'; trigger('impactLight' | 'impactMedium' | 'notificationSuccess' | 'notificationWarning' | 'selection', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false })`. Synchronous, no await. Map expo-haptics: `Light/Medium/Heavy` -> `impactLight/Medium/Heavy`, `notificationAsync(Success)` -> `notificationSuccess`, `selectionAsync` -> `selection`.

**Localize** (https://github.com/zoontek/react-native-localize)
`import { getLocales, uses24HourClock, getTimeZone, getCalendar } from 'react-native-localize'`. `getLocales()` returns `[{ languageCode, languageTag, countryCode, isRTL }]` ordered by preference, filtered to the locales declared natively (en, ar, de, es, hi, pt-BR). Add a listener with `RNLocalize.addEventListener` only if the app must react to system changes (module exports `useLocalize` for a hook).

**Files and sharing** (https://github.com/RonRadtke/react-native-blob-util, https://react-native-share.github.io/react-native-share/)
`import ReactNativeBlobUtil from 'react-native-blob-util'`: `const path = ReactNativeBlobUtil.fs.dirs.CacheDir + '/fastline-export.csv'; await ReactNativeBlobUtil.fs.writeFile(path, csvString, 'utf8')`. Share: `import Share from 'react-native-share'; await Share.open({ url: 'file://' + path, type: 'text/csv', filename: 'fastline-export', failOnCancel: false })`. Images from view-shot: pass a `file://` URI or `data:image/png;base64,...`. The share sheet needs no storage permission; a `Share.open` rejection with "User did not share" means cancel (`failOnCancel: false` avoids it). Android file URIs go through the library's `RNShareFileProvider` (already merged).

**Splash**: no library. `hideSplash()` from `src/platform/splash.ts` resolves immediately (system splash dismisses on first frame). The app's own hydration gate renders `null` on the same background colour, so there is no visible flash.

**Device info** (https://github.com/react-native-device-info/react-native-device-info)
`import DeviceInfo from 'react-native-device-info'`: `DeviceInfo.getVersion()` ("1.0.0"), `getBuildNumber()`, `getReadableVersion()`, `getModel()`, `getSystemVersion()`, `isEmulator()` (async). Synchronous getters exist for version/build. Web: `react-native-web` has no native module; shim or branch on `Platform.OS === 'web'`.

**Config** (https://github.com/lugg/react-native-config)
`import Config from 'react-native-config'; Config.PRIVACY_URL`, `TERMS_URL`, `SUPPORT_EMAIL`, `USE_MOCK_PURCHASES` (string `'1'`), `PAYWALL_MODE` (`'hard'` | undefined). Values are strings or undefined. Rename `process.env.EXPO_PUBLIC_X` -> `Config.X` in `src/lib/links.ts`, `defaultSettings.ts`, `entitlement.ts`, `services/purchases/index.ts`. **Web (Vite):** there is no native module: map the same names from `import.meta.env.VITE_*` (or `define`) behind a small `src/lib/config.ts` that exports `Config` and chooses by `Platform.OS`; `scripts/checks` run under tsx/Node, so the shim must also fall back to `process.env.X`.

**Status bar / linking**: `StatusBar` from `react-native` (`barStyle="light-content" | "dark-content"`, `backgroundColor` on Android; edge-to-edge is on, so draw behind it). `Linking.openURL`, `Linking.openSettings()`, `Linking.getInitialURL()`.

**Vector icons**: `import Ionicons from '@react-native-vector-icons/ionicons/static'` (default export; also `{ Ionicons }` named in some versions: check `node_modules/@react-native-vector-icons/ionicons/src/static.ts`). `Ionicons.glyphMap` / `React.ComponentProps<typeof Ionicons>['name']` type the names.

## (c) Target architecture

Replace the Expo Router file tree in `src/app/**` with React Navigation 7 (static or dynamic config; dynamic shown):

```
index.js -> AppRegistry.registerComponent('Fastline', () => App)   // src/App.tsx
App
  GestureHandlerRootView(flex 1, bg colors.bg)
    SafeAreaProvider
      StatusBar (light-content when scheme==='dark')
      NavigationContainer(linking, theme from useTheme(), onReady)
        RootStack = createNativeStackNavigator, headerShown:false, contentStyle bg
          "Tabs"        -> BottomTabs: Timer ("index"), History, Stats, Settings  (icons timer, calendar, stats-chart, settings; outline/filled when focused;
                                         tabBarAllowFontScaling:false, label 12/16 semi-bold; wrap bar in View role=navigation aria-label=t('tabs.a11yLabel'))
          "Onboarding"  -> nested native-stack, animation slide_from_right, gestureEnabled:false:
                           welcome, experience, goal, protocol, schedule, reminders, safety, plan-summary
          "Paywall"     -> presentation 'modal', gestureEnabled:false, params { trigger }
          modals (presentation 'modal'): ProtocolPicker, FastEditor, FastSummary, LogWeight, LogWater, StageInfo, ShareCard
```

Behaviour to carry over from `src/app/_layout.tsx` (read it in git history: `git show main:src/app/_layout.tsx`): hydration gate (`useHydrated`, render null until stores hydrate, then render), `setLanguage` during render + `I18nManager.forceRTL` for `ar`, web-only `<html lang/dir>` and focus-ring/Space-key effects, purchases init/refresh on active, notification init/reschedule subscriptions, `everPro` tracking, onboarding routing (not done -> Onboarding, or Paywall in hard mode when `planReady`; done and inside onboarding -> Tabs), launch paywall (hard mode, or expired). Replace `router.replace/push` with `navigation.reset/navigate` (use a `navigationRef` for code outside components); `useLocalSearchParams` -> `route.params`; the `timer.tsx` alias is no longer needed (map the `timer` deep link to the Timer tab).

Deep links (`linking` prop; prefixes `['fastline://']`; Android intent-filter and iOS `CFBundleURLTypes` are done):

```
fastline://timer                      -> Tabs > Timer
fastline://paywall                    -> Paywall            (optionally ?trigger=)
fastline://history?date=YYYY-MM-DD   -> Tabs > History, params { date }  (History selects that calendar day)
```

Web: `linking` also needs `getInitialURL`/`window` history integration; use prefixes `[window.location.origin]` there. Web entry is Vite: `index.html` + `src/index.web.tsx` calling `AppRegistry.registerComponent('Fastline', () => App); AppRegistry.runApplication('Fastline', { rootTag })`, alias `react-native` -> `react-native-web`, `react-native-linear-gradient` and `react-native-vector-icons` shims; reanimated/worklets via `react-native-worklets/plugin` in the Babel options of the Vite React plugin (plugin-react 6 needs `@rolldown/plugin-babel` for Babel transforms; install it when finalising the web config).

### (c) Implemented (Phase B1, navigation)

- `src/App.tsx`: all of the old `src/app/_layout.tsx` logic (hydration gate, language/RTL, web `<html lang/dir>`/focus ring/Space key in `src/navigation/webEffects.ts`, purchases + notification subscriptions, everPro, onboarding redirects, hard/expired launch paywall, StatusBar, `hideSplash` from `src/platform/splash`). The `useSegments` guard is the focused root-stack route name (`Tabs|Onboarding|Paywall|...`) kept in state via `onReady`/`onStateChange`.
- `src/navigation/`: `RootNavigator` (Tabs, Onboarding, Paywall, 7 modals), `TabsNavigator` (old styling, landmark-wrapped `BottomTabBar`, web height 68), `OnboardingNavigator`, `linking.ts`, `hrefs.ts` (pure parser + path map, checked by `scripts/checks/navigation.check.ts`), `navigationRef.ts`, `types.ts`.
- `src/router`: compatibility layer (`router`, `useRouter`, `useLocalSearchParams`, `useFocusEffect`, `Redirect`, `Href`, `flushPendingNavigation`). Old hrefs (`/`, `/(onboarding)/goal`, `{pathname, params}`, `?query`) map to named routes; `replace` of a tab pops to the existing `Tabs` route (closing modals) or resets the root stack; `replace` of an onboarding screen from outside onboarding resets the root; calls before the container is ready are queued.
- Route map (web URL = path): `/` and `/timer` Tabs>Timer; `/history` `/stats` `/settings` Tabs; `/welcome /goal /experience /schedule /safety /protocol /reminders /plan-summary` Onboarding>*; `/paywall /protocol-picker /fast-editor /fast-summary /log-weight /log-water /stage-info /share-card` root modals. Query params become route params. Deep links: `fastline://timer`, `fastline://paywall`, `fastline://history?date=YYYY-MM-DD`.
- The old `_layout.tsx` files and `src/app/timer.tsx` are reduced to `export {}` stubs (deletion was blocked in this session): delete them.
- Unverified (needs a device/browser): native-stack modal behaviour/gestures on both platforms, tab-state `popTo` with nested `screen` params, web history/URL sync and `documentTitle` disabled, cold-start deep links, iOS.

## (d) Verified vs unverified

Verified on this Windows machine (see the final report for the exact build result):
- `npm install` succeeds without `--legacy-peer-deps`; `npm ls` shows no direct `expo*` dependency.
- `npx react-native config` autolinks all 22 native libraries on both platforms.
- `node scripts/make-assets.js` produces all Android mipmap/adaptive/monochrome/round/notification/splash-dark assets and iOS icon sets; spot-checked visually.
- `npm run license-audit` passes with the exceptions listed above.
- JDK 17 + Android SDK build of `assembleDebug` (see report).

Unverified: anything iOS (Podfile, `pod install`, Info.plist merges, alternate-icon plist vs asset-catalog generation, LaunchScreen storyboard, StoreKit capability); runtime behaviour of notifee triggers and react-native-change-icon on RN 0.88 (both old-architecture libraries); Play Billing and StoreKit flows; release signing; Ionicons rendering on web; release-build bundling of `src/` (needs phases B to D).


## (e) Web target (react-native-web + Vite 8) - Phase B4

Purpose: Playwright / axe testing and optional static hosting. Native builds never touch these files.

- Commands: `npm run web` (dev server, http://localhost:8081, host exposed, strict port), `npm run web:build` (output `dist-web/`, git-ignored), `npm run web:preview` (serves the build on 8081). `tsc -p tsconfig.web.json` type-checks `src/`, `web/` and the Vite config with DOM libs.
- Files: `vite.config.mts` (root = `web/`), `web/index.html`, `web/main.tsx` (imports `src/App`, `AppRegistry.registerComponent/runApplication`, calls `ensureIconFont()` from `src/platform/icons.web.tsx` if that file exists), `web/reset.css` (full-height `#root`), `web/public/favicon.png`, `web/stubs/**`.
- Config: `resolve.extensions` puts `.web.tsx/.web.ts/.web.js` first; `react-native` is aliased to `web/stubs/react-native.ts` (`export * from 'react-native-web'` plus `TurboModuleRegistry`/codegen no-ops that react-native-svg imports); `@react-native/assets-registry/registry` is aliased to react-native-web's AssetRegistry; `__DEV__`, `process.env.NODE_ENV`, `global` are `define`d; `.js` files are parsed as JSX (react-native-calendars ships JSX in .js) in both build and dependency optimisation.
- Reanimated 4: `@rolldown/plugin-babel` runs `react-native-worklets/plugin` on `src/**` and `web/**` only (plugin-react 6 no longer runs Babel), followed by `@vitejs/plugin-react`. Library code is pre-compiled, so node_modules is excluded.
- Safety-net aliases (`web/stubs/*`, used only if a native-only package is imported on web instead of a `src/platform/*.web.ts` sibling): notifee, react-native-iap, nitro-modules, change-icon, share, blob-util, haptic-feedback, device-info, config (reads `VITE_*`), localize, linear-gradient (CSS gradient View), `@react-native-vector-icons/ionicons[/static]` (empty glyph box), `@react-native-community/datetimepicker` (Flow source cannot be parsed by rolldown; renders null, so web screens must use native `<input type=date|time>`).
- Verified with a temporary entry importing every runtime dependency (reanimated, gesture-handler incl. ReanimatedSwipeable, safe-area, svg, gifted-charts, calendars, flash-list, async-storage, view-shot, zustand, i18n-js, date-fns, react-navigation, all stubs): production build succeeds and the dev server renders a reanimated component with no console errors.
- Gaps: `react-native-view-shot` on web needs the optional peer `html2canvas-pro` (MIT) if the share card must be captured on web (the build currently emits an empty optional-peer chunk). The bundle is a single ~1.8 MB chunk (542 kB gzip), acceptable for testing. Provide `VITE_PRIVACY_URL`, `VITE_TERMS_URL`, `VITE_SUPPORT_EMAIL`, `VITE_USE_MOCK_PURCHASES`, `VITE_PAYWALL_MODE` in `.env` files for web (read by the config stub or `src/lib/config`).

## (e) Phase B2: platform libraries (src/platform/**)

| Module | Native | Web (`.web.*`) | Notes |
|---|---|---|---|
| `config` | `react-native-config`; falls back to `process.env` (tsx checks stub the native module with `{}`) | `window.__FASTLINE_CONFIG__`, `import.meta.env.VITE_<KEY>`, `process.env` | `Config.PRIVACY_URL/TERMS_URL/SUPPORT_EMAIL/USE_MOCK_PURCHASES/PAYWALL_MODE`, or `getConfig(key)`; read lazily. `links.ts`, `defaultSettings.ts`, `entitlement.ts`, checks migrated. `services/purchases/index.ts` is B3's. |
| `haptics` | `react-native-haptic-feedback`; `haptic()` in `components/ui.tsx` still gates on `settings.haptics` | `navigator.vibrate` after first user activation | |
| `locale` | `react-native-localize` `getLocales()` | `navigator.languages` | used by `lib/i18n.ts` |
| `icons` | Ionicons from `@react-native-vector-icons/ionicons/static`; `IconName` type | glyphmap JSON + TTF `@font-face`; exports `iconFontCss`, `ensureIconFont()` (also self-called on first render) | `keyof typeof Ionicons.glyphMap` replaced by `IconName`. |
| `LinearGradient` | `react-native-linear-gradient` (accepts readonly `colors`) | CSS `linear-gradient`, angle from `start`/`end` and measured box | used by `ShareCard`. |
| `shareImage` | `react-native-share` (`file://` PNG from view-shot) | unavailable | `share-card.tsx` |
| `deviceInfo` | `react-native-device-info` `getVersion()` | `package.json` version | settings About |
| `splash` | no-op | no-op | |
| `lib/exportData` | blob-util writes CSV (BOM) to cache dir, then `Share.open` (`failOnCancel:false`; FileProvider `cache-path` is already in react-native-share's manifest) | Blob download | pure part moved to `lib/exportBuild.ts` |
| `services/notifications` | notifee: channels `fasting` (HIGH) / `tips` (DEFAULT), `TriggerType.TIMESTAMP` with `AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE`, small icon `ic_stat_notification`, cap 50 (Android) / 64 (iOS), past timestamps dropped | stub: status `unavailable` | Same exported API. Android has no "undetermined" state, so a flag in AsyncStorage (`fastline.notifications.asked`) maps never-asked to `undetermined`. After a granted request on Android 12+, if `android.alarm` is DISABLED the exact-alarm settings screen is opened (`openAlarmPermissionSettings`). Taps: `services/notificationEvents.ts` (`router.navigate('/')` behind `openTimer()`), foreground via `onForegroundEvent`, cold start via `getInitialNotification`, background via `notifee.onBackgroundEvent` at top level of `index.js`. |

Web builds need `*.ttf` typing (`src/platform/assets.d.ts`) and DOM lib typings (`tsconfig.json` has no `dom` lib, so `*.web.*` files and some existing web-only code report TS2584 under `tsc`; run `npx tsc --noEmit --lib esnext,dom` or add `"lib": ["esnext", "dom"]`).

Unverified in B2: notifee behaviour on a device (trigger delivery, exact-alarm fallback when the special access is off, tap handling from killed state), iOS splash storyboard and asset catalog, share sheet and blob-util on device, web icon font and CSS gradient rendering, localize on RTL (ar).

## (f) Build verification (Phase C1, Windows 11, JDK 17, Android SDK 37, NDK 27.1.12297006, Gradle 9.4.1, AGP 9.2.1)

Environment per shell: `JAVA_HOME=E:\dev-tools\jdk-17`, `ANDROID_HOME=ANDROID_SDK_ROOT=E:\dev-toolsndroid-sdk`, JDK and `platform-tools` on `PATH`. Run Gradle as `.\gradlew.bat` from `android\`.

| Variant | Command | Result | Duration | Size |
|---|---|---|---|---|
| Debug (arm64-v8a) | `.\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a` | OK, no source or config fixes needed | 14m 01s (cold, 316 tasks executed) | APK 86.2 MB (debug .so files are unstripped; no JS bundle, loads from Metro) |
| Release APK + AAB (arm64-v8a, R8 off) | `.\gradlew.bat assembleRelease bundleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2` | OK | 10m 28s (second attempt) | APK 44.8 MB (22.9 MB download size), AAB 31.6 MB |
| Release, R8 on | `... assembleRelease -PFASTLINE_MINIFY=true -PreactNativeArchitectures=arm64-v8a --max-workers=2` | OK: R8 + keep rules compile with no missing-class errors (build-verified only, never run on a device) | 4m 47s (native libs cached) | APK 34.6 MiB |
| Release, all four ABIs | not run | | | |

Outputs: `android/app/build/outputs/apk/{debug,release}/`, `bundle/release/app-release.aab`.

**Windows clang crash (resolved by retrying with fewer workers).** The first release attempt failed after 21m 39s in `:app:buildCMakeRelWithDebInfo[arm64-v8a]`: NDK 27 `clang++` (18.0.2) died with `Exception Code: 0xC0000005` ("clang frontend command failed due to signal", "parser at end of file") on at least two translation units (a `react_codegen_rnviewshot` file and another app-module file), while other heavy processes (Vite, Playwright) were running. The identical command with `--max-workers=2` succeeded, so it was a resource/transient crash, not a source problem. Recommendation on Windows: use `--max-workers=2` for release builds, close other heavy processes, and keep the project path short (CMake also warns that the object-file path of `react-native-iap` Nitro sources is long, 129 of 250 characters of the allowed object directory; a checkout such as `C:\srcastline` avoids it). `org.gradle.jvmargs` was raised to `-Xmx4g` in `android/gradle.properties`.

**Checks of the artifacts**
- Debug APK (`aapt2 dump badging`, `apkanalyzer`): package `com.fastline.app`, versionName 1.0.0 (from `package.json`), versionCode 1 (`FASTLINE_VERSION_CODE`), minSdk 24, targetSdk 36, compileSdk 37; permissions INTERNET, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, VIBRATE, FOREGROUND_SERVICE, ACCESS_NETWORK_STATE, `com.android.vending.BILLING` (+ debug-only SYSTEM_ALERT_WINDOW, ACCESS_LOCAL_NETWORK); the storage permissions of blob-util and `ACCESS_NOTIFICATION_POLICY` are stripped. Launcher: `MainActivityDefault` (enabled) plus disabled aliases `MainActivityOcean/Dusk/Sunrise`; `fastline://` intent filter on `MainActivity`. Contains `assets/fonts/Ionicons.ttf`, `res/drawable[-night]-*/splash_icon.png`, `res/drawable-*/ic_stat_notification.png`. No `expo` classes (dex package list) or strings.
- Release APK: same manifest minus the debug-only permissions; `assets/index.android.bundle` (5.0 MB) starts with the Hermes bytecode magic `c61fbc03c103191f`, i.e. precompiled Hermes bytecode embedded. The only `expo-` text in it is dead code inside `@react-native-vector-icons` (dynamic font loader) and `react-native-device-info` (`ExponentConstants` probe); no Expo package is installed or linked.
- Signing: release was signed with the **debug certificate** (CN=Android Debug, confirmed by `apksigner verify --print-certs`) because `FASTLINE_UPLOAD_*` were unset, and Gradle printed the boxed warning. Such a build cannot be uploaded to Play.
- 16 KB page size: `zipalign -P 16 -c -v 4 app-release.apk` reports `Verification successful` (0 BAD entries), and every `lib/arm64-v8a/*.so` (21 libraries) has `p_align` of 0x4000 in all PT_LOAD segments (read from the ELF program headers). Meets the Play requirement for targetSdk 35+ on the arm64 build; the other three ABIs were not built (the same toolchain and NDK r27 apply; 32-bit ABIs are exempt).
- R8/minify: off by default (`enableProguardInReleaseBuilds`), toggled with `-PFASTLINE_MINIFY=true` / env; keep rules for react-native-config `BuildConfig`, reanimated/worklets, Nitro/iap, notifee, change-icon are in `android/app/proguard-rules.pro`. A minified build can only be build-verified here; run purchases, notifications, the timer and icon switching on a device before shipping one.

**Static checks.** `npx tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean (fix: `@types/node` ^22, MIT, added as a devDependency and to `types` in `tsconfig.web.json`, for the `process.env` fallbacks in `src/platform/config*.ts`); `npm run check` 233 passed; `node scripts/license-audit.mjs` OK; `npx eslint .` after the `.eslintrc.js` rewrite (inline-style, `no-void`, `no-bitwise` off; node env for `scripts/`; `.mjs`/`.mts` parsing): 0 config errors, remaining errors are unused imports and one `exhaustive-deps` in `src/`. JS bundles: `react-native bundle` for android (65 s, 4.4 MB) and ios (4.4 MB) both succeed with zero "Unable to resolve". CI workflow `.github/workflows/ci.yml` (job `check`: tsc x2, eslint, checks, license audit, web build; job `android`: assembleDebug on ubuntu with Temurin 17, setup-android, Gradle cache) is YAML-validated but **untested on GitHub**.

**iOS (static only, no Mac).** `Info.plist`/`PrivacyInfo.xcprivacy` parse with plistlib; `LaunchScreen.storyboard` is well-formed XML; all 7 `Contents.json` valid and every referenced image exists with the pixel size implied by `size x scale`; deployment target 15.1 in all four build configurations (matches RN 0.88 `min_ios_version_supported` and the iap pod's 15.0); bundle id `com.fastline.app`; URL scheme `fastline`; no usage-description strings needed (local notifications only; no `UIBackgroundModes`); `UIAppFonts` lists `Ionicons.ttf`; `Podfile` read by eye (no ruby). **Unverified:** `bundle install`, `pod install` (Nitro/iap Swift 6 and Folly workarounds if they appear), any `xcodebuild` build or archive, the In-App Purchase capability (StoreKit), alternate icons plist vs `ASSETCATALOG_COMPILER_*` keys, launch storyboard rendering, Ionicons font registration, signing. Commands for a Mac: `bundle install && cd ios && bundle exec pod install`, then `xcodebuild -workspace ios/Fastline.xcworkspace -scheme Fastline -configuration Debug -destination 'generic/platform=iOS Simulator' build`, then Release archive as in the README.

**Not verified at all:** running any build on a device or emulator (none installed): app launch, Hermes startup, notifee triggers, Play Billing, change-icon, deep links, R8-minified behaviour, the x86/armeabi-v7a/x86_64 ABIs, release signing with a real upload key, the GitHub Actions workflow.
