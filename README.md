# Fastline

Intermittent fasting timer and tracker. bare React Native 0.88 CLI (new architecture, Hermes), TypeScript (strict), React Navigation 7, plus a react-native-web + Vite web target for testing. Fully offline: no account, no backend. Data stays on the device.

> Closed-source commercial app (iOS and Android). This repo holds the app source plus the public [privacy policy](POLICY.md) and [terms of use](TERMS.md), published with GitHub Pages. Repo and Pages setup: [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md).
<!-- Badges: add the CI badge after the first push: ![CI](https://github.com/jpdash-creator/fasting-timer-app/actions/workflows/ci.yml/badge.svg) -->

## Setup

Requirements: Node >= 22.11, JDK 17, Android SDK (platform 37, build-tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1; Android Studio installs these) with `ANDROID_HOME` set. iOS builds need a Mac with Xcode 16.1+, CocoaPods (`bundle install` uses the `Gemfile`) and Ruby.

```bash
npm install
npm start                       # Metro bundler (react-native start)
npm run android                 # build + install the debug app on a connected device / emulator (react-native run-android)
npm run ios                     # macOS only: pod install first (see below), then react-native run-ios
npm run web                     # react-native-web + Vite dev server on http://localhost:8081
npm run web:build               # production web build into dist-web/
npm run typecheck               # tsc --noEmit (also run: npx tsc -p tsconfig.web.json)
npm run lint                    # eslint .
npm run check                   # pure-logic checks (see Automated checks)
```

### Running on a device (adb)

1. Enable Developer options and USB debugging on the phone, connect it, and confirm `adb devices` lists it as `device` (`adb` lives in `$ANDROID_HOME/platform-tools`).
2. `npm start` in one terminal, `npm run android` in another. The debug build loads JS from Metro. For a physical device over USB run `adb reverse tcp:8081 tcp:8081` once so the app can reach Metro; otherwise set the dev server host in the in-app dev menu.
3. Single architecture for faster native builds: `cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (Windows: `.\gradlew.bat ...`), then `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

### iOS (needs a Mac)

```bash
bundle install                  # first time: installs CocoaPods from the Gemfile
cd ios && bundle exec pod install && cd ..
npm run ios                     # or open ios/Fastline.xcworkspace in Xcode and press Run
```

Always open the `.xcworkspace`, never the `.xcodeproj`. iOS has not been built on the machine this migration was done on; see `docs/MIGRATION.md` (Build verification) for the exact list of unverified items.

### Environment files (react-native-config)

`.env.development` is bundled into debug builds and `.env.production` into release builds (Android: `envConfigFiles` in `android/app/build.gradle`; iOS: `ENVFILE` set per configuration in the `Podfile`). Keys: `PRIVACY_URL`, `TERMS_URL`, `SUPPORT_EMAIL`, `USE_MOCK_PURCHASES`, `PAYWALL_MODE`. They are read in code through `src/platform/config` (`Config.PRIVACY_URL` etc.; web reads `VITE_*` instead). Values are compiled into the app: never put secrets in them. Override the file for one build with `ENVFILE=.env.staging npm run android`. After changing an env file, rebuild the native app (a Metro reload is not enough); on Android also run `cd android && ./gradlew clean` if the value does not change.

## Mock purchases (no store needed)

Store billing needs native code and a Play/App Store account, so it cannot run on web. The app uses `MockPurchasesService` when running on web or when `USE_MOCK_PURCHASES=1` in the active `.env.*` file.

- The paywall shows fake packages and "purchasing" unlocks Pro locally.
- In Settings, long-press the version row to toggle mock Pro (only in mock/dev builds).
- Notifications and haptics need a real native build (device or emulator); on web they are stubs.

## Release builds and store submission (no EAS)

There is no cloud build service. Builds are made locally with Gradle (Android) and Xcode (iOS).

### Android: upload key (once)

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore fastline-upload.keystore   -alias fastline-upload -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore outside the repo (a password manager or encrypted backup; `*.keystore` is git-ignored) and back it up. Put the values in `~/.gradle/gradle.properties` (not the project file) or in environment variables:

```properties
FASTLINE_UPLOAD_STORE_FILE=C:/keys/fastline-upload.keystore
FASTLINE_UPLOAD_STORE_PASSWORD=...
FASTLINE_UPLOAD_KEY_ALIAS=fastline-upload
FASTLINE_UPLOAD_KEY_PASSWORD=...
FASTLINE_VERSION_CODE=2
```

Use **Play App Signing** (default for new apps): the key above is only the *upload* key, Google holds the app-signing key, and a lost upload key can be reset through Play support. `versionName` is taken from `package.json` (`version`); `versionCode` from `FASTLINE_VERSION_CODE` (default 1) and must increase with every upload. Without the `FASTLINE_UPLOAD_*` values the release is signed with the public debug keystore and Gradle prints a boxed warning: fine for local smoke tests, rejected by Play.

```bash
npm run android:release     # APK  -> android/app/build/outputs/apk/release/app-release.apk
npm run android:bundle      # AAB  -> android/app/build/outputs/bundle/release/app-release.aab
```

On Windows add `--max-workers=2` when running Gradle directly (`cd android && .\gradlew.bat assembleRelease bundleRelease --max-workers=2`); with default parallelism the NDK clang crashed once with 0xC0000005 during the native release build. Keep the checkout path short and close other heavy processes. A release build for arm64 only: `-PreactNativeArchitectures=arm64-v8a`.

Both embed the Hermes-compiled JS bundle and read `.env.production`. R8/ProGuard is off unless you pass `-PFASTLINE_MINIFY=true` (see the comment in `android/app/build.gradle`; smoke-test purchases and notifications on a device before shipping a minified build).

### Play Console (manual upload)

1. Create the app, then **Testing > Internal testing > Create new release** and upload `app-release.aab`. First upload: accept Play App Signing.
2. Add testers (license testers for billing), roll out, and install via the opt-in link.
3. When the internal build is verified, promote it to Closed/Production. Complete the store listing, Data safety and content rating forms (`docs/store-listing.md`).

### iOS (Mac only)

1. `bundle exec pod install` in `ios/`, open `ios/Fastline.xcworkspace`.
2. Signing & Capabilities: choose your team, add **In-App Purchase** (and Push Notifications only if you later add remote push; local notifications need nothing).
3. Set the scheme to Release, destination "Any iOS Device (arm64)", then **Product > Archive**. In the Organizer choose **Distribute App > App Store Connect > Upload**; then add the build to TestFlight / the App Store version in App Store Connect.
4. Update `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode for each upload (they are not derived from `package.json`).

CLI alternative: `xcodebuild -workspace ios/Fastline.xcworkspace -scheme Fastline -configuration Release -archivePath build/Fastline.xcarchive archive` then `xcodebuild -exportArchive ...` with an `ExportOptions.plist`.

## Billing architecture

Purchases go **directly to the App Store and Google Play** through [`react-native-iap`](https://github.com/hyochan/react-native-iap) 17 (OpenIAP on Nitro modules: StoreKit 2 / Play Billing 9). There is no backend and no third-party billing service. `src/services/purchases/StoreBilling.ts` holds all the logic (the platform and the `react-native-iap` module are injected, so it is unit-checked in Node against mocked `react-native-iap` 17 shapes); `StorePurchasesService.ts` is the thin wiring class that implements `PurchasesService` and loads the library with a dynamic `import('react-native-iap')` (web resolves `StorePurchasesService.web.ts`, a mock subclass, so the native module never enters the web bundle). Screens never touch `react-native-iap`. Mock vs real is chosen in `src/services/purchases/index.ts`: web or `USE_MOCK_PURCHASES=1` in `.env.*` (read through `src/platform/config`) means `MockPurchasesService`.

API surface used (`initConnection`, `endConnection`, `fetchProducts({ skus, type })`, `requestPurchase({ type, request: { apple: { sku }, google: { skus, subscriptionOffers } } })`, `finishTransaction({ purchase, isConsumable })`, `getAvailablePurchases`, `restorePurchases`, `isEligibleForIntroOfferIOS`, the three listeners, `ErrorCode` strings). Native setup is Nitro modules + autolinking (no config plugin). Rules of the 17.x API that the code relies on: the Android request for a subscription must carry `subscriptionOffers` (never `offerToken`, which is for one-time products only) and the lifetime in-app request must not carry `subscriptionOffers`; on Android `finishTransaction` needs `purchase.purchaseToken`, on iOS `purchase.id`.

| Plan | Product id | Type | Price (USD base) |
|---|---|---|---|
| Annual | `fw_pro_annual` | auto-renewable subscription, 3-day free trial | 39.99 / year |
| Monthly | `fw_pro_monthly` | auto-renewable subscription | 9.99 / month |
| Weekly | `fw_pro_weekly` | auto-renewable subscription | 4.99 / week |
| Lifetime | `fw_pro_lifetime` | non-consumable (iOS) / one-time product (Android) | 79.99 once |

**Android ids.** Each subscription is its own Play subscription whose id equals the product id above, with one base plan each:

| Subscription id | Base plan id | Offer |
|---|---|---|
| `fw_pro_annual` | `annual` | `trial` (free trial, 3 days) |
| `fw_pro_monthly` | `monthly` | none |
| `fw_pro_weekly` | `weekly` | none |
| `fw_pro_lifetime` (in-app product) | n/a | n/a |

The app does not hard-code base plan or offer ids. For annual it picks the offer that has a free-trial pricing phase (and falls back to the plain base plan if the user is not eligible); for the others it picks the plain base-plan offer. The names above are conventions only.

**How entitlement is derived (no server).** On launch, on foreground, after a purchase and on Restore, the app calls `getAvailablePurchases` and computes Pro locally:

- Lifetime: an owned `fw_pro_lifetime` purchase (not revoked).
- iOS subscription: a transaction whose expiration date is in the future and not revoked. If Apple is retrying a failed payment inside the billing grace period, access continues and `billingIssue` is set.
- Android subscription: Play only lists purchases that currently grant access (active, cancelled-but-paid, or in grace period). The client does not see the exact expiry, so the app estimates the end of the current billing cycle from the original purchase date (anchor + k periods with calendar maths that clamps to month end; during the annual plan's first 3 days the estimate is the trial end). Suspended (account hold) purchases do not grant access and set `billingIssue`. Grace-period state is not exposed by the client API, so it shows as an ordinary active subscription until Play suspends it.
- The result is cached in `usePurchaseStore` (persisted). Pro stays on for up to 7 days past the cached expiry when offline. A failed store query never downgrades cached state.
- Every purchase is finished (`finishTransaction`: acknowledge on Android, finish on iOS) **before** Pro is granted. If finishing fails, Pro is not granted (the paywall shows the pending message) and the next refresh retries; a failed acknowledge never downgrades an already-Pro cache. Unacknowledged purchases are refunded by Google after 3 days, so do not remove this.
- Listeners (`purchaseUpdatedListener`, `purchaseErrorListener`, `subscriptionBillingIssueListener`) are registered **before** `initConnection`, because the store replays unfinished transactions as soon as it connects. `endConnection()` removes them. A dropped billing connection (`service-disconnected` and similar) is re-established once and the call retried.
- A successful store query always overwrites the cache, so an expiry or refund removes Pro immediately when online; only a *failed* query keeps the cached state (up to the 7-day offline grace, which `useIsPro` also enforces by re-rendering when the grace lapses).
- The `mockPro` developer flag is ignored in release builds (it only works when `__DEV__` is true or `USE_MOCK_PURCHASES=1`).
- `PAYWALL_MODE` defaults to `soft` and can be forced per build with `PAYWALL_MODE=hard` (in `.env.production`, read through `react-native-config`). It is a build flag, not a persisted user setting.

### Security trade-off (read this)

With no backend, entitlement is verified **on the device from store data only**. A rooted or jailbroken device, or a tampered build, can fake purchase data and unlock Pro. This is acceptable for a small offline app, but it is not fraud-proof. The client also cannot see server-side facts such as the exact Android expiry or refunds issued after the last successful refresh.

Recommended later hardening (needs a small backend, for example a serverless function):

1. Send the iOS transaction JWS or the Android `purchaseToken` to your server after each purchase and on refresh.
2. iOS: validate with the **App Store Server API** (Get Transaction History / Get All Subscription Statuses, signed with an App Store Connect API key) and subscribe to **App Store Server Notifications V2** for renewals, refunds and expirations.
3. Android: validate with the **Google Play Developer API** (`purchases.subscriptionsv2.get`, `purchases.products.get`) using a service account, and subscribe to **Real-time developer notifications** (Pub/Sub) for renewals, holds and refunds.
4. Have the server return the entitlement (with exact expiry) and make `StorePurchasesService` trust that instead of local derivation. An app-account token (`obfuscatedAccountId` on Android, `appAccountToken` on iOS) ties purchases to a user id.

### Assumptions that only real store sandbox accounts can verify

The pure logic is covered by `npm run check` (mocked `react-native-iap` 17 shapes, re-derived from `node_modules/react-native-iap/src/types.ts`). These points depend on what the stores and `react-native-iap@17.1.0` actually return, and **must be confirmed once on a real device** (Sandbox/TestFlight on iOS, Internal testing with a license tester on Android) before release:

1. **iOS free-trial length.** The annual trial length comes from `ProductSubscription.subscriptionOffers[type=introductory, paymentMode=free-trial].period`, falling back to the legacy `introductoryPrice*IOS` fields. Confirm the annual card shows "3-day free trial". If it shows 0 or 1 day, adjust `trialDaysIOS` to what react-native-iap reports (17.x types both `subscriptionOffers` and the legacy fields, so one of them should carry it).
2. **iOS trial eligibility.** `isEligibleForIntroOfferIOS(subscriptionGroupIdIOS)` removes the trial from the card when the Apple ID already used it. Confirm with a sandbox tester that has consumed the trial.
3. **iOS entitlement list.** `getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })` is assumed to return current entitlements (17.x maps it to StoreKit 2 current entitlements), including subscriptions inside the billing grace period (expiry in the past, `renewalInfoIOS.gracePeriodExpirationDate` in the future; whether `renewalInfoIOS` is populated on this call is unverified) and to omit refunded ones. Confirm after a sandbox expiry and a refund (sandbox renewals take a few minutes).
4. **Android offer selection.** The annual trial offer is found by its free-trial pricing phase, the plain base plan by "single phase, no offer id (or id equal to the base plan id)". Confirm what `SubscriptionOffer.id` is for the base-plan offer in 17.x (null or equal to the base plan id; both are handled) and that the right `offerToken` is sent, in `requestPurchase({ type: 'subs', request: { google: { skus, subscriptionOffers: [{ sku, offerToken }] } } })`, for a trial-eligible and for a trial-ineligible Google account (the ineligible account should not receive the trial offer in the list).
5. **Android expiry estimate.** Play does not expose the expiry to the client. The estimate assumes `transactionDate` stays the original purchase time across renewals. Confirm `PurchaseAndroid.transactionDate` (Play `purchaseTime`) really is the original purchase time. Confirm Pro stays on through several license-tester renewals (they renew every few minutes) and turns off on the first refresh after the last one. For annual-with-trial the real renewal boundary is 3 days later than the estimate, which the 7-day offline grace and every online refresh absorb.
6. **Android grace period and account hold.** Grace period is not exposed by the client API (it looks like a normal active purchase); account hold appears as `isSuspendedAndroid` only with `includeSuspendedAndroid: true` (needs the Play Billing 8.1+ that 17.x bundles). Confirm the billing banner appears for a suspended test subscription.
7. **`subscriptionBillingIssueListener`.** Per the 17.x docs it fires on iOS 16.4+ (StoreKit `Message.Reason.billingIssue`) and on Android when a suspended subscription is observed; it never fires on older iOS. Assumed to fire when a subscription enters billing retry, grace or hold. The app then sets `billingIssue` and re-queries; the next refresh overwrites the flag from store data, so confirm the banner behaves sensibly on iOS billing retry and Android hold.
8. **Pending and deferred purchases.** Ask to Buy (iOS) is assumed to surface as error code `deferred-payment` or `purchaseState: 'pending'`; slow payment methods on Android as `purchaseState: 'pending'`. Both map to "Payment pending" (on iOS the 17.x docs list `deferred-payment`/`pending`). Confirm the later approval arrives through `purchaseUpdatedListener` and unlocks Pro without reopening the paywall.
9. **Already owned.** Buying a product the account already owns is assumed to raise `already-owned`; the app then restores. Confirm on Android (iOS normally just returns the existing transaction).
10. **Connection loss.** The reconnect-and-retry path keys on the error codes `service-disconnected`, `connection-closed`, `init-connection`, `service-timeout` and `not-prepared`. Confirm by backgrounding the app for a long time on Android and then refreshing. 17.x also reattaches listeners on the next `initConnection` after `endConnection`, which is what the retry path uses.
11. **Restore prompt.** `restorePurchases()` in 17.x runs the StoreKit `AppStore.sync()` on iOS, which can show an Apple ID sign-in prompt; the app ignores a failure of that step and decides from the following `getAvailablePurchases` (a failure of that one is shown as an error). Confirm the prompt/cancel behaviour on a device.
12. **Acknowledge timing.** In Play Console > Order management the purchase should show as **Acknowledged** within seconds of buying. Kill the app between payment and acknowledge once to confirm the next launch acknowledges it.

## Store setup

You need a paid **Apple Developer Program** membership and a **Google Play developer account**. The bundle id / package is `com.fastline.app` on both.

### App Store Connect

1. **Business > Agreements, Tax, and Banking:** accept the **Paid Applications Agreement** and enter banking and tax details. Products cannot be fetched until it is Active.
2. Enrol in the **App Store Small Business Program** (15% commission up to US$1M proceeds).
3. Create the app (bundle id `com.fastline.app`).
4. **Monetization > Subscriptions:** create a subscription group named **Fastline Pro**. Add three auto-renewable subscriptions with product ids `fw_pro_annual` (1 year), `fw_pro_monthly` (1 month) and `fw_pro_weekly` (1 week). Set prices, localized display names and descriptions, and a review screenshot of the paywall.
5. On `fw_pro_annual` add an **Introductory Offer**: free, 3 days, new subscribers.
6. **Monetization > In-App Purchases:** create a **Non-Consumable** with product id `fw_pro_lifetime`, price and localization.
7. Enable the **Billing Grace Period** for subscriptions.
8. Add the Terms of Use (EULA) and Privacy Policy URLs. Subscription disclosures (price, period, auto-renew, cancellation) are shown on the paywall.
9. Set per-storefront prices for lower-income markets (India, Brazil, Turkiye, Indonesia, Mexico, Egypt, Nigeria and similar).
10. **Users and Access > Sandbox > Testers:** create a sandbox tester (a fresh email, not an existing Apple ID). On the test iPhone, sign in under Settings > Developer > Sandbox Apple Account.
11. First-time products must be attached to an app version and submitted together with a build.
12. App Privacy: health and fitness data is not collected; purchase data is handled by Apple.

### Google Play Console

1. Create the app (package `com.fastline.app`), complete the basic app setup and set up a **payments profile**. Enrol in the 15% service fee tier where applicable.
2. Build a signed release `.aab` (`npm run android:bundle`, see Release builds below), **upload it manually in Play Console to the Internal testing track** and roll it out. **Subscriptions and products only become available to the billing API after a build with the billing permission has been uploaded**, and testers must install from the Play opt-in link (not by sideloading) for products to load.
3. **Monetize > Products > Subscriptions:** create three subscriptions with product ids `fw_pro_annual`, `fw_pro_monthly`, `fw_pro_weekly`. In each add one auto-renewing **base plan** (ids `annual`, `monthly`, `weekly`) with prices, and activate it.
4. On `fw_pro_annual`, base plan `annual`, add an **offer** with id `trial`, eligibility "New customer acquisition", and one phase: **Free trial, 3 days**. Activate it.
5. **Monetize > Products > In-app products:** create `fw_pro_lifetime`, price it and activate it.
6. In each subscription's base plan settings enable **Grace period** and **Account hold** (about a third of Play cancellations are billing failures).
7. **Settings > License testing:** add your testers' Gmail accounts as **license testers** (test purchases are free and renew quickly) and add them to the Internal testing list.
8. Complete the Data safety form to mirror the Apple privacy answers and add the "not a medical device" disclaimer in the listing.

## Building and testing real purchases

In-app purchases cannot run on web or with `USE_MOCK_PURCHASES=1`. Use a debug or release build on a **real device**.

```bash
npm run android            # debug build, real billing if .env.development has USE_MOCK_PURCHASES unset/0
npm run ios                # needs a Mac; add the In-App Purchase capability first
npm run android:bundle     # signed release AAB (reads .env.production) to upload to Internal testing
```

Env: `.env.development` / `.env.production` set `USE_MOCK_PURCHASES` (`1` = mock, anything else = real billing); `react-native-iap` needs no config plugin. Native setup (done in the repo): Android gets `com.android.vending.BILLING` and the Play Billing dependency merged from the library (no manual permission line; none of the stripped permissions affect billing). iOS (unverified, no Mac): enable the **In-App Purchase** capability in Xcode (Signing & Capabilities); the products must exist in App Store Connect with the ids above (StoreKit does not need a `Product` list in Info.plist). Play billing only works with a build installed from Play (Internal testing) signed with the upload/app-signing key; a sideloaded debug APK returns no products.

**Test checklist**

1. iOS: sign in with the sandbox Apple account, open the paywall, check prices and the free trial on annual, then buy. Sandbox subscriptions renew every few minutes and stop after a handful of renewals, which lets you verify expiry (Pro turns off after the last renewal and a foreground refresh). Check Settings > Restore after a reinstall.
2. Android: install the build from the Internal testing opt-in link with a license-tester account. Buy annual (trial) and lifetime, then cancel from Play > Subscriptions and confirm Pro stays until the period ends. In Play Console order management, confirm the purchase is **Acknowledged**.
3. Kill and relaunch offline: Pro should persist (7-day offline grace).
4. Cancel the purchase sheet: no error, app stays Free. Slow payment methods on Android: the paywall shows the pending message and Pro unlocks when the payment completes.

Bundle id / package: `com.fastline.app`. URL scheme: `fastline`.

## Project layout

```
src/App.tsx        Root component (providers, hydration gate, navigation container)
src/navigation     React Navigation 7 navigators, linking, typed routes
src/app            Screen components (tabs, onboarding, modals), no longer a router tree
src/platform       Per-platform wrappers (config, haptics, icons, locale, share, splash); *.web.* siblings for the web target
android, ios       Native projects (committed; edit by hand)
web                Vite entry and stubs for the web target
src/components     UI and feature components (settings/, share/)
src/lib            Pure logic (fastMath, protocols, stages, csv, exportData, i18n, proGate)
src/stores         Zustand stores persisted to AsyncStorage
src/services       Purchases (mock + direct store billing via react-native-iap) and notifications
src/locales        i18n bundles, one JSON per namespace per language
assets             Icons and splash (generated by scripts/make-assets.js)
docs               Store listing (policies live in POLICY.md / TERMS.md at the root)
```

## Assets

Icons are generated programmatically (a ring with a gap, representing the eating window, on teal `#2E7D6B`):

