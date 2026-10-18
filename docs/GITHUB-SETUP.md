# GitHub setup (Fastline)

Nothing has been pushed yet. The local repo is ready; do these steps in order. Replace `<repo>` with the chosen repository name (for example `fastline`).

## 1. Create the repository

1. Sign in as the account that belongs to `jpdash-creator-org`.
2. Create a new repository under `jpdash-creator-org`, named `<repo>`. Do not add a README, .gitignore or license (they already exist locally).
3. Visibility: **Public** is required for free GitHub Pages on an organisation (private repo Pages needs a paid plan). The app is closed source, so if you want private source, host the policy pages from a separate public repo instead. Choose before step 2.
4. Link and push from the project folder:
   ```bash
   git remote add origin https://github.com/jpdash-creator-org/<repo>.git
   git push -u origin main
   ```

## 2. Enable Pages (branch deploy, no workflow needed)

Settings > Pages > Build and deployment > Source: **Deploy from a branch** > Branch `main`, folder `/ (root)` > Save.

The root `_config.yml` uses the minimal theme and the `jekyll-optional-front-matter` plugin, so `POLICY.md` and `TERMS.md` publish without front matter. `src`, `assets`, `docs`, `scripts` and the README are excluded from the site.

Final URLs (allow a minute or two after the first build):

- Privacy policy: `https://jpdash-creator-org.github.io/<repo>/POLICY`
- Terms of use: `https://jpdash-creator-org.github.io/<repo>/TERMS`
- Landing page: `https://jpdash-creator-org.github.io/<repo>/`

Open each in a private window to confirm before store submission.

## 3. Environment variables

Read in `src/lib/links.ts`. `EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in them.

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_PRIVACY_URL` | `https://jpdash-creator-org.github.io/<repo>/POLICY` |
| `EXPO_PUBLIC_TERMS_URL` | `https://jpdash-creator-org.github.io/<repo>/TERMS` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | `jpdash.creator@gmail.com` |
| `EXPO_PUBLIC_USE_MOCK_PURCHASES` | `1` for development/preview builds only (already set in `eas.json`); never in `production` |

Set the three URL/email values for the production profile with EAS environment variables (Expo dashboard > Project > Environment variables, visibility "Plain text" or "Sensitive"; or `eas env:create`), or add them to the `production` profile's `env` block in `eas.json`. They are not secret, so `eas.json` is acceptable. There are no private API keys in this project.

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
