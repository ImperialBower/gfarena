# GitHub Pages CI/CD Design

**Date:** 2026-05-08  
**Repo:** ImperialBower/gfarena

## Overview

Add GitHub Actions workflows to build and deploy the gfarena WASM app to GitHub Pages, mirroring the setup in `ImperialBower/pkarena0-web`.

## Files to Create

### `.github/workflows/deploy.yml`

- Triggers: push to `main`, manual `workflow_dispatch`
- Permissions: `contents: read`, `pages: write`, `id-token: write`
- Concurrency: group `pages`, `cancel-in-progress: false`
- Jobs:
  - **build**: installs Rust stable + `wasm32-unknown-unknown`, caches Cargo registry/git/target, installs `wasm-pack`, runs `wasm-pack build --release --target web --out-dir www/pkg`, configures Pages, uploads `www/` as Pages artifact
  - **deploy**: depends on build, deploys to `github-pages` environment

### `.github/workflows/playwright.yml`

- Triggers: push to `main`, pull requests
- Timeout: 20 minutes
- Job steps: checkout, Rust + wasm32 target, Cargo cache, install wasm-pack, dev WASM build, Node 20 with npm cache, `npm install`, Playwright Chromium install, `npx playwright test`, upload `playwright-report/` artifact (14 days, runs even on cancel)

## Manual Prerequisite

In the GitHub repo settings → Pages, set source to **"GitHub Actions"**.

## What Is Not Changing

- `www/index.html` — no changes needed
- `Makefile` — no changes needed
- `.gitignore` — already ignores `/www/pkg`, `/playwright-report`, `/node_modules`
