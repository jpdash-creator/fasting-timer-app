This is a bare React Native CLI application (react-native 0.88, new architecture, Hermes) with a react-native-web + Vite web target. It was migrated from Expo; there are NO Expo packages. Prioritise mobile-first patterns, performance and cross-platform behaviour. Details of the migration: `docs/MIGRATION.md`.

## Do not trust your training data for native setup

React Native, React Navigation, notifee, react-native-iap (Nitro), core-splashscreen etc. change their install steps between releases. Before writing code that touches a native library:

1. Check the version in `package.json`.
2. Read the library's own README under `node_modules/<pkg>/README.md` and its typings (`node_modules/<pkg>/lib|dist|src/*.d.ts`), or its current official docs.
3. For React Native itself use https://reactnative.dev/docs/ and the upgrade helper (https://react-native-community.github.io/upgrade-helper/) for template diffs.

## Commands

```bash
npm install                 # plain npm; no --legacy-peer-deps needed
npm start                   # Metro (react-native start)
npm run android             # build + install debug app on a device/emulator
npm run ios                 # macOS only (cd ios && bundle exec pod install first)
npm run web                 # Vite dev server (react-native-web)
npm run web:build           # Vite production build
npm run typecheck           # tsc --noEmit
npm run check               # pure-logic checks (scripts/checks)
npm run lint                # eslint
npm run license-audit       # production dependency licenses must be allowlisted
npm run android:release     # android/gradlew assembleRelease (APK); android:bundle for the AAB
npm run clean               # remove build outputs (add -- --all to delete node_modules)
node scripts/make-assets.js # regenerate brand/store/launcher/splash assets (see below)
```

Run `npm run typecheck`, `npm run lint` and `npm run check` before declaring any task done.

## Android toolchain

JDK 17 and the Android SDK are expected via `JAVA_HOME` and `ANDROID_HOME` (on this machine: `E:\dev-tools`). Build with `cd android && gradlew assembleDebug`. Use `-PreactNativeArchitectures=arm64-v8a` to speed up local builds.

## Project layout

- `index.js` registers the root component from `src/App.tsx`. Keep non-entry code in `src/` (components, hooks, lib, services, stores).
- `android/` and `ios/` are committed and edited by hand (there is no prebuild). Native config for each library is described in `docs/MIGRATION.md`.
- `src/app` held the old Expo Router tree; navigation now uses React Navigation (see `docs/MIGRATION.md`).
- Config: `react-native-config` reads `.env.development` (debug) and `.env.production` (release): `PRIVACY_URL`, `TERMS_URL`, `SUPPORT_EMAIL`, `USE_MOCK_PURCHASES`, `PAYWALL_MODE`. These are bundled into the app: never put secrets there. Local overrides go in `.env.local` (git-ignored).
- Release signing reads `FASTLINE_UPLOAD_STORE_FILE`, `FASTLINE_UPLOAD_STORE_PASSWORD`, `FASTLINE_UPLOAD_KEY_ALIAS`, `FASTLINE_UPLOAD_KEY_PASSWORD` from gradle properties (`~/.gradle/gradle.properties`) or environment variables. Never commit keystores or these values.
- Icons: `@react-native-vector-icons/ionicons/static`. Fonts are copied by the library's Gradle task (Android) and listed in `UIAppFonts` (iOS, `npx rnvi-update-plist package.json ios/Fastline/Info.plist`).

## Assets

`node scripts/make-assets.js` renders the chosen "B Track + two arcs" mark into `assets/`, `docs/store-assets/`, Android `mipmap-*` / `drawable-*` / `values-night`, and iOS `AppIcon` + `Ocean` / `Dusk` / `Sunrise` icon sets (alternate icons for `react-native-change-icon`). The splash (light + dark) is written by `node scripts/make-assets.js splash` (Android `values[-night]/splash_colors.xml` + `drawable[-night]-*dpi/splash_icon.png` for `androidx.core:core-splashscreen`; iOS `SplashBackground.colorset` + `SplashLogo.imageset` for `LaunchScreen.storyboard`).

## Rules

- Only MIT or Apache-2.0 (and the permissive licenses in `scripts/license-audit.mjs`) for dependencies. Check `npm view <pkg> license` before adding anything and run `npm run license-audit`.
- Add native libraries with `npm install <pkg>`, then check `npx react-native config` autolinks it, update the Podfile/Info.plist/AndroidManifest as the library's docs say, and note it in `docs/MIGRATION.md`. After JS-only changes no rebuild is needed; after adding native code rebuild the app.
- Do not use Expo APIs or packages (`expo-*`, `@expo/*`). Use React Native built-ins (`Linking`, `StatusBar`, `Platform`, `AppState`) where possible.
- Screens must work on web (react-native-web) as well: guard native-only modules with `Platform.OS` and keep a web fallback.
- iOS cannot be built on Windows: changes to `ios/` (Podfile, Info.plist, pbxproj, Swift) are unverified until built on a Mac.
