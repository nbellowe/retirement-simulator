import { HIST_EQ_RETURNS, HIST_BOND_RETURNS } from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// RNG — Mulberry32 seeded PRNG + Marsaglia polar for normal distribution
//
// Return generators all share one interface: they are called once per simulated
// year as gen(eqMu, eqSigma, bondReal) and return a paired real return
// { eqReal, bondReal }. Equity and bond returns are kept together so historical
// modes preserve within-year stock/bond co-movement.
// ─────────────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Monte Carlo: equity ~ Normal(mu, sigma); bonds held flat at bondReal.
function makeGauss(seed) {
  const rand = mulberry32(seed);
  let spare = null;
  const normal = (mu, sigma) => {
    if (spare !== null) { const v = spare; spare = null; return mu + sigma * v; }
    let u, v, s;
    do { u = rand() * 2 - 1; v = rand() * 2 - 1; s = u * u + v * v; }
    while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * m;
    return mu + sigma * (u * m);
  };
  return function(eqMu, eqSigma, bondReal) {
    return { eqReal: normal(eqMu, eqSigma), bondReal };
  };
}

// Deterministic generator: returns expected values (used for the median path).
function detGauss(eqMu, _eqSigma, bondReal) {
  return { eqReal: eqMu, bondReal };
}

// Bootstrap: sample one historical year and return BOTH its stock and bond return.
function makeHistRng(seed) {
  const rand = mulberry32(seed);
  return function(_eqMu, _eqSigma, _bondReal) {
    const j = Math.floor(rand() * HIST_EQ_RETURNS.length);
    return { eqReal: HIST_EQ_RETURNS[j], bondReal: HIST_BOND_RETURNS[j] };
  };
}

// Sequential replay: walk consecutive historical years from startIndex.
function makeHistoricalSequenceRng(startIndex) {
  let yearOffset = 0;
  return function(_eqMu, _eqSigma, _bondReal) {
    const idx = Math.min(startIndex + yearOffset, HIST_EQ_RETURNS.length - 1);
    yearOffset += 1;
    return { eqReal: HIST_EQ_RETURNS[idx], bondReal: HIST_BOND_RETURNS[idx] };
  };
}

export { mulberry32, makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng };
