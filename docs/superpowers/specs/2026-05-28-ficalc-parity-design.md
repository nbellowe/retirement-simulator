# FICalc-parity fixes + deploy cleanup

**Date:** 2026-05-28
**Status:** Approved

## Problem

Benchmarking the simulator against FICalc/Trinity revealed the tool reports the 4%
rule as ~81% safe vs the canonical ~95%. The per-path arithmetic is correct; the gap
comes from modeling/data choices:

1. The "Historical" mode is an i.i.d. **bootstrap**, not a sequential historical
   backtest. On the same data, sequential replay gives 88% vs bootstrap's 81%.
2. The equity dataset is hand-rounded, 1928–2023, with a low **5.6% real geometric**
   return (true S&P is ~6.7%). Bonds are a **flat 1% real constant** with no
   volatility or stock/bond co-movement.
3. Monte Carlo and Historical modes use different expected returns.
4. Withdrawals grow-then-withdraw (end-of-year, optimistic); FICalc withdraws at the
   start of the year.

Separately, two GitHub Actions workflows both deploy to Pages on every push to
`main`, causing duplicate/racing jobs.

## Decisions

- **Data:** Damodaran NYU Stern 1928–2024 — S&P 500 total return + 10-yr Treasury
  total return, converted to real via annual-average CPI. Verified: equity 6.71% real
  geometric (σ 19.5%), bond 1.43% real geometric (σ 8.4%).
- **Withdrawal timing:** switch globally to start-of-year (single convention, no toggle).
- **MC reconciliation:** document-only (UI note); MC stays slider-driven.
- **Sequential:** new `historical_sequence` method, recommended default historical mode;
  `historical_bootstrap` retained as a comparison option.

## Changes

### A. `data.js`
Two index-aligned real-return arrays (`HIST_EQ_RETURNS`, `HIST_BOND_RETURNS`) plus
`HIST_START_YEAR`, `HIST_EQ_MEAN`, `HIST_BOND_MEAN`. Index alignment preserves
within-year stock/bond co-movement.

### B. `rng.js`
Return generators yield a per-year pair `{ eqReal, bondReal }`:
- `makeGauss`: `eqReal ~ Normal(mean, σ)`, `bondReal` = flat `bondReturnReal`.
- `makeHistoricalSequenceRng(start)`: `EQ[idx]`, `BOND[idx]`.
- `makeHistRng`: sample one year `j`, return both `EQ[j]` and `BOND[j]`.

### C. `simulation.js`
- Start-of-year withdrawal: `portfolio = max(portfolio + income − spending, 0) * (1 + portRet)`;
  depletion when net pre-growth balance hits 0.
- `portRet = eqFrac*eqReal + (1−eqFrac)*bondReal`, both from the generator.
- `methodLabel` gains `historical_sequence`.

### D. `runMonteCarlo`
For `historical_sequence`: one path per valid start year (overlapping windows),
survival + percentiles computed across cohorts — so the headline number matches the
existing cohort chart. Other methods unchanged.

### E. UI (`ui.js`, `index.html`)
Add `historical_sequence` to `SIMULATION_METHODS`, the `<select>`, and tooltips.
Add a note that Monte Carlo uses the nominal-return sliders while Historical modes
use the dataset.

### F. CI
Delete `.github/workflows/pages.yml` (uploads raw repo root, no build). Keep `deploy.yml`.

### G. Test
`test/benchmark.mjs` + `npm test`: pin sequential 4%/30yr survival to an expected band
and assert the `historical_sequence` headline equals the cohort-chart survival.

## Invariants preserved

Pure simulation (no DOM in `simulation.js`/`rng.js`); shared `cfg` singleton; YAML
round-trip; `PROFILE_STORAGE_KEY` unchanged.
