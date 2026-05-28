import Chart from 'chart.js/auto';
import { cfg, DEFAULT, MONARCH_META } from './config.js';
import { HIST_EQ_RETURNS, HIST_START_YEAR, HIST_EQ_MEAN } from './data.js';
import { clamp, hasSpouse, pct, strategyLabel, methodLabel, simulateOne, runMonteCarlo } from './simulation.js';
import { makeHistoricalSequenceRng } from './rng.js';

function fmtM(v) {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6)   return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3)   return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function survivalColor(s) {
  if (s >= 0.90) return 'var(--success)';
  if (s >= 0.70) return 'var(--warn)';
  return 'var(--danger)';
}

function primaryName() {
  return (cfg.person1Name || MONARCH_META.person1Name || 'Person 1').trim();
}

function spouseName() {
  return (cfg.person2Name || MONARCH_META.person2Name || 'Person 2').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart state
// ─────────────────────────────────────────────────────────────────────────────
let portfolioChart = null, cashflowChart = null, distChart = null;
let cohortChart = null, lifestyleChart = null;

const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TEXT_COLOR  = '#8b949e';
const ACCENT      = '#a78bfa';
const ACCENT_DARK = '#7c3aed';
const INCOME_CLR  = '#3fb950';
const SPEND_CLR   = '#f85149';
const WARN_CLR    = '#d29922';

const HEATMAP_OFFSETS = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
const HEATMAP_SPEND_FACTORS = [1.20, 1.10, 1.00, 0.90, 0.80, 0.70];
const HEATMAP_MIN_RUNS = 60;
const HEATMAP_MAX_RUNS = 160;

function baseChartOpts(yFmt) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#8b949e',
        padding: 10,
      },
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxTicksLimit: 12 } },
      y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, callback: yFmt } },
    },
  };
}

function mixRgb(a, b, t) {
  const clamped = clamp(t, 0, 1);
  return a.map((v, i) => Math.round(v + (b[i] - v) * clamped));
}

