# Fastline

Intermittent fasting timer and tracker. Expo SDK 58, React Native 0.88, TypeScript (strict), Expo Router. Fully offline: no account, no backend. Data stays on the device.

> Closed-source commercial app (iOS and Android). This repo holds the app source plus the public [privacy policy](POLICY.md) and [terms of use](TERMS.md), published with GitHub Pages. Repo and Pages setup: [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md).
<!-- Badges: add the CI badge after the first push: ![CI](https://github.com/jpdash-creator/fasting-timer-app/actions/workflows/ci.yml/badge.svg) -->

## Setup

```bash
npm install
npx expo start
```

Type-check with `npm run typecheck` (`tsc --noEmit`).

## Run in Expo Go (mock purchases)

Store billing needs native code, so it cannot run in Expo Go or on web. The app automatically uses `MockPurchasesService` when any of these is true: running in Expo Go, running on web, or `EXPO_PUBLIC_USE_MOCK_PURCHASES=1`.

- The paywall shows fake packages and "purchasing" unlocks Pro locally.
- In Settings, long-press the version row to toggle mock Pro (only in mock/dev builds).
- Push notifications have limited support in Expo Go; use a development build to test reminders properly.

## Billing architecture

Purchases go **directly to the App Store and Google Play** through [`expo-iap`](https://github.com/hyochan/expo-iap) (StoreKit 2 / Play Billing). There is no backend and no third-party billing service. `src/services/purchases/StoreBilling.ts` holds all the logic (the platform and the `expo-iap` module are injected, so it is unit-checked in Node against mocked `expo-iap` shapes); `StorePurchasesService.ts` is the thin wiring class that implements `PurchasesService`. Screens never touch `expo-iap`.

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
- The `mockPro` developer flag is ignored in release builds (it only works when `__DEV__` is true or `EXPO_PUBLIC_USE_MOCK_PURCHASES=1`).
- `PAYWALL_MODE` defaults to `soft` and can be forced per build with `EXPO_PUBLIC_PAYWALL_MODE=hard` (EAS env). It is a build flag, not a persisted user setting.

### Security trade-off (read this)

With no backend, entitlement is verified **on the device from store data only**. A rooted or jailbroken device, or a tampered build, can fake purchase data and unlock Pro. This is acceptable for a small offline app, but it is not fraud-proof. The client also cannot see server-side facts such as the exact Android expiry or refunds issued after the last successful refresh.

Recommended later hardening (needs a small backend, for example a serverless function):

1. Send the iOS transaction JWS or the Android `purchaseToken` to your server after each purchase and on refresh.
2. iOS: validate with the **App Store Server API** (Get Transaction History / Get All Subscription Statuses, signed with an App Store Connect API key) and subscribe to **App Store Server Notifications V2** for renewals, refunds and expirations.
3. Android: validate with the **Google Play Developer API** (`purchases.subscriptionsv2.get`, `purchases.products.get`) using a service account, and subscribe to **Real-time developer notifications** (Pub/Sub) for renewals, holds and refunds.
4. Have the server return the entitlement (with exact expiry) and make `StorePurchasesService` trust that instead of local derivation. An app-account token (`obfuscatedAccountId` on Android, `appAccountToken` on iOS) ties purchases to a user id.

### Assumptions that only real store sandbox accounts can verify

The pure logic is covered by `npm run check` (mocked `expo-iap` shapes). These points depend on what the stores and `expo-iap@6.x` actually return, and **must be confirmed once on a real device** (Sandbox/TestFlight on iOS, Internal testing with a license tester on Android) before release:

1. **iOS free-trial length.** The annual trial length comes from `ProductSubscription.subscriptionOffers[type=introductory, paymentMode=free-trial].period`, falling back to the legacy `introductoryPrice*IOS` fields. Confirm the annual card shows "3-day free trial". If it shows 0 or 1 day, adjust `trialDaysIOS` to what expo-iap reports.
2. **iOS trial eligibility.** `isEligibleForIntroOfferIOS(subscriptionGroupIdIOS)` removes the trial from the card when the Apple ID already used it. Confirm with a sandbox tester that has consumed the trial.
3. **iOS entitlement list.** `getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })` is assumed to return current entitlements, including subscriptions inside the billing grace period (expiry in the past, `renewalInfoIOS.gracePeriodExpirationDate` in the future), and to omit refunded ones. Confirm after a sandbox expiry and a refund (sandbox renewals take a few minutes).
4. **Android offer selection.** The annual trial offer is found by its free-trial pricing phase, the plain base plan by "single phase, no offer id (or id equal to the base plan id)". Confirm the right `offerToken` is sent for a trial-eligible and for a trial-ineligible Google account (the ineligible account should not receive the trial offer in the list).
5. **Android expiry estimate.** Play does not expose the expiry to the client. The estimate assumes `transactionDate` stays the original purchase time across renewals. Confirm Pro stays on through several license-tester renewals (they renew every few minutes) and turns off on the first refresh after the last one. For annual-with-trial the real renewal boundary is 3 days later than the estimate, which the 7-day offline grace and every online refresh absorb.
6. **Android grace period and account hold.** Grace period is not exposed by the client API (it looks like a normal active purchase); account hold appears as `isSuspendedAndroid` only with `includeSuspendedAndroid: true`. Confirm the billing banner appears for a suspended test subscription.
7. **`subscriptionBillingIssueListener`.** Assumed to fire when a subscription enters billing retry, grace or hold. The app then sets `billingIssue` and re-queries; the next refresh overwrites the flag from store data, so confirm the banner behaves sensibly on iOS billing retry and Android hold.
8. **Pending and deferred purchases.** Ask to Buy (iOS) is assumed to surface as error code `deferred-payment` or `purchaseState: 'pending'`; slow payment methods on Android as `purchaseState: 'pending'`. Both map to "Payment pending". Confirm the later approval arrives through `purchaseUpdatedListener` and unlocks Pro without reopening the paywall.
9. **Already owned.** Buying a product the account already owns is assumed to raise `already-owned`; the app then restores. Confirm on Android (iOS normally just returns the existing transaction).
10. **Connection loss.** The reconnect-and-retry path keys on the error codes `service-disconnected`, `connection-closed`, `init-connection`, `service-timeout` and `not-prepared`. Confirm by backgrounding the app for a long time on Android and then refreshing.
11. **Acknowledge timing.** In Play Console > Order management the purchase should show as **Acknowledged** within seconds of buying. Kill the app between payment and acknowledge once to confirm the next launch acknowledges it.

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
2. Build a release `.aab` (`eas build --profile production --platform android`), **upload it to the Internal testing track** and roll it out. **Subscriptions and products only become available to the billing API after a build with the billing permission has been uploaded**, and testers must install from the Play opt-in link (not by sideloading) for products to load.
3. **Monetize > Products > Subscriptions:** create three subscriptions with product ids `fw_pro_annual`, `fw_pro_monthly`, `fw_pro_weekly`. In each add one auto-renewing **base plan** (ids `annual`, `monthly`, `weekly`) with prices, and activate it.
4. On `fw_pro_annual`, base plan `annual`, add an **offer** with id `trial`, eligibility "New customer acquisition", and one phase: **Free trial, 3 days**. Activate it.
5. **Monetize > Products > In-app products:** create `fw_pro_lifetime`, price it and activate it.
6. In each subscription's base plan settings enable **Grace period** and **Account hold** (about a third of Play cancellations are billing failures).
7. **Settings > License testing:** add your testers' Gmail accounts as **license testers** (test purchases are free and renew quickly) and add them to the Internal testing list.
8. Complete the Data safety form to mirror the Apple privacy answers and add the "not a medical device" disclaimer in the listing.

## Building and testing real purchases

In-app purchases cannot run in Expo Go or web. Use a development build on a **real device**.

```bash
npm install
npx eas-cli@latest build --profile development --platform ios       # dev client, real billing
npx eas-cli@latest build --profile development --platform android   # dev client APK, real billing
npx expo start --dev-client
```

Profiles are defined in `eas.json`:

- `development`: dev client, **real store billing**.
- `development-mock`: dev client with `EXPO_PUBLIC_USE_MOCK_PURCHASES=1` (no store products needed).
- `preview`: internal build with mock purchases.
- `production`: store builds, real billing.

The `expo-iap` config plugin is registered in `app.json` and adds the native modules and the Android billing permission at prebuild; no plugin options are required.

**Test checklist**

1. iOS: sign in with the sandbox Apple account, open the paywall, check prices and the free trial on annual, then buy. Sandbox subscriptions renew every few minutes and stop after a handful of renewals, which lets you verify expiry (Pro turns off after the last renewal and a foreground refresh). Check Settings > Restore after a reinstall.
2. Android: install the build from the Internal testing opt-in link with a license-tester account. Buy annual (trial) and lifetime, then cancel from Play > Subscriptions and confirm Pro stays until the period ends. In Play Console order management, confirm the purchase is **Acknowledged**.
3. Kill and relaunch offline: Pro should persist (7-day offline grace).
4. Cancel the purchase sheet: no error, app stays Free. Slow payment methods on Android: the paywall shows the pending message and Pro unlocks when the payment completes.

Bundle id / package: `com.fastline.app`. URL scheme: `fastline`.

## Project layout

```
src/app            Expo Router routes (tabs, onboarding, modals)
src/components     UI and feature components (settings/, share/)
src/lib            Pure logic (fastMath, protocols, stages, csv, exportData, i18n, proGate)
src/stores         Zustand stores persisted to AsyncStorage
src/services       Purchases (mock + direct store billing via expo-iap) and notifications
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

Launcher icons use [`expo-alternate-app-icons`](https://github.com/pchalupa/expo-alternate-app-icons) (config plugin in `app.json`). `node scripts/make-assets.js` writes `assets/icons/<theme>-icon.png` (1024, opaque, used for iOS and the in-app picker) and `<theme>-foreground.png` (Android adaptive foreground; the background is the solid colour set per icon in `app.json`). Teal is the default app icon; Ocean, Dusk and Sunrise are registered as alternates (runtime names `Ocean`, `Dusk`, `Sunrise`).

Icon switching needs a dev or production build (`npx expo prebuild` then `npx expo run:android|ios`, or `eas build`). It does nothing in Expo Go or on web: the picker shows a message and the app keeps working. iOS shows a system confirmation when the icon changes. After changing icon colours, update both `THEME_ICONS` in the script and the `app.json` background colours it prints.

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
- These are already set in the `production` profile of `eas.json` (`eas build --profile production`). For local or other builds set them in the environment, and enter the same privacy URL in App Store Connect and Play Console:
  ```
  EXPO_PUBLIC_PRIVACY_URL=https://jpdash-creator.github.io/fasting-timer-app/POLICY
  EXPO_PUBLIC_TERMS_URL=https://jpdash-creator.github.io/fasting-timer-app/TERMS   # optional; iOS defaults to Apple's standard EULA
  EXPO_PUBLIC_SUPPORT_EMAIL=jpdash.creator@gmail.com
  ```
  In builds without `EXPO_PUBLIC_PRIVACY_URL` (development and preview), Settings and the paywall show the bundled text in-app instead of a web page, which is not acceptable for store review. `src/lib/links.ts` holds the defaults. After editing `POLICY.md` or `TERMS.md`, run `node scripts/gen-legal-text.mjs` to refresh `src/lib/legalText.ts`. The accessibility paragraph in the locale files also mentions `jpdash.creator@gmail.com`; update it if you change the mailbox. `docs/privacy-policy.md` and `docs/terms.md` are pointers to the root files.
- Verify the "Fastline" name on both stores and in trademark databases.
- Translations for es, pt-BR, de, hi and ar are planned for v1.1; all keys fall back to English.
