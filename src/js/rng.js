import { HIST_EQ_RETURNS, HIST_START_YEAR, HIST_END_YEAR, HIST_EQ_MEAN } from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// RNG — Mulberry32 seeded PRNG + Marsaglia polar for normal distribution
// ─────────────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGauss(seed) {
  const rand = mulberry32(seed);
  let spare = null;
  return function gauss(mu, sigma) {
    if (spare !== null) { const v = spare; spare = null; return mu + sigma * v; }
    let u, v, s;
    do { u = rand() * 2 - 1; v = rand() * 2 - 1; s = u * u + v * v; }
    while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * m;
    return mu + sigma * (u * m);
  };
}

// Deterministic "gauss" that always returns mu (used for median path)
function detGauss(mu) { return mu; }

function makeHistRng(seed) {
  const rand = mulberry32(seed);
  // ignores mu/sigma — samples from historical return table
  return function(_mu, _sigma) {
    return HIST_EQ_RETURNS[Math.floor(rand() * HIST_EQ_RETURNS.length)];
  };
}

function makeHistoricalSequenceRng(startIndex) {
  let yearOffset = 0;
  return function(_mu, _sigma) {
    const idx = Math.min(startIndex + yearOffset, HIST_EQ_RETURNS.length - 1);
    yearOffset += 1;
    return HIST_EQ_RETURNS[idx];
  };
}

export { mulberry32, makeGauss, detGauss, makeHistRng, makeHistoricalSequenceRng };