function survivalCellColor(s) {
  const red = [248, 81, 73];
  const amber = [210, 153, 34];
  const green = [63, 185, 80];
  const rgb = s < 0.70
    ? mixRgb(red, amber, s / 0.70)
    : mixRgb(amber, green, (s - 0.70) / 0.30);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function summaryPill(label, value) {
  return `
    <div class="summary-pill">
      <div class="summary-pill-label">${label}</div>
      <div class="summary-pill-value">${value}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric cards
// ─────────────────────────────────────────────────────────────────────────────
function updateMetrics(stats) {
  const s   = stats.survival;
  const mEl = document.getElementById('m-survival');
  mEl.textContent = `${Math.round(s * 100)}%`;
  mEl.style.color = survivalColor(s);

  document.getElementById('m-port-retire').textContent = fmtM(stats.portAtRetire?.p50);
  document.getElementById('m-port-70').textContent     = fmtM(stats.portAt70?.p50);
  document.getElementById('m-required').textContent    = fmtM(stats.required);

  const fe = stats.fireEntry;
  if (fe) {
    document.getElementById('m-fire').textContent = `Age ${fe.age}`;
  } else if (cfg.retireNathanAge <= cfg.nathanAge) {
    document.getElementById('m-fire').textContent = 'Now!';
  } else {
    document.getElementById('m-fire').textContent = 'Already!';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio trajectory chart
// ─────────────────────────────────────────────────────────────────────────────
function updatePortfolioChart(stats) {
  const labels = stats.percs.map(p => p.age);
  const retireAge = cfg.retireNathanAge;
  const ssAge = cfg.ssClaimAge;

  // Vertical annotation lines as extra datasets (hairline single-point lines are hacky;
  // instead we'll draw them in afterDraw plugin)
  const datasets = [
    // P10 (anchor for outer band fill)
    { label: 'P10', data: stats.percs.map(p => p.p10),
      borderColor: 'transparent', pointRadius: 0, tension: 0.3, fill: false },
    // P90 fills toward P10
    { label: 'P90', data: stats.percs.map(p => p.p90),
      borderColor: 'transparent', pointRadius: 0, tension: 0.3,
      fill: { target: 0, above: 'rgba(124,58,237,0.12)', below: 'transparent' },
      backgroundColor: 'rgba(124,58,237,0.12)' },
    // P25 anchor for inner band
    { label: 'P25', data: stats.percs.map(p => p.p25),
      borderColor: 'transparent', pointRadius: 0, tension: 0.3, fill: false },
    // P75 fills toward P25
    { label: 'P75', data: stats.percs.map(p => p.p75),
      borderColor: 'transparent', pointRadius: 0, tension: 0.3,
      fill: { target: 2, above: 'rgba(124,58,237,0.28)', below: 'transparent' },
      backgroundColor: 'rgba(124,58,237,0.28)' },
    // P50 median — bright line
    { label: 'Median', data: stats.percs.map(p => p.p50),
      borderColor: ACCENT, borderWidth: 2.5, pointRadius: 0, tension: 0.3,
      fill: false, backgroundColor: 'transparent' },
  ];

  const verticalLinesPlugin = {
    id: 'vertLines',
    afterDraw(chart) {
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
      const lines = [
        { age: retireAge, color: '#d29922', label: `Retire ${retireAge}` },
        { age: ssAge, color: '#60a5fa', label: `SS ${ssAge}` },
      ];
      ctx.save();
      lines.forEach(({ age, color, label }) => {
        const xi = labels.indexOf(age);
        if (xi < 0) return;
        const xPx = x.getPixelForValue(xi);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(xPx, top); ctx.lineTo(xPx, bottom);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(label, xPx + 4, top + 14);
      });
      ctx.restore();
    },
  };

  const opts = {
    ...baseChartOpts(v => fmtM(v)),
    plugins: {
      ...baseChartOpts().plugins,
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1,
        titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
        filter: item => !['P10','P25'].includes(item.dataset.label),
        callbacks: {
          title: items => `${primaryName()} age ${labels[items[0].dataIndex]}`,
          label: item => {
            const d = item.dataset.label;
            const v = item.raw;
            return `${d}: ${fmtM(v)}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxTicksLimit: 14,
             callback: (_, i) => labels[i] } },
      y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, callback: v => fmtM(v) } },
    },
  };

  if (portfolioChart) {
    portfolioChart.data.labels  = labels;
    portfolioChart.data.datasets = datasets;
    portfolioChart.update('none');
  } else {
    const ctx = document.getElementById('portfolio-chart').getContext('2d');
    portfolioChart = new Chart(ctx, {
      type: 'line', data: { labels, datasets }, options: opts,
      plugins: [verticalLinesPlugin],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feasibility heatmap
// ─────────────────────────────────────────────────────────────────────────────
function heatmapRunCount() {
  if (cfg.simulationMethod === 'deterministic') return 1;
  return Math.min(
    HEATMAP_MAX_RUNS,
    Math.max(HEATMAP_MIN_RUNS, Math.round((cfg.mcRuns ?? DEFAULT.mcRuns) / 3))
  );
}

function heatmapAges() {
  const horizonMax = cfg.nathanAge + cfg.years - 1;
  const ages = new Set();
  HEATMAP_OFFSETS.forEach(offset => {
    ages.add(Math.round(clamp(cfg.retireNathanAge + offset, cfg.nathanAge, horizonMax)));
  });
  ages.add(cfg.retireNathanAge);
  return [...ages].sort((a, b) => a - b);
}

function heatmapSpendingLevels() {
  const currentRetirementSpend = cfg.baseSpending * cfg.retirementSpendingFraction;
  return HEATMAP_SPEND_FACTORS.map(factor => {
    const targetAnnual = currentRetirementSpend * factor;
    const fraction = clamp(targetAnnual / Math.max(1, cfg.baseSpending), 0.50, 1.30);
    return {
      factor,
      fraction,
      annual: cfg.baseSpending * fraction,
    };
  });
}

function updateFeasibilityHeatmap() {
  const shell = document.getElementById('feasibility-heatmap');
  if (!shell) return;

  const ages = heatmapAges();
  const spendingLevels = heatmapSpendingLevels();
  const runs = heatmapRunCount();
  const spouseOffset = cfg.retireTanyaAge - cfg.retireNathanAge;

  const rows = spendingLevels.map(level => {
    const cells = ages.map(age => {
      const candidate = {
        ...cfg,
        retireNathanAge: age,
        retireTanyaAge: hasSpouse(cfg) ? Math.max(cfg.tanyaAge, age + spouseOffset) : age,
        retirementSpendingFraction: level.fraction,
        mcRuns: runs,
      };
      const stats = runMonteCarlo(candidate, { mcRuns: runs });
      return {
        age,
        level,
        survival: stats.survival,
        retirePortfolio: stats.portAtRetire?.p50 ?? 0,
      };
    });
    return { level, cells };
  });

  const isCurrentCell = (cell) =>
    cell.age === cfg.retireNathanAge && Math.abs(cell.level.factor - 1) < 0.001;

  const header = `
    <div class="heatmap-corner">Spend / retire age</div>
    ${ages.map(age => `<div class="heatmap-col-label">Age ${age}</div>`).join('')}
  `;

  const body = rows.map(row => `
    <div class="heatmap-row-label">${fmtM(row.level.annual)} / yr</div>
    ${row.cells.map(cell => {
      const pctValue = Math.round(cell.survival * 100);
      const title = [
        `Retire at ${cell.age}`,
        `Retirement spend ${fmtM(cell.level.annual)} / year`,
        `Survival ${pctValue}%`,
        `Median at retirement ${fmtM(cell.retirePortfolio)}`,
      ].join(' | ');
      return `
        <div
          class="heatmap-cell ${isCurrentCell(cell) ? 'current' : ''}"
          style="background:${survivalCellColor(cell.survival)};color:${cell.survival < 0.42 ? '#fff' : '#0d1117'}"
          title="${title}"
          aria-label="${title}"
        >${pctValue}%</div>
      `;
    }).join('')}
  `).join('');

  shell.innerHTML = `
    <div class="heatmap-grid" style="--cols:${ages.length}">
      ${header}
      ${body}
    </div>
  `;

  const sub = document.getElementById('feasibility-sub');
  if (sub) {
    sub.textContent = `${methodLabel(cfg.simulationMethod)} survival probability, ${runs} run${runs === 1 ? '' : 's'} per cell`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical cohort replay
// ─────────────────────────────────────────────────────────────────────────────
function runHistoricalCohorts(c) {
  const years = Math.min(c.years, HIST_EQ_RETURNS.length);
  const lastStartIndex = Math.max(0, HIST_EQ_RETURNS.length - years);
  const bdReal = c.bondReturnNominal - c.inflation;
  const rc = {
    ...c,
    years,
    equityReturnReal: HIST_EQ_MEAN,
    bondReturnReal: bdReal,
  };

  return Array.from({ length: lastStartIndex + 1 }, (_, startIndex) => {
    const path = simulateOne(rc, makeHistoricalSequenceRng(startIndex));
    const final = path[path.length - 1]?.portfolio ?? 0;
    return {
      startIndex,
      startYear: HIST_START_YEAR + startIndex,
      endYear: HIST_START_YEAR + startIndex + years - 1,
      path,
      final,
      survived: final > 0,
    };
  });
}

function depletionAge(path) {
  const depleted = path.find(p => p.retired && p.portfolio <= 0);
  return depleted?.age ?? null;
}

function updateHistoricalCohortChart() {
  const cohorts = runHistoricalCohorts(cfg);
  const summary = document.getElementById('cohort-summary');
  const sub = document.getElementById('cohort-sub');

  if (!cohorts.length) {
    if (summary) summary.innerHTML = '<div class="empty-state">No historical cohorts available for this horizon.</div>';
    return;
  }

  const sorted = [...cohorts].sort((a, b) => a.final - b.final);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const survival = cohorts.filter(c => c.survived).length / cohorts.length;
  const lastStartYear = cohorts[cohorts.length - 1].startYear;

  if (sub) {
    sub.textContent = `${cohorts.length} start years, ${HIST_START_YEAR}-${lastStartYear}, replayed through ${Math.min(cfg.years, HIST_EQ_RETURNS.length)} years`;
  }
  if (summary) {
    const worstAge = depletionAge(worst.path);
    summary.innerHTML = [
      summaryPill('Cohort survival', `${Math.round(survival * 100)}%`),
      summaryPill('Worst start', `${worst.startYear}${worstAge ? `, age ${worstAge}` : ''}`),
      summaryPill('Median final', fmtM(median.final)),
      summaryPill('Best start', `${best.startYear}, ${fmtM(best.final)}`),
    ].join('');
  }

  const labels = cohorts[0].path.map(p => p.age);
  const highlighted = new Map([
    [worst.startYear, { color: SPEND_CLR, width: 2.8, label: `${worst.startYear} worst` }],
    [median.startYear, { color: ACCENT, width: 2.4, label: `${median.startYear} median` }],
    [best.startYear, { color: INCOME_CLR, width: 2.8, label: `${best.startYear} best` }],
  ]);

  const datasets = [
    ...cohorts
      .filter(cohort => !highlighted.has(cohort.startYear))
      .map(cohort => ({
        label: String(cohort.startYear),
        data: cohort.path.map(p => p.portfolio),
        borderColor: 'rgba(139,148,158,0.20)',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.18,
      })),
    ...cohorts
      .filter(cohort => highlighted.has(cohort.startYear))
      .map(cohort => {
        const style = highlighted.get(cohort.startYear);
        return {
          label: style.label,
          data: cohort.path.map(p => p.portfolio),
          borderColor: style.color,
          borderWidth: style.width,
          pointRadius: 0,
          tension: 0.18,
        };
      }),
  ];

  const cohortByLabel = new Map(cohorts.map(cohort => [String(cohort.startYear), cohort]));
  highlighted.forEach((_, startYear) => {
    const cohort = cohortByLabel.get(String(startYear));
    if (cohort) cohortByLabel.set(`${startYear} ${highlighted.get(startYear).label.split(' ')[1]}`, cohort);
  });

  const opts = {
    ...baseChartOpts(v => fmtM(v)),
    plugins: {
      legend: { display: true, labels: { color: TEXT_COLOR, boxWidth: 18, padding: 12, font: { size: 11 },
        filter: item => item.text.includes('worst') || item.text.includes('median') || item.text.includes('best') } },
      tooltip: {
        backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1,
        titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
        callbacks: {
          title: items => `${primaryName()} age ${labels[items[0].dataIndex]}`,
          label: item => {
            const startYear = String(item.dataset.label).split(' ')[0];
            const cohort = cohortByLabel.get(startYear);
            const final = cohort ? `, final ${fmtM(cohort.final)}` : '';
            return `${item.dataset.label}: ${fmtM(item.raw)}${final}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxTicksLimit: 14,
             callback: (_, i) => labels[i] } },
      y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, callback: v => fmtM(v) } },
    },
  };

  const data = { labels, datasets };
  if (cohortChart) {
    cohortChart.data = data;
    cohortChart.options = opts;
    cohortChart.update('none');
  } else {
    const ctx = document.getElementById('cohort-chart').getContext('2d');
    cohortChart = new Chart(ctx, { type: 'line', data, options: opts });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail lifestyle variability
// ─────────────────────────────────────────────────────────────────────────────
function lifestyleSeries(stats) {
  return Array.from({ length: cfg.years }, (_, t) => {
    const vals = stats.allPaths
      .map(path => path[t]?.lifestyleRatio)
      .filter(v => Number.isFinite(v));
    if (!vals.length) return null;
    return {
      age: cfg.nathanAge + t,
      p10: pct(vals, 0.10), p25: pct(vals, 0.25), p50: pct(vals, 0.50),
      p75: pct(vals, 0.75), p90: pct(vals, 0.90),
    };
  }).filter(Boolean);
}

function lifestylePathStats(stats) {
  return stats.allPaths.map(path => {
    const retired = path.filter(p => p.retired && Number.isFinite(p.lifestyleRatio));
    if (!retired.length) return null;
    const ratios = retired.map(p => p.lifestyleRatio);
    return {
      cutYears: ratios.filter(v => v < 0.995).length,
      raiseYears: ratios.filter(v => v > 1.005).length,
      floorYears: ratios.filter(v => v <= cfg.spendingFloor + 0.005).length,
      minRatio: Math.min(...ratios),
    };
  }).filter(Boolean);
}

function updateLifestyleChart(stats) {
  const summary = document.getElementById('lifestyle-summary');
  const sub = document.getElementById('lifestyle-sub');
  const analysisStats = cfg.withdrawalStrategy === 'guardrails'
    ? stats
    : runMonteCarlo({ ...cfg, withdrawalStrategy: 'guardrails' });
  const series = lifestyleSeries(analysisStats);
  const pathStats = lifestylePathStats(analysisStats);

  if (sub) {
    sub.textContent = cfg.withdrawalStrategy === 'guardrails'
      ? 'Guardrail-adjusted lifestyle spending as share of baseline retirement budget'
      : `Guardrails applied to current plan; selected strategy remains ${strategyLabel(cfg.withdrawalStrategy)}`;
  }

  if (!series.length || !pathStats.length) {
    if (summary) summary.innerHTML = '<div class="empty-state">No retired years fall inside this simulation horizon.</div>';
    if (lifestyleChart) {
      lifestyleChart.destroy();
      lifestyleChart = null;
    }
    return;
  }

  const cutChance = pathStats.filter(p => p.cutYears > 0).length / pathStats.length;
  const cutYears = pathStats.map(p => p.cutYears);
  const raiseYears = pathStats.map(p => p.raiseYears);
  const floorYears = pathStats.map(p => p.floorYears);
  const minRatios = pathStats.map(p => p.minRatio);

  if (summary) {
    summary.innerHTML = [
      summaryPill('Chance of cuts', `${Math.round(cutChance * 100)}%`),
      summaryPill('Median cut years', `${Math.round(pct(cutYears, 0.50))}`),
      summaryPill('P10 lowest spend', `${Math.round(pct(minRatios, 0.10) * 100)}%`),
      summaryPill('P90 floor/depleted', `${Math.round(pct(floorYears, 0.90))}`),
      summaryPill('Median raise years', `${Math.round(pct(raiseYears, 0.50))}`),
    ].join('');
  }

  const labels = series.map(p => p.age);
  const datasets = [
    { label: 'P10', data: series.map(p => p.p10),
      borderColor: 'transparent', pointRadius: 0, tension: 0.25, fill: false },
    { label: 'P90', data: series.map(p => p.p90),
      borderColor: 'transparent', pointRadius: 0, tension: 0.25,
      fill: { target: 0, above: 'rgba(63,185,80,0.11)', below: 'transparent' },
      backgroundColor: 'rgba(63,185,80,0.11)' },
    { label: 'P25', data: series.map(p => p.p25),
      borderColor: 'transparent', pointRadius: 0, tension: 0.25, fill: false },
    { label: 'P75', data: series.map(p => p.p75),
      borderColor: 'transparent', pointRadius: 0, tension: 0.25,
      fill: { target: 2, above: 'rgba(63,185,80,0.25)', below: 'transparent' },
      backgroundColor: 'rgba(63,185,80,0.25)' },
    { label: 'Median', data: series.map(p => p.p50),
      borderColor: INCOME_CLR, borderWidth: 2.5, pointRadius: 0, tension: 0.25 },
    { label: 'Baseline', data: series.map(() => 1),
      borderColor: WARN_CLR, borderWidth: 1.5, pointRadius: 0, tension: 0,
      borderDash: [4, 4] },
  ];

  const opts = {
    ...baseChartOpts(v => `${Math.round(v * 100)}%`),
    plugins: {
      legend: { display: true, labels: { color: TEXT_COLOR, boxWidth: 12, padding: 14, font: { size: 11 },
        filter: item => !['P10','P25'].includes(item.text) } },
      tooltip: {
        backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1,
        titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
        filter: item => !['P10','P25'].includes(item.dataset.label),
        callbacks: {
          title: items => `${primaryName()} age ${labels[items[0].dataIndex]}`,
          label: item => `${item.dataset.label}: ${Math.round(item.raw * 100)}%`,
        },
      },
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxTicksLimit: 14,
             callback: (_, i) => labels[i] } },
      y: { min: 0, grid: { color: GRID_COLOR },
           ticks: { color: TEXT_COLOR, callback: v => `${Math.round(v * 100)}%` } },
    },
  };

  const data = { labels, datasets };
  if (lifestyleChart) {
    lifestyleChart.data = data;
    lifestyleChart.options = opts;
    lifestyleChart.update('none');
  } else {
    const ctx = document.getElementById('lifestyle-chart').getContext('2d');
    lifestyleChart = new Chart(ctx, { type: 'line', data, options: opts });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cashflow chart
// ─────────────────────────────────────────────────────────────────────────────
function updateCashflowChart(medianPath) {
  const path = medianPath.filter((_, i) => i % 2 === 0);
  const labels = path.map(p => p.age);
  const datasets = [
    { label: 'Income', data: path.map(p => p.income), type: 'bar',
      backgroundColor: 'rgba(63,185,80,0.7)', borderColor: INCOME_CLR, borderWidth: 1, borderRadius: 3 },
    { label: 'Spending', data: path.map(p => p.spending), type: 'bar',
      backgroundColor: 'rgba(248,81,73,0.7)', borderColor: SPEND_CLR, borderWidth: 1, borderRadius: 3 },
    { label: 'Net savings', data: path.map(p => p.savings), type: 'line',
      borderColor: '#60a5fa', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y' },
  ];

  const retireLine = {
    id: 'retireLine',
    afterDraw(chart) {
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
      const retireIdx = labels.indexOf(cfg.retireNathanAge);
      if (retireIdx < 0) return;
      const xPx = x.getPixelForValue(retireIdx);
      ctx.save();
      ctx.beginPath(); ctx.strokeStyle = '#d29922';
      ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.moveTo(xPx, top); ctx.lineTo(xPx, bottom); ctx.stroke();
      ctx.fillStyle = '#d29922'; ctx.font = '10px sans-serif';
      ctx.fillText('Retire', xPx + 4, top + 14);
      ctx.restore();
    },
  };

  const opts = {
    ...baseChartOpts(v => fmtM(v)),
    plugins: {
      legend: { display: true, labels: { color: TEXT_COLOR, boxWidth: 12, padding: 16, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1,
        titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
        callbacks: {
          title: items => `${primaryName()} age ${labels[items[0].dataIndex]}`,
          label: item => `${item.dataset.label}: ${fmtM(item.raw)}`,
        },
      },
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxTicksLimit: 12,
             callback: (_, i) => labels[i] } },
      y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, callback: v => fmtM(v) } },
    },
  };

  if (cashflowChart) {
    cashflowChart.data.labels   = labels;
    cashflowChart.data.datasets = datasets;
    cashflowChart.update('none');
  } else {
    const ctx = document.getElementById('cashflow-chart').getContext('2d');
    cashflowChart = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: opts, plugins: [retireLine] });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Distribution histogram
// ─────────────────────────────────────────────────────────────────────────────
function updateDistChart(finalVals) {
  const maxVal  = Math.max(...finalVals, 1);
  const bins    = 24;
  const binSize = maxVal / bins || 1;
  const counts  = new Array(bins).fill(0);
  finalVals.forEach(v => {
    const b = Math.min(Math.floor(v / binSize), bins - 1);
    counts[b]++;
  });
  const labels = counts.map((_, i) => fmtM((i + 0.5) * binSize));
  const colors = counts.map((_, i) => {
    const v = (i + 0.5) * binSize;
    if (v < 1e6) return 'rgba(248,81,73,0.7)';
    if (v < 5e6) return 'rgba(210,153,34,0.7)';
    return 'rgba(63,185,80,0.7)';
  });

  const data = {
    labels,
    datasets: [{
      label: 'Scenarios',
      data: counts,
      backgroundColor: colors,
      borderRadius: 3,
      borderWidth: 0,
    }],
  };

  const opts = {
    ...baseChartOpts(v => v),
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1,
        titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
        callbacks: {
          title: items => `≈ ${labels[items[0].dataIndex]}`,
          label: item => `${item.raw} of ${finalVals.length} scenarios`,
        },
      },
    },
    scales: {
      x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxTicksLimit: 8, callback: (_, i) => labels[i] } },
      y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR } },
    },
  };

  if (distChart) {
    distChart.data   = data;
    distChart.update('none');
  } else {
    const ctx = document.getElementById('dist-chart').getContext('2d');
    distChart = new Chart(ctx, { type: 'bar', data, options: opts });
  }
}

let noGuardrailsSurvival = null;

function updateGuardrailsInsight(stats) {
  const bar = document.getElementById('guardrails-insight');
  if (cfg.withdrawalStrategy !== 'guardrails') {
    noGuardrailsSurvival = stats.survival;
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');

  const noGuards = runMonteCarlo({ ...cfg, withdrawalStrategy: 'constant_dollar' });
  noGuardrailsSurvival = noGuards.survival;

  const wo = Math.round(noGuards.survival * 100);
  const wi = Math.round(stats.survival * 100);
  const diff = wi - wo;

  document.getElementById('gi-without').textContent = `${wo}%`;
  document.getElementById('gi-with').textContent    = `${wi}% ${diff > 0 ? `(+${diff}%)` : ''}`;
  document.getElementById('gi-cut').textContent     = `${Math.round(cfg.guardrailCut * 100)}%`;
  document.getElementById('gi-floor').textContent   = `${Math.round(cfg.spendingFloor * 100)}%`;
  document.getElementById('gi-with').style.color    = diff > 0 ? 'var(--success)' : 'var(--muted)';
}

export {
  fmtM, survivalColor,
  updateMetrics, updatePortfolioChart, updateCashflowChart, updateDistChart,
  updateFeasibilityHeatmap, updateHistoricalCohortChart, updateLifestyleChart,
  updateGuardrailsInsight,
};
