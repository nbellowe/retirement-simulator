import { makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng } from './rng.js';
import { HIST_EQ_RETURNS, HIST_EQ_MEAN } from './data.js';
import { DEFAULT } from './config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────────────────────────────────────
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hasSpouse(c) {
  return c.hasSpouse === true;
}

function strategyLabel(value) {
  const labels = {
    constant_dollar: 'Constant dollar',
    percent_portfolio: 'Percent of portfolio',
    one_over_n: '1/N remaining years',
    guardrails: 'Guardrails',
    guyton_klinger: 'Guyton-Klinger',
    vanguard_dynamic: 'Vanguard dynamic',
  };
  return labels[value] ?? 'Constant dollar';
}

function methodLabel(value) {
  const labels = {
    monte_carlo: 'Monte Carlo',
    historical_bootstrap: 'Historical bootstrap',
    deterministic: 'Deterministic',
  };
  return labels[value] ?? 'Monte Carlo';
}

function retirementCoreSpending(c, y, income, portfolio, baseRetSpend, previousCore, previousReturn) {
  const strategy = c.withdrawalStrategy ?? 'constant_dollar';
  const floor = baseRetSpend * c.spendingFloor;
  const ceiling = baseRetSpend * c.spendingCeiling;
  let core = baseRetSpend;

  if (strategy === 'percent_portfolio') {
    core = income + portfolio * c.withdrawalRate;
  } else if (strategy === 'one_over_n') {
    const yearsLeft = Math.max(1, c.years - y);
    core = income + portfolio / yearsLeft;
  } else if (strategy === 'guardrails') {
    const netDraw = Math.max(0, baseRetSpend - income);
    const wRate = portfolio > 1 ? netDraw / portfolio : Infinity;
    if (wRate > c.upperGuardrail) {
      core = baseRetSpend * (1 - c.guardrailCut);
    } else if (wRate < c.lowerGuardrail) {
      core = baseRetSpend * (1 + c.guardrailCut);
    }
  } else if (strategy === 'guyton_klinger') {
    const previous = previousCore ?? baseRetSpend;
    let candidate = previousCore == null ? baseRetSpend : previous * (1 + c.spendingGrowthReal);
    const candidateRate = portfolio > 1 ? Math.max(0, candidate - income) / portfolio : Infinity;
    if (previousCore != null && previousReturn < 0 && candidateRate > c.withdrawalRate) {
      candidate = previous;
    }

    const rate = portfolio > 1 ? Math.max(0, candidate - income) / portfolio : Infinity;
    const capitalPreservationActive = c.years - y > c.gkSunsetYears;
    if (capitalPreservationActive && rate > c.withdrawalRate * c.gkCapitalPreservation) {
      core = candidate * (1 - c.gkAdjustment);
    } else if (rate < c.withdrawalRate * c.gkProsperity) {
      core = candidate * (1 + c.gkAdjustment);
    } else {
      core = candidate;
    }
  } else if (strategy === 'vanguard_dynamic') {
    const target = income + portfolio * c.withdrawalRate;
    const previous = previousCore ?? baseRetSpend;
    const annualFloor = previous * (1 + c.dynamicSpendingFloor);
    const annualCeiling = previous * (1 + c.dynamicSpendingCeiling);
    core = clamp(target, annualFloor, annualCeiling);
  }

  return clamp(core, floor, ceiling);
}

