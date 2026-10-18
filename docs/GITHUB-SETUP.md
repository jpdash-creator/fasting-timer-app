# GitHub setup (Fastline)

The repository is `https://github.com/jpdash-creator/fasting-timer-app` (public, branch `main`, owned by the `jpdash-creator` account). Remaining steps are below.

## 1. Repository (done)

- Visibility is **Public**, which free GitHub Pages requires. The app is closed source in spirit (see `LICENSE`: all rights reserved), but the code is publicly readable while the repo is public. If you later want private source, move the policy pages to a separate public repo and update the URLs below.
- Remote: `origin` = `https://github.com/jpdash-creator/fasting-timer-app.git`.

## 2. Enable Pages (branch deploy, no workflow needed)

Settings > Pages > Build and deployment > Source: **Deploy from a branch** > Branch `main`, folder `/ (root)` > Save.

The root `_config.yml` uses the minimal theme and the `jekyll-optional-front-matter` plugin, so `POLICY.md` and `TERMS.md` publish without front matter. `src`, `assets`, `docs`, `scripts` and the README are excluded from the site.

Final URLs (allow a minute or two after the first build):

- Privacy policy: `https://jpdash-creator.github.io/fasting-timer-app/POLICY`
- Terms of use: `https://jpdash-creator.github.io/fasting-timer-app/TERMS`
- Landing page: `https://jpdash-creator.github.io/fasting-timer-app/`

Open each in a private window to confirm before store submission.

## 3. Environment variables

Read in `src/lib/links.ts`. `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in them.

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_PRIVACY_URL` | `https://jpdash-creator.github.io/fasting-timer-app/POLICY` |
| `EXPO_PUBLIC_TERMS_URL` | `https://jpdash-creator.github.io/fasting-timer-app/TERMS` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | `jpdash.creator@gmail.com` |
| `EXPO_PUBLIC_USE_MOCK_PURCHASES` | `1` for development/preview builds only (already set in `eas.json`); never in `production` |

**Done:** the three values are set in the `production` profile's `env` block in `eas.json`, so `eas build --profile production` bundles them. They are not secret, so `eas.json` is the right place; there are no private API keys in this project. Development and preview builds do not set them, so those builds show the in-app draft policy reader instead of the hosted pages.

## 4. Branch protection (suggested)

Settings > Branches > Add rule for `main`:

- Require a pull request before merging
- Require status checks to pass: **CI / check** (appears after the first workflow run)
- Block force pushes and deletions

For a solo project, skip "require approvals" so you can still merge your own PRs.

## 5. Not committed on purpose

`.gitignore` excludes `.expo/`, `dist/`, logs, `.env*`, keystores and store credentials, plus three machine-specific files containing local paths: `scripts/dev-supervise.ps1`, `scripts/axe-harness.js`, `docs/RESUME.md`. Keep them locally.

## 6. License

`LICENSE` is currently the Expo template MIT file (copyright 650 Industries). Replace it with your own notice before publishing, for example "Copyright (c) 2026 J. P. Dash. All rights reserved." for a closed-source commercial app.