```bash
node scripts/make-assets.js
```

This needs `pngjs` (present as a transitive dependency; add it as a devDependency if you want it pinned). Rerun after changing the brand.

### Themes and alternate app icons (Pro)

Settings > Appearance has four accent palettes (Teal free; Ocean, Dusk, Sunrise Pro). Palettes live in `src/lib/themePalettes.ts`; `useTheme()` resolves them (non-Pro always renders Teal, the saved choice is kept). `scripts/checks/theme-contrast.check.ts` asserts WCAG AA for every text and graphic pair in all 4 palettes x light/dark.

Launcher icons use [`react-native-change-icon`](https://github.com/skb1129/react-native-change-icon) 5 (native setup is committed: `activity-alias` entries in `AndroidManifest.xml` and `CFBundleAlternateIcons` in `Info.plist`; `src/lib/appIcon.ts` is the only caller). `node scripts/make-assets.js` writes `assets/icons/<theme>-icon.png` (1024, opaque, used for iOS and the in-app picker) and `<theme>-foreground.png` (Android adaptive foreground). Teal is the default app icon (library name `Default`); Ocean, Dusk and Sunrise are alternates (library names `Ocean`, `Dusk`, `Sunrise`). Android: the launcher entries are the activity-aliases `.MainActivityDefault` (enabled) and `.MainActivityOcean|Dusk|Sunrise` (disabled), each with its own MAIN/LAUNCHER filter; `MainActivity` itself has none. Switching enables the new alias and the app closes and re-opens from the launcher (some launchers take a few seconds to refresh). Android limitation of the library: it reads the current icon from the running activity's alias, so after a cold start through a deep link or notification `getIcon()` reports `Default`.

Icon switching needs a native build; it does nothing on web, where the picker shows a message and the app keeps working. iOS shows a system confirmation when the icon changes. After changing icon colours, rerun `node scripts/make-assets.js`.

## Automated checks

Pure-logic unit checks (timer maths, goal tolerance, day attribution, protocol recommendation, eating window, edit validation, streaks including the weekly freeze and DST/month boundaries, insights, water and weight, the notification plan, auto-start, CSV, entitlement and offline grace, store purchase mapping and flows) live in `scripts/checks/` and run in Node with mocked native modules:

```bash
npm run check                          # all checks (uses npx --yes tsx)
npm run check -- streaks               # one file: timer streaks stats notifications autostart csv entitlement stores purchases
CHECK_TZ=Asia/Kolkata npm run check    # another baseline time zone (default America/New_York)
VERBOSE=1 npm run check                # show the console warnings the mocks provoke
npm run typecheck
```

Pure modules the checks depend on: `src/lib/notificationPlan.ts` (spec section 12 planner), `src/lib/entitlement.ts`, `src/lib/defaultSettings.ts`, `src/lib/stageData.ts`, `src/services/purchases/StoreBilling.ts`.

## Before release

- **Placeholders are filled** in `POLICY.md` and `TERMS.md` (J. P. Dash, jpdash.creator@gmail.com, India / Bengaluru, Karnataka). Have both reviewed by a qualified lawyer.
- **Host the policy with GitHub Pages (required by both stores).** The repo root holds `POLICY.md`, `TERMS.md`, `index.md` and `_config.yml`. Enable Pages: repo Settings -> Pages -> Deploy from branch `main` / `(root)`. The pages are then served at:
  ```
  https://jpdash-creator.github.io/fasting-timer-app/POLICY
  https://jpdash-creator.github.io/fasting-timer-app/TERMS
  ```
- These are already set in `.env.production` (read by `react-native-config`). For other builds edit the matching `.env.*` file, and enter the same privacy URL in App Store Connect and Play Console:
  ```
  PRIVACY_URL=https://jpdash-creator.github.io/fasting-timer-app/POLICY
  TERMS_URL=https://jpdash-creator.github.io/fasting-timer-app/TERMS   # optional; iOS defaults to Apple's standard EULA
  SUPPORT_EMAIL=jpdash.creator@gmail.com
  ```
  In builds without `PRIVACY_URL` (for example a development build), Settings and the paywall show the bundled text in-app instead of a web page, which is not acceptable for store review. `src/lib/links.ts` holds the defaults. After editing `POLICY.md` or `TERMS.md`, run `node scripts/gen-legal-text.mjs` to refresh `src/lib/legalText.ts`. The accessibility paragraph in the locale files also mentions `jpdash.creator@gmail.com`; update it if you change the mailbox. `docs/privacy-policy.md` and `docs/terms.md` are pointers to the root files.
- Verify the "Fastline" name on both stores and in trademark databases.
- Translations for es, pt-BR, de, hi and ar are planned for v1.1; all keys fall back to English.
