# retirement-simulator

Browser-based Monte Carlo retirement simulator. Single-page app built with Vite.

## Dev Setup

```bash
npm install
npm run dev        # dev server at localhost:5173/retirement-simulator/
npm run build      # produces dist/
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

**Pure simulation.** `simulation.js` and `rng.js` have zero DOM access. They can be called in Node without a browser.

**Shared cfg.** `cfg` is a mutable singleton exported from `config.js`. `ui.js` mutates it on user input. `scenarios.js` mutates it on preset clicks. All other modules read it.

**No circular imports.** `ui.js` and `scenarios.js` call `scheduleRender` via a callback set by `setOnRender(fn)`. `scenarios.js` also calls `syncUIFromCfg` via `setSyncUICallback(fn)`. `main.js` calls all three setters on DOMContentLoaded.

**YAML round-trip.** `cfgToProfileYaml` (ui.js) serializes cfg → YAML. `cfgFromProfileYaml` (ui.js) deserializes YAML → cfg (via Object.assign to preserve the shared reference). They must be inverses; editing a slider and clicking Download must round-trip cleanly.

**Profile storage key.** `PROFILE_STORAGE_KEY = 'retirement-simulator-profile-v1'` (ui.js). Do not change this key — it will break existing users' saved profiles.

## Adding a Chart

1. Add a `<canvas id="my-chart">` in `src/index.html`
2. Declare `let myChart = null` in `src/js/charts.js`
3. Write `function updateMyChart(stats) { ... }` in `charts.js` using `baseChartOpts()` for styling
4. Export it from `charts.js`
5. Import and call it in `doRender()` in `main.js`

## Simulation Methods and Withdrawal Strategies

Supported simulation methods: `monte_carlo`, `historical_bootstrap`, `deterministic`.
Supported withdrawal strategies: `constant_dollar`, `percent_portfolio`, `one_over_n`, `guardrails`, `guyton_klinger`, `vanguard_dynamic`.

Both lists are in `ui.js` (`SIMULATION_METHODS`, `WITHDRAWAL_STRATEGIES`). Adding a new value requires updating the `<select>` in `src/index.html`, the label function in `simulation.js`, and the simulation logic in `simulation.js`.