function simulateOne(c, gauss) {
  let portfolio = c.portfolioTotal;
  const path = [];
  let previousRetirementCore = null;
  let previousPortfolioReturn = 0;

  for (let y = 0; y < c.years; y++) {
    const ageN = c.nathanAge + y;
    const ageT = c.tanyaAge + y;
    const nRet = ageN >= c.retireNathanAge;
    const tRet = !hasSpouse(c) || ageT >= c.retireTanyaAge;
    const bothRet = nRet && tRet;

    // ── Income ──────────────────────────────────────────────────────────────
    let income = 0;
    if (!nRet) {
      const sal = c.nathanSalaryBase * Math.pow(1 + c.incomeGrowthReal, y);
      const rsu = c.nathanRsuAnnual * Math.min(1, (y + 1) / c.rsuVestingYears);
      income += (sal + rsu) * (1 - c.effectiveIncomeTax);
    }
    if (hasSpouse(c) && !tRet) {
      const sal = c.tanyaSalaryBase * Math.pow(1 + c.incomeGrowthReal, y);
      const rsu = c.tanyaRsuAnnual * Math.min(1, (y + 1) / c.rsuVestingYears);
      income += (sal + rsu) * (1 - c.effectiveIncomeTax);
    }
    // Social Security
    const ssN = c.ssNathanAnnual * c.ssReductionFactor;
    const ssT = c.ssTanyaAnnual * c.ssReductionFactor;
    if (ageN >= c.ssClaimAge) income += ssN;
    if (hasSpouse(c) && ageT >= c.ssClaimAge) income += ssT;

    // ── Spending ────────────────────────────────────────────────────────────
    const spendMult = Math.pow(1 + c.spendingGrowthReal, y);
    let spending;
    let retirementBase = 0;
    let retirementCore = null;
    let lifestyleRatio = null;
    let withdrawalRate = null;
    if (bothRet) {
      const baseRetSpend = c.baseSpending * c.retirementSpendingFraction * spendMult;
      const core = retirementCoreSpending(
        c,
        y,
        income,
        portfolio,
        baseRetSpend,
        previousRetirementCore,
        previousPortfolioReturn
      );
      previousRetirementCore = core;
      retirementBase = baseRetSpend;
      retirementCore = core;
      lifestyleRatio = baseRetSpend > 0 ? core / baseRetSpend : 1;
      withdrawalRate = portfolio > 1 ? Math.max(0, core - income) / portfolio : Infinity;
      spending = core;
      if (ageN < c.medicareAge) spending += c.healthcareAnnual;
    } else {
      spending = c.baseSpending * spendMult;
      previousRetirementCore = null;
    }

    // Kids
    for (let k = 0; k < c.numKids; k++) {
      const kidAge = y - (c.firstKidYear + k * 2);
      if (kidAge >= 0 && kidAge <= 4)    spending += c.childcareAnnual;
      else if (kidAge >= 5 && kidAge <= 17) spending += c.k12Annual;
      if (kidAge === 18)                 spending += c.collegeContribution;
    }

    // House upgrade one-time hit
    if (c.upgradeHouse && y === c.upgradeYear) spending += c.upgradeAdditionalCost;

    // ── Portfolio return ─────────────────────────────────────────────────────
    const eqFrac  = bothRet ? c.equityFractionRetired : c.equityFractionWorking;
    const eqRet   = gauss(c.equityReturnReal, c.equityStd);  // real; gauss handles MC vs historical
    const portRet = eqFrac * eqRet + (1 - eqFrac) * c.bondReturnReal;
    previousPortfolioReturn = portRet;

    portfolio = Math.max(portfolio * (1 + portRet) + income - spending, 0);

    path.push({ year: y + 1, age: ageN, ageT, portfolio, income, spending,
                savings: income - spending, retired: bothRet, retirementBase,
                retirementCore, lifestyleRatio, withdrawalRate });

    if (portfolio === 0 && bothRet) {
      for (let yy = y + 1; yy < c.years; yy++) {
        const aN = c.nathanAge + yy;
        path.push({ year: yy + 1, age: aN, ageT: c.tanyaAge + yy,
                    portfolio: 0, income: 0, spending: 0, savings: 0, retired: true,
                    retirementBase: 0, retirementCore: 0, lifestyleRatio: 0,
                    withdrawalRate: Infinity });
      }
      break;
    }
  }

  return path;
}

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(Math.floor(p * s.length), s.length - 1)] ?? 0;
}

function runMonteCarlo(c, options = {}) {
  // Resolve nominal → real returns once before simulation
  const method = c.simulationMethod ?? 'monte_carlo';
  const eqReal   = method === 'historical_bootstrap' ? HIST_EQ_MEAN : (c.equityReturnNominal - c.inflation);
  const bdReal   = c.bondReturnNominal - c.inflation;
  const rc = { ...c, equityReturnReal: eqReal, bondReturnReal: bdReal };

  const detRng = (mu) => mu;  // always returns expected value for median path
  const medianPath = simulateOne(rc, detRng);
  const allPaths = method === 'deterministic' ? [medianPath] : [];
  const runCount = Math.max(1, Math.round(options.mcRuns ?? rc.mcRuns));
  for (let i = 0; i < runCount && method !== 'deterministic'; i++) {
    const rng = method === 'historical_bootstrap' ? makeHistRng(i * 997 + 42) : makeGauss(i * 997 + 42);
    allPaths.push(simulateOne(rc, rng));
  }

  const survive = allPaths.filter(p => p[p.length - 1].portfolio > 0).length / allPaths.length;

  const percs = Array.from({ length: c.years }, (_, t) => {
    const vals = allPaths.map(p => p[t]?.portfolio ?? 0);
    return {
      age: c.nathanAge + t,
      p10: pct(vals, 0.10), p25: pct(vals, 0.25), p50: pct(vals, 0.50),
      p75: pct(vals, 0.75), p90: pct(vals, 0.90),
    };
  });

  const retireIdx = Math.max(0, Math.min(c.retireNathanAge - c.nathanAge, c.years - 1));
  const age70idx  = Math.max(0, Math.min(70 - c.nathanAge, c.years - 1));
  const required  = c.baseSpending * c.retirementSpendingFraction / c.swr;
  const fireEntry = medianPath.find(y => y.retired && y.portfolio >= required);
  const finalVals = allPaths.map(p => p[p.length - 1].portfolio);

  return { survival: survive, medianPath, percs,
           portAtRetire: percs[retireIdx], portAt70: percs[age70idx],
           required, fireEntry, finalVals, allPaths, runCount: allPaths.length };
}

export { clamp, hasSpouse, strategyLabel, methodLabel, retirementCoreSpending, simulateOne, pct, runMonteCarlo };
