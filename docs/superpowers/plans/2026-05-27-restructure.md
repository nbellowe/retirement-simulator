# Retirement Simulator Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the monolithic `index.html` (3431 lines) into a Vite-built project with split source files, a standalone MkDocs docs site, a CLAUDE.md, and a layout consistent with `~/src/monarch-money-tools`.

**Architecture:** Vite bundles `src/` into a single `dist/index.html`. Eight ES modules replace the inline `<script>` block. `cfg` in `config.js` is a singleton shared across modules. `scheduleRender` lives in `main.js` and is wired into `ui.js`/`scenarios.js` via a `setOnRender` setter to avoid circular imports. MkDocs (Material theme) provides the docs site at `site/`.

**Tech Stack:** Vite 5, chart.js 4, js-yaml 4, MkDocs Material, GitHub Actions (Pages deploy)

---

## File Map

| File | Action | Source |
|---|---|---|
| `package.json` | Create | New |
| `vite.config.js` | Create | New |
| `.gitignore` | Modify | Add `dist/`, `node_modules/`, `site/` |
| `src/index.html` | Create | Lines 1–8, 634–1241 of `index.html` |
| `src/style.css` | Create | Lines 10–631 of `index.html` |
| `src/js/rng.js` | Create | Lines 1246–1321 of `index.html` |
| `src/js/data.js` | Create | Lines 1277–1301 of `index.html` |
| `src/js/config.js` | Create | Lines 1323–1383 of `index.html` |
| `src/js/simulation.js` | Create | Lines 1388–1607 of `index.html` |
| `src/js/charts.js` | Create | Lines 1609–2312, 2525–2552 of `index.html` |
| `src/js/scenarios.js` | Create | Lines 2313–2524 of `index.html` |
| `src/js/ui.js` | Create | Lines 2585–3414 of `index.html` |
| `src/js/main.js` | Create | Lines 2553–2583, 3416–3428 of `index.html` |
| `.github/workflows/deploy.yml` | Create | New |
| `mkdocs.yml` | Create | New |
| `docs/index.md` | Create | From `monarch-money-tools/docs/retirement-simulator.md` |
| `docs/usage.md` | Create | New |
| `docs/profile-reference.md` | Create | From `monarch-money-tools/docs/retirement-simulator.md` |
| `docs/privacy-security.md` | Create | New |
| `docs/retirement-simulator/sample.html` | Move | From `monarch-money-tools/docs/retirement-simulator/sample.html` |
| `CLAUDE.md` | Create | New |
| `README.md` | Modify | Update dev setup section |
| `index.html` | Delete | Replaced by Vite build output |
| `monarch-money-tools/docs/retirement-simulator.md` | Delete | Content moved here |
| `monarch-money-tools/docs/retirement-simulator/` | Delete | Content moved here |
| `monarch-money-tools/mkdocs.yml` | Modify | Remove "Retirement Simulator" nav entry |

---

