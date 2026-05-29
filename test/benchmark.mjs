// Regression benchmark for the simulation math. Pure Node, no DOM.
// Validates against the canonical 4%-rule / Trinity backtest and guards the
// dataset, the start-of-year withdrawal convention, and the invariant that the
// historical_sequence headline survival equals the per-cohort backtest.
//
//   node test/benchmark.mjs   (or: npm test)

import { runMonteCarlo, simulateOne } from '../src/js/simulation.js';
import { makeHistoricalSequenceRng } from '../src/js/rng.js';
import { HIST_EQ_RETURNS, HIST_BOND_RETURNS, HIST_EQ_MEAN } from '../src/js/data.js';

let failures = 0;
const p = x => (100 * x).toFixed(1) + '%';
function check(name, cond, detail) {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}
const geo = a => Math.pow(a.reduce((x, y) => x * (1 + y), 1), 1 / a.length) - 1;

// Canonical test: $1M, $40k/yr constant-dollar (4%), 30yr, retired from year 0,
// no income / SS / kids / healthcare — everything stripped but stocks, bonds, spending.
function bench(o = {}) {
  return {
    hasSpouse: false, nathanAge: 60, tanyaAge: 60, retireNathanAge: 60, retireTanyaAge: 60,
    portfolioTotal: 1e6, nathanSalaryBase: 0, tanyaSalaryBase: 0, nathanRsuAnnual: 0, tanyaRsuAnnual: 0,
    rsuVestingYears: 4, incomeGrowthReal: 0, effectiveIncomeTax: 0, baseSpending: 40000,
    spendingGrowthReal: 0, retirementSpendingFraction: 1, healthcareAnnual: 0, medicareAge: 0,
    numKids: 0, firstKidYear: 0, childcareAnnual: 0, k12Annual: 0, collegeContribution: 0,
    upgradeHouse: false, upgradeYear: 5, upgradeAdditionalCost: 0, ssNathanAnnual: 0, ssTanyaAnnual: 0,
    ssClaimAge: 999, ssReductionFactor: 1, equityReturnNominal: 0.09, equityStd: 0.17,
    bondReturnNominal: 0.04, inflation: 0.03, equityFractionWorking: 1, equityFractionRetired: 1,
    simulationMethod: 'historical_sequence', withdrawalStrategy: 'constant_dollar', withdrawalRate: 0.04,
    swr: 0.04, years: 30, mcRuns: 20000, upperGuardrail: 0.05, lowerGuardrail: 0.03, guardrailCut: 0.1,
    dynamicSpendingFloor: -0.025, dynamicSpendingCeiling: 0.05, gkCapitalPreservation: 1.2,
    gkProsperity: 0.8, gkAdjustment: 0.1, gkSunsetYears: 15, spendingFloor: 0.75, spendingCeiling: 1.2,
    ...o,
  };
}

console.log('\n— Dataset —');
check('equity & bond series index-aligned', HIST_EQ_RETURNS.length === HIST_BOND_RETURNS.length,
      `${HIST_EQ_RETURNS.length} / ${HIST_BOND_RETURNS.length} years`);
const eqGeo = geo(HIST_EQ_RETURNS), bdGeo = geo(HIST_BOND_RETURNS);
check('equity real geometric ≈ 6–7.5%', eqGeo > 0.060 && eqGeo < 0.075, p(eqGeo));
check('bond real geometric ≈ 1–2.5%', bdGeo > 0.010 && bdGeo < 0.025, p(bdGeo));

console.log('\n— 4%-rule backtest (sequential historical) —');
const seq100 = runMonteCarlo(bench({ equityFractionRetired: 1 })).survival;
const seq75 = runMonteCarlo(bench({ equityFractionRetired: 0.75 })).survival;
check('100% equity survival ≈ 90–95% (Trinity range)', seq100 >= 0.90 && seq100 <= 0.95, p(seq100));
check('75/25 survival ≈ 92–99% (canonical ~95%)', seq75 >= 0.92 && seq75 <= 0.99, p(seq75));

console.log('\n— Invariant: headline survival == per-cohort backtest —');
const cfg = bench({ equityFractionRetired: 1 });
const rc = { ...cfg, equityReturnReal: HIST_EQ_MEAN, bondReturnReal: cfg.bondReturnNominal - cfg.inflation };
const lastStart = Math.max(0, HIST_EQ_RETURNS.length - cfg.years);
let survived = 0, total = 0;
for (let s = 0; s <= lastStart; s++) {
  const path = simulateOne(rc, makeHistoricalSequenceRng(s));
  total++;
  if (path[path.length - 1].portfolio > 0) survived++;
}
const cohort = survived / total;
check('runMonteCarlo headline equals cohort survival', Math.abs(cohort - seq100) < 1e-9,
      `${p(seq100)} vs ${p(cohort)} over ${total} windows`);

console.log('\n— Start-of-year withdrawal convention —');
// 1 year, 10% real return, $1M, $40k spend, no income. Start-of-year:
// (1,000,000 − 40,000) × 1.10 = 1,056,000  (end-of-year would be 1,060,000).
const det = runMonteCarlo(bench({ simulationMethod: 'deterministic', years: 1,
  equityReturnNominal: 0.10, inflation: 0, bondReturnNominal: 0 }));
const final = det.finalVals[0];
check('withdraw-then-grow gives 1,056,000', Math.abs(final - 1_056_000) < 1,
      `got ${final.toLocaleString()}`);

console.log(`\n${failures === 0 ? 'PASS — all checks green' : `FAIL — ${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
