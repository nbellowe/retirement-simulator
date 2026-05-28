# Restructure Design: retirement-simulator

**Date:** 2026-05-27
**Status:** Approved

## Goal

Transform `retirement-simulator` from a monolithic `index.html` into a structured project with a Vite build pipeline, split JS/CSS source files, a standalone MkDocs site, and a layout consistent with `~/src/monarch-money-tools`.

---

## Directory Structure

```
retirement-simulator/
  CLAUDE.md
  README.md
  package.json          ← scripts: dev, build, preview, docs:serve, docs:build
  vite.config.js        ← base: '/retirement-simulator/', outDir: 'dist'
  mkdocs.yml            ← Material slate theme, deep-purple accent
  .gitignore            ← dist/, node_modules/, site/
  sample-profile.yaml
  src/
    index.html          ← HTML skeleton; Vite injects CSS + JS
    style.css           ← all CSS extracted verbatim
    js/
      rng.js            ← mulberry32, makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng
      data.js           ← HIST_EQ_RETURNS array + derived constants
      config.js         ← FALLBACK_DEFAULT, DEFAULT, MONARCH_META, cfg
      simulation.js     ← clamp, retirementCoreSpending, simulateOne, pct, runMonteCarlo
      charts.js         ← all 5 Chart.js renderers + color helpers + baseChartOpts
      scenarios.js      ← SCENARIO_GROUPS, COMPARISON_PRESETS, renderPresets, renderScenarioGrid
      ui.js             ← storage, YAML editor, drag-drop, input binding, tooltips, sidebar
      main.js           ← entry point: imports all modules, calls init on DOMContentLoaded
  docs/
    index.md            ← overview, how it works, live link, sample link
    usage.md            ← Quick Start, profile loading methods, download
    profile-reference.md ← full profile.yaml key reference
    privacy-security.md ← client-side only, no data leaves browser
    retirement-simulator/
      sample.html       ← moved from monarch-money-tools verbatim
  dist/                 ← gitignored, Vite build output
  site/                 ← gitignored, MkDocs build output
```

---

## Build Pipeline

### Vite
- **Dev:** `npm run dev` — Vite dev server with HMR at `localhost:5173`
- **Build:** `npm run build` — single `dist/index.html` (inlined CSS + JS, no chunking)
- **Preview:** `npm run preview` — serve `dist/` locally before deploy

### Dependencies
Replace CDN script tags with npm packages:
- `chart.js` (production dep)
- `js-yaml` (production dep)
- `vite` (devDependency)

### `vite.config.js`
```js
export default {
  base: '/retirement-simulator/',
  build: { outDir: 'dist' }
}
```

### MkDocs
- **Serve:** `npm run docs:serve` → `mkdocs serve`
- **Build:** `npm run docs:build` → `mkdocs build`
- Theme: Material, `scheme: slate`, `primary: deep purple`, `accent: deep purple`
- `site_url: https://nbellowe.github.io/retirement-simulator/`

---

## JS Module Boundaries

Each module uses ES module `import`/`export`. The live config object `cfg` lives in `config.js` and is imported by any module that needs it.

```
main.js
  ├── imports ui.js        → bindInputs, bindYamlEditor, bindDragDrop,
  │                          bindSidebarToggle, applyTooltips, syncUIFromCfg
  ├── imports scenarios.js → renderPresets, renderScenarioGrid
  ├── imports charts.js    → updatePortfolioChart, updateCashflowChart,
  │                          updateDistChart, updateMetrics, + 2 more
  └── exports render()     → runs Monte Carlo, updates all charts + UI

simulation.js
  ├── imports rng.js       → makeGauss, makeHistRng, makeHistoricalSequenceRng
  ├── imports data.js      → HIST_EQ_RETURNS, HIST_EQ_MEAN
  └── imports config.js    → cfg (read-only during simulation)

ui.js
  ├── imports config.js    → cfg (mutates on slider/input change)
  └── calls render()       → re-runs simulation after each change (debounced)

charts.js
  └── imports config.js    → cfg (read-only for labels/formatting)

scenarios.js
  └── imports config.js    → cfg (reads + writes for scenario application)
```

**Key invariants:**
- `simulation.js` and `rng.js` are pure functions with zero DOM access — unit-testable without a browser
- `ui.js` owns all DOM mutation
- `charts.js` owns all Chart.js instances
- No module writes to `cfg` except `ui.js` (user input changes) and `scenarios.js` (scenario application)

---

## Docs Migration from monarch-money-tools

| Source (monarch-money-tools) | Action |
|---|---|
| `docs/retirement-simulator.md` | Move content → `docs/index.md` here; delete source |
| `docs/retirement-simulator/sample.html` | Move verbatim → `docs/retirement-simulator/sample.html` here |
| `mkdocs.yml` nav "Retirement Simulator" entry | Remove from monarch-money-tools |

The monarch-money-tools Privacy & Security page keeps its own CLI-focused content. A new `docs/privacy-security.md` here covers simulator-specific privacy (client-side computation, no data transmission).

---

## CLAUDE.md

Modeled on `monarch-money-tools/CLAUDE.md`. Sections:
- **Dev Setup** — `npm install`, `npm run dev`, `npm run build`, `npm run docs:serve`
- **Architecture** — one-line description per JS module (table format)
- **Key Invariants** — pure simulation functions, no DOM in simulation.js, YAML round-trip, profile localStorage key, single-file build output