## Task 1: Initialize Vite project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "retirement-simulator",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "docs:serve": "mkdocs serve",
    "docs:build": "mkdocs build"
  },
  "dependencies": {
    "chart.js": "^4.4.4",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` created.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/retirement-simulator/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 4: Update `.gitignore`**

Append these lines to `.gitignore` (create it if it doesn't exist):

```
node_modules/
dist/
site/
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js .gitignore
git commit -m "chore: initialize Vite project with chart.js and js-yaml deps"
```

---

## Task 2: Create `src/index.html` (HTML skeleton)

**Files:**
- Create: `src/index.html`

The HTML skeleton strips the embedded `<style>` and `<script>` blocks from `index.html` and adds Vite entry points instead.

- [ ] **Step 1: Create `src/` directory**

```bash
mkdir -p src/js
```

- [ ] **Step 2: Create `src/index.html`**

Replace:
- Lines 1–8 (DOCTYPE through the two CDN `<script>` tags) with the DOCTYPE + head below
- Lines 634–1241 (body content through `</body>`) copy verbatim
- Remove the `<style>…</style>` block (lines 9–632) and inline `<script>…</script>` block (lines 1242–3429)

Final `src/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Retirement Simulator</title>
<link rel="stylesheet" href="./style.css" />
</head>
```

Then copy lines 634–3430 of the original `index.html` verbatim (from `<body>` through `</html>`), but omit the `<script>` block (lines 1242–3429 in the original). End the file with:

```html
<script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify the HTML file parses**

```bash
node -e "const fs = require('fs'); const html = fs.readFileSync('src/index.html','utf8'); console.log('Lines:', html.split('\n').length); console.log('Has main.js ref:', html.includes('main.js'));"
```

Expected output: Lines count in the range 650–700, `Has main.js ref: true`.

- [ ] **Step 4: Commit**

```bash
git add src/index.html
git commit -m "feat: add src/index.html HTML skeleton"
```

---

## Task 3: Create `src/style.css`

**Files:**
- Create: `src/style.css`

- [ ] **Step 1: Extract CSS**

Copy lines 10–631 of the original `index.html` verbatim into `src/style.css`. These are the contents of the `<style>` block (not including the `<style>` and `</style>` tags themselves).

Verify:

```bash
wc -l src/style.css
```

Expected: around 622 lines.

- [ ] **Step 2: Commit**

```bash
git add src/style.css
git commit -m "feat: extract CSS into src/style.css"
```

---

## Task 4: Create `src/js/rng.js` and `src/js/data.js`

**Files:**
- Create: `src/js/rng.js`
- Create: `src/js/data.js`

These are pure modules with no imports.

- [ ] **Step 1: Create `src/js/rng.js`**

Copy lines 1246–1321 of the original `index.html` verbatim (from `function mulberry32` through the closing `}` of `makeHistoricalSequenceRng`). Then add export statements at the end:

```js
export { mulberry32, makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng };
```

- [ ] **Step 2: Create `src/js/data.js`**

Copy lines 1277–1301 of the original `index.html` verbatim (from `const HIST_EQ_RETURNS` through `const HIST_EQ_MEAN`). Then add export statements at the end:

```js
export { HIST_EQ_RETURNS, HIST_START_YEAR, HIST_END_YEAR, HIST_EQ_MEAN };
```

- [ ] **Step 3: Verify modules parse**

```bash
node --input-type=module <<'EOF'
import { mulberry32 } from './src/js/rng.js';
const rng = mulberry32(42);
console.log('rng ok:', typeof rng() === 'number');
import { HIST_EQ_RETURNS } from './src/js/data.js';
console.log('data ok:', HIST_EQ_RETURNS.length > 50);
EOF
```

Expected: `rng ok: true`, `data ok: true`.

- [ ] **Step 4: Commit**

```bash
git add src/js/rng.js src/js/data.js
git commit -m "feat: extract rng.js and data.js modules"
```

---

## Task 5: Create `src/js/config.js`

**Files:**
- Create: `src/js/config.js`

- [ ] **Step 1: Create `src/js/config.js`**

Copy lines 1323–1383 of the original `index.html` verbatim (from `const FALLBACK_DEFAULT` through `let cfg = { ...DEFAULT };`). Then add export statements at the end:

```js
export { FALLBACK_DEFAULT, DEFAULT, MONARCH_META, cfg };
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module <<'EOF'
import { cfg, DEFAULT } from './src/js/config.js';
console.log('cfg ok:', typeof cfg.mcRuns === 'number');
console.log('DEFAULT ok:', DEFAULT.years === 70);
EOF
```

Expected: `cfg ok: true`, `DEFAULT ok: true`.

- [ ] **Step 3: Commit**

```bash
git add src/js/config.js
git commit -m "feat: extract config.js module"
```

---

## Task 6: Create `src/js/simulation.js`

**Files:**
- Create: `src/js/simulation.js`

- [ ] **Step 1: Create `src/js/simulation.js`**

Add imports at the top:

```js
import { makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng } from './rng.js';
import { HIST_EQ_RETURNS, HIST_EQ_MEAN } from './data.js';
import { DEFAULT } from './config.js';
```

Then copy lines 1388–1607 of the original `index.html` verbatim (from `function clamp` through the closing `}` of `runMonteCarlo`). Then add export statements:

```js
export { clamp, hasSpouse, strategyLabel, methodLabel, retirementCoreSpending, simulateOne, pct, runMonteCarlo };
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module <<'EOF'
import { runMonteCarlo } from './src/js/simulation.js';
import { cfg } from './src/js/config.js';
const stats = runMonteCarlo(cfg, { seed: 1 });
console.log('survival:', typeof stats.survival === 'number');
console.log('medianPath length:', stats.medianPath?.length > 0);
EOF
```

Expected: `survival: true`, `medianPath length: true`.

- [ ] **Step 3: Commit**

```bash
git add src/js/simulation.js
git commit -m "feat: extract simulation.js module"
```

---

## Task 7: Create `src/js/charts.js`

**Files:**
- Create: `src/js/charts.js`

This is the largest module. It owns all Chart.js instances and visualization updates, including the guardrails insight panel.

- [ ] **Step 1: Create `src/js/charts.js`**

Add imports at the top:

```js
import Chart from 'chart.js/auto';
import { cfg, MONARCH_META } from './config.js';
import { hasSpouse, strategyLabel, methodLabel, runMonteCarlo } from './simulation.js';
```

Then copy the following line ranges from the original `index.html` verbatim, in order:

1. Lines 1609–2312 (from `function fmtM` through the closing `}` of `updateDistChart`)
2. Lines 2525–2552 (from `let noGuardrailsSurvival` through the closing `}` of `updateGuardrailsInsight`)

Then add export statements:

```js
export {
  fmtM, survivalColor,
  updateMetrics, updatePortfolioChart, updateCashflowChart, updateDistChart,
  updateFeasibilityHeatmap, updateHistoricalCohortChart, updateLifestyleChart,
  updateGuardrailsInsight,
};
```

- [ ] **Step 2: Verify chart module loads**

```bash
node --input-type=module <<'EOF'
import { fmtM, survivalColor } from './src/js/charts.js';
console.log('fmtM 1.5M:', fmtM(1500000));
console.log('survivalColor 95%:', survivalColor(0.95));
EOF
```

Expected: `fmtM 1.5M: $1.5M`, `survivalColor 95%: var(--success)`.

- [ ] **Step 3: Commit**

```bash
git add src/js/charts.js
git commit -m "feat: extract charts.js module"
```

---

## Task 8: Create `src/js/scenarios.js`

**Files:**
- Create: `src/js/scenarios.js`

- [ ] **Step 1: Create `src/js/scenarios.js`**

Add imports at the top:

```js
import { cfg, DEFAULT } from './config.js';
import { hasSpouse, runMonteCarlo } from './simulation.js';
import { fmtM, survivalColor } from './charts.js';
```

Add a render callback setter after the imports:

```js
let _onRender = () => {};
export function setOnRender(fn) { _onRender = fn; }
```

Then copy lines 2313–2524 of the original `index.html` verbatim (from `const SCENARIO_GROUPS` through the closing `}` of `renderScenarioGrid`). Replace every call to `scheduleRender()` in this block with `_onRender()`.

Then add export statements:

```js
export { renderPresets, renderScenarioGrid, updateScenarioButtonStates, markCustom };
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module <<'EOF'
import { renderPresets, setOnRender } from './src/js/scenarios.js';
let called = false;
setOnRender(() => { called = true; });
console.log('setOnRender ok:', typeof setOnRender === 'function');
console.log('renderPresets ok:', typeof renderPresets === 'function');
EOF
```

Expected: both lines print `ok: true`.

- [ ] **Step 3: Commit**

```bash
git add src/js/scenarios.js
git commit -m "feat: extract scenarios.js module"
```

---

## Task 9: Create `src/js/ui.js`

**Files:**
- Create: `src/js/ui.js`

- [ ] **Step 1: Create `src/js/ui.js`**

Add imports at the top:

```js
import jsYaml from 'js-yaml';
import { cfg, DEFAULT, MONARCH_META } from './config.js';
import { hasSpouse, strategyLabel, methodLabel } from './simulation.js';
import { updateScenarioButtonStates, markCustom } from './scenarios.js';
```

Add a render callback setter after the imports:

```js
let _onRender = () => {};
export function setOnRender(fn) { _onRender = fn; }
```

Then copy lines 2585–3414 of the original `index.html` verbatim (from `function fmtPct` through the closing `}` of `applyMetaDefaults`). Apply these substitutions throughout:

- Replace every bare `scheduleRender()` call with `_onRender()`
- Replace `jsyaml.load(` with `jsYaml.load(` (Vite import uses the package's default export)
- Replace `jsyaml.dump(` with `jsYaml.dump(`

Then add export statements:

```js
export {
  setOnRender,
  bindSidebarToggle, bindYamlEditor, bindInputs, bindDragDrop,
  syncUIFromCfg, applyTooltips, applyMetaDefaults,
  loadProfileFromStorage, syncYamlFromCfg,
};
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module <<'EOF'
import { bindInputs, syncUIFromCfg, applyMetaDefaults } from './src/js/ui.js';
console.log('bindInputs:', typeof bindInputs === 'function');
console.log('syncUIFromCfg:', typeof syncUIFromCfg === 'function');
console.log('applyMetaDefaults:', typeof applyMetaDefaults === 'function');
EOF
```

Expected: all three print `function`.

- [ ] **Step 3: Commit**

```bash
git add src/js/ui.js
git commit -m "feat: extract ui.js module"
```

---

## Task 10: Create `src/js/main.js`

**Files:**
- Create: `src/js/main.js`

`main.js` is the Vite entry point. It owns `scheduleRender`/`doRender` and the DOMContentLoaded boot sequence.

- [ ] **Step 1: Create `src/js/main.js`**

```js
import {
  setOnRender as uiSetOnRender,
  bindSidebarToggle, bindYamlEditor, bindInputs, bindDragDrop,
  syncUIFromCfg, applyTooltips, applyMetaDefaults,
  loadProfileFromStorage,
} from './ui.js';
import { setOnRender as scenariosSetOnRender, renderPresets, renderScenarioGrid } from './scenarios.js';
import {
  updateMetrics, updatePortfolioChart, updateCashflowChart, updateDistChart,
  updateFeasibilityHeatmap, updateHistoricalCohortChart, updateLifestyleChart,
  updateGuardrailsInsight,
} from './charts.js';
import { runMonteCarlo } from './simulation.js';
import { cfg } from './config.js';

let renderTimer = null;

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(doRender, 60);
}

function doRender() {
  document.getElementById('computing').classList.add('show');
  requestAnimationFrame(() => {
    const stats = runMonteCarlo(cfg);
    updateMetrics(stats);
    updatePortfolioChart(stats);
    updateCashflowChart(stats.medianPath);
    updateDistChart(stats.finalVals);
    updateFeasibilityHeatmap();
    updateHistoricalCohortChart();
    updateLifestyleChart(stats);
    updateGuardrailsInsight(stats);

    setTimeout(() => {
      renderScenarioGrid(stats);
      document.getElementById('computing').classList.remove('show');
    }, 0);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  uiSetOnRender(scheduleRender);
  scenariosSetOnRender(scheduleRender);

  applyMetaDefaults();
  renderPresets();
  bindSidebarToggle();
  bindYamlEditor();
  bindInputs();
  bindDragDrop();
  applyTooltips();

  if (!loadProfileFromStorage()) {
    syncUIFromCfg();
    scheduleRender();
  }
});
```

> **Note:** Compare the `doRender` body above against lines 2560–2583 of the original `index.html`. Add any chart update calls that appear there but are missing above (the original may reference `updateFeasibilityHeatmap`, `updateHistoricalCohortChart`, or `updateLifestyleChart` — include whichever are called).

- [ ] **Step 2: Commit**

```bash
git add src/js/main.js
git commit -m "feat: add main.js entry point"
```

---

## Task 11: Verify Vite dev server and build

**Files:** None created — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173/retirement-simulator/` in a browser.

Expected: The simulator loads, sliders move, charts render. No console errors.

- [ ] **Step 2: Fix any import or runtime errors**

If `npm run dev` shows errors:
- `js-yaml` import error → check that `import jsYaml from 'js-yaml'` is at the top of `ui.js` and `jsYaml.load`/`jsYaml.dump` are used (not `jsyaml.load`/`jsyaml.dump`)
- `Chart is not defined` → check that `import Chart from 'chart.js/auto'` is at the top of `charts.js`
- Circular import warning → `scheduleRender` must live only in `main.js`; `ui.js` and `scenarios.js` must use `_onRender` via their `setOnRender` setters

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: `dist/index.html` is created. No build errors.

- [ ] **Step 4: Preview build**

```bash
npm run preview
```

Open `http://localhost:4173/retirement-simulator/` in a browser. Verify the built app works identically to dev.

- [ ] **Step 5: Commit build config if any fixes were needed**

```bash
git add -p
git commit -m "fix: resolve import issues in module split"
```

---

## Task 12: Remove old `index.html` and add GitHub Actions deploy

**Files:**
- Delete: `index.html` (root)
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Remove root `index.html`**

```bash
git rm index.html
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```bash
mkdir -p .github/workflows
```

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: remove old index.html, add GitHub Actions Pages deploy"
```

---

## Task 13: Set up MkDocs

**Files:**
- Create: `mkdocs.yml`
- Create: `docs/index.md` (placeholder — content added in Task 14)
- Create: `docs/javascripts/mermaid-init.js`

- [ ] **Step 1: Create `mkdocs.yml`**

```yaml
site_name: retirement-simulator
site_description: Monte Carlo retirement simulator — runs entirely in your browser.
site_url: https://nbellowe.github.io/retirement-simulator/
repo_url: https://github.com/nbellowe/retirement-simulator
repo_name: nbellowe/retirement-simulator
docs_dir: docs

theme:
  name: material
  palette:
    scheme: slate
    primary: deep purple
    accent: deep purple
  features:
    - navigation.instant
    - navigation.top
    - content.code.copy

nav:
  - Home: index.md
  - Usage: usage.md
  - Profile Reference: profile-reference.md
  - Privacy & Security: privacy-security.md

exclude_docs: |
  superpowers/**

markdown_extensions:
  - admonition
  - attr_list
  - md_in_html
  - pymdownx.details
  - pymdownx.superfences
```

- [ ] **Step 2: Create placeholder `docs/index.md`**

```markdown
# Retirement Simulator

Content coming in next task.
```

- [ ] **Step 3: Verify mkdocs serves**

```bash
pip install mkdocs-material 2>/dev/null || pip3 install mkdocs-material
mkdocs serve --config-file mkdocs.yml
```

Open `http://127.0.0.1:8000/` in a browser. Expected: MkDocs site loads with the deep-purple Material theme.

- [ ] **Step 4: Commit**

```bash
git add mkdocs.yml docs/index.md
git commit -m "chore: add mkdocs.yml and docs skeleton"
```

---

## Task 14: Write docs content and migrate from monarch-money-tools

**Files:**
- Modify: `docs/index.md`
- Create: `docs/usage.md`
- Create: `docs/profile-reference.md`
- Create: `docs/privacy-security.md`
- Create: `docs/retirement-simulator/sample.html` (moved from MMT)
- Modify: `~/src/monarch-money-tools/mkdocs.yml`
- Delete: `~/src/monarch-money-tools/docs/retirement-simulator.md`
- Delete: `~/src/monarch-money-tools/docs/retirement-simulator/` (directory)

- [ ] **Step 1: Read source material**

Read the full content of `~/src/monarch-money-tools/docs/retirement-simulator.md` to use as source for `docs/index.md` and `docs/profile-reference.md`.

- [ ] **Step 2: Write `docs/index.md`**

From the monarch-money-tools retirement-simulator.md: take the top section ("What it is", "How It Works", the Quick Start block, and the live sample link). Keep it concise — 1–2 paragraphs + Quick Start code block.

```markdown
# Retirement Simulator

A self-contained Monte Carlo retirement simulator that runs entirely in your browser. No server required — open it, load your `profile.yaml`, and get probabilistic projections for portfolio survival, safe withdrawal rates, spending flexibility, and more.

[**Open the simulator →**](https://nbellowe.github.io/retirement-simulator/){ .md-button .md-button--primary }
[**See a sample →**](retirement-simulator/sample.html){ .md-button }

---

## How It Works

The simulator reads a `profile.yaml` file you maintain locally and runs a Monte Carlo simulation (or historical bootstrap, or deterministic path) entirely client-side. Charts show portfolio percentile bands, cashflow, ending-value distribution, feasibility heatmap, historical cohort replays, and scenario comparisons.

All computation is in JavaScript in your browser. Your profile data never leaves your device.

---

## Quick Start

```bash
# Generate a starter profile (requires monarch-money-tools)
monarch init-profile

# Edit with your numbers
open profile.yaml

# Open the simulator
open https://nbellowe.github.io/retirement-simulator/
```

Drag `profile.yaml` onto the page or use **Load file** in the YAML Settings panel.
```

- [ ] **Step 3: Write `docs/usage.md`**

```markdown
# Usage

## Profile Loading

- **Drag-and-drop** a `profile.yaml` anywhere on the page
- **Load file** button in the YAML Settings panel
- **Paste / edit** YAML directly in the YAML Settings panel and click **Apply YAML**
- Your profile is saved automatically in `localStorage` between sessions

## Downloading Changes

After adjusting sliders or editing YAML, click **Download** to save your current profile back to `profile.yaml`.

## Quick Scenarios

The **Quick Scenarios** panel offers preset buttons grouped by assumption type (returns, withdrawal strategy, spending). Each button changes one category and preserves your other settings, so you can compose scenarios (e.g., historical returns + Guyton-Klinger + lean spending).

## Simulation Methods

| Method | Description |
|---|---|
| Monte Carlo | Random draws from a normal distribution with your equity/bond return assumptions |
| Historical bootstrap | Randomly samples from the actual 1928–present annual return sequence |
| Deterministic | Single expected-return path with no randomness |

## Withdrawal Strategies

| Strategy | Description |
|---|---|
| Constant dollar | Fixed real spending each year |
| Percent of portfolio | Spend a fixed percentage of current portfolio each year |
| 1/N remaining years | Divide portfolio by remaining years each year |
| Guardrails | Cut spending if withdrawal rate exceeds upper trigger; raise if below lower trigger |
| Guyton-Klinger | Rule-based cuts and raises with capital preservation and prosperity triggers |
| Vanguard dynamic | Constrain year-over-year spending changes within a floor/ceiling band |
```

- [ ] **Step 4: Write `docs/profile-reference.md`**

Copy the **profile.yaml Reference** section from `~/src/monarch-money-tools/docs/retirement-simulator.md` verbatim (the full table of keys, groups, and descriptions).

- [ ] **Step 5: Write `docs/privacy-security.md`**

```markdown
# Privacy & Security

**All computation runs client-side.** The simulator is a single HTML file with embedded JavaScript. It does not make network requests, does not send your profile data anywhere, and does not use cookies.

Your profile is saved in your browser's `localStorage` under the key `retirement-simulator-profile-v1`. It never leaves your device unless you explicitly click **Download** and share the file.

The simulator loads `chart.js` and `js-yaml` from npm at build time — the deployed HTML is fully self-contained with no runtime CDN dependencies.
```

- [ ] **Step 6: Copy sample.html**

```bash
mkdir -p docs/retirement-simulator
cp ~/src/monarch-money-tools/docs/retirement-simulator/sample.html docs/retirement-simulator/sample.html
```

- [ ] **Step 7: Remove retirement-simulator content from monarch-money-tools**

```bash
# In the monarch-money-tools repo
cd ~/src/monarch-money-tools
git rm docs/retirement-simulator.md
git rm -r docs/retirement-simulator/
```

Then edit `~/src/monarch-money-tools/mkdocs.yml` and remove this line from the `nav:` section:

```yaml
  - Retirement Simulator: retirement-simulator.md
```

Commit in the monarch-money-tools repo:

```bash
cd ~/src/monarch-money-tools
git add -A
git commit -m "chore: remove retirement-simulator docs (moved to retirement-simulator repo)"
```

- [ ] **Step 8: Commit retirement-simulator docs**

```bash
cd ~/src/retirement-simulator/.claude/worktrees/restructure
git add docs/ mkdocs.yml
git commit -m "docs: add full docs site content, migrate from monarch-money-tools"
```

---

## Task 15: Write `CLAUDE.md`

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
# retirement-simulator

Browser-based Monte Carlo retirement simulator. Single-page app built with Vite.

## Dev Setup

```bash
npm install
npm run dev        # dev server at localhost:5173/retirement-simulator/
npm run build      # produces dist/index.html
npm run preview    # serve dist/ locally
npm run docs:serve # MkDocs site at localhost:8000
npm run docs:build # produces site/
```

No tests yet — verify by running the dev server and exercising the simulator.

## Architecture

```
src/
  index.html        — HTML skeleton; Vite injects CSS and JS
  style.css         — all UI styles
  js/
    rng.js          — mulberry32, makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng
    data.js         — HIST_EQ_RETURNS array, HIST_START_YEAR, HIST_END_YEAR, HIST_EQ_MEAN
    config.js       — FALLBACK_DEFAULT, DEFAULT, MONARCH_META, cfg (shared singleton)
    simulation.js   — clamp, hasSpouse, retirementCoreSpending, simulateOne, runMonteCarlo
    charts.js       — all Chart.js instances and update functions, fmtM, survivalColor
    scenarios.js    — SCENARIO_GROUPS, COMPARISON_PRESETS, renderPresets, renderScenarioGrid
    ui.js           — input binding, YAML editor, drag-drop, storage, tooltips, sidebar
    main.js         — entry point; owns scheduleRender/doRender, wires modules together
```

## Key Invariants

**Pure simulation.** `simulation.js` and `rng.js` have zero DOM access. They can be called in Node (as in the verify steps) without a browser.

**Shared cfg.** `cfg` is a mutable singleton exported from `config.js`. `ui.js` mutates it on user input. `scenarios.js` mutates it on preset clicks. All other modules read it.

**No circular imports.** `ui.js` and `scenarios.js` call `scheduleRender` via a callback set by `setOnRender(fn)`. `main.js` calls both setters on DOMContentLoaded.

**YAML round-trip.** `cfgToProfileYaml` (ui.js) serializes cfg → YAML. `cfgFromProfileYaml` (ui.js) deserializes YAML → cfg. They must be inverses; editing a slider and clicking Download must round-trip cleanly.

**Profile storage key.** `PROFILE_STORAGE_KEY = 'retirement-simulator-profile-v1'` (ui.js). Do not change this key — it will break existing users' saved profiles.

**Single-file build output.** Vite is configured to produce a single `dist/index.html`. Do not add chunking or code-splitting; the app is small enough and the single-file format is intentional.

## Adding a Chart

1. Add the chart canvas `<canvas id="my-chart">` in `src/index.html`
2. Declare `let myChart = null` in `src/js/charts.js`
3. Write `function updateMyChart(stats) { ... }` in `charts.js`, using `baseChartOpts()` for consistent styling
4. Export it from `charts.js`
5. Import and call it in `doRender()` in `main.js`

## Simulation Methods and Withdrawal Strategies

Supported simulation methods: `monte_carlo`, `historical_bootstrap`, `deterministic`.
Supported withdrawal strategies: `constant_dollar`, `percent_portfolio`, `one_over_n`, `guardrails`, `guyton_klinger`, `vanguard_dynamic`.

Both lists are defined in `ui.js` (`SIMULATION_METHODS`, `WITHDRAWAL_STRATEGIES`). Adding a new value requires updating the corresponding `<select>` in `src/index.html`, the label function in `simulation.js` (`strategyLabel`/`methodLabel`), and the simulation logic in `simulation.js`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with architecture reference"
```

---

## Task 16: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

Replace the existing `README.md` with:

```markdown
# Retirement Simulator

A self-contained Monte Carlo retirement simulator that runs entirely in your browser.

**[Open the simulator →](https://nbellowe.github.io/retirement-simulator)**
**[Read the docs →](https://nbellowe.github.io/retirement-simulator/docs/)**

## Usage

1. Generate a starter profile with the `monarch-money-tools` CLI:
   ```bash
   monarch init-profile
   ```
2. Edit `profile.yaml` with your numbers.
3. Open the simulator and drag `profile.yaml` onto the page (or use **Load file**).
4. Tweak settings interactively; use **Download** to save changes back to `profile.yaml`.

## Profile loading

- **Drag-and-drop** a `profile.yaml` anywhere on the page
- **Load file** button in the YAML Settings panel
- **Paste / edit** YAML directly in the YAML Settings panel and click **Apply YAML**
- Your profile is saved automatically in `localStorage` between sessions

## Sample profile

`sample-profile.yaml` contains a fictional reference profile (Alex & Jordan).

## Privacy

All computation runs client-side. Your profile data never leaves your browser.

## Development

```bash
npm install
npm run dev      # dev server at localhost:5173/retirement-simulator/
npm run build    # produces dist/index.html
```

See `CLAUDE.md` for architecture details.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with dev setup and new docs link"
```

---

## Self-Review

**Spec coverage check:**
- [x] CLAUDE.md — Task 15
- [x] Build pipeline (Vite, npm scripts) — Task 1
- [x] JS module split (8 modules) — Tasks 4–10
- [x] Docs site (MkDocs Material) — Tasks 13–14
- [x] Migrate docs from monarch-money-tools — Task 14
- [x] Remove old index.html — Task 12
- [x] GitHub Actions deploy — Task 12
- [x] Consistent structure with monarch-money-tools — CLAUDE.md matches pattern, mkdocs.yml matches palette

**Circular import check:** `ui.js` and `scenarios.js` both use a `setOnRender` setter pattern; `main.js` is the only file that imports from all other modules — no cycles.

**Type consistency check:** `runMonteCarlo` returns `stats` object with `.survival`, `.medianPath`, `.finalVals` throughout. `updateHistoricalCohortChart()` takes no arguments (reads `cfg` internally). `updateLifestyleChart(stats)` takes stats. `updateFeasibilityHeatmap()` takes no arguments. These signatures are consistent between Tasks 7 and 10.

**Placeholder scan:** No TBDs. Task 10's main.js note about verifying `doRender` body is explicit (compare specific line range, not "fill in later").

**One gap found and fixed:** The `docs/retirement-simulator/sample.html` copy step in Task 14 needed a `mkdir -p` — added.
