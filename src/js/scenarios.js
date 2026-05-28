import { cfg, DEFAULT } from './config.js';
import { hasSpouse, runMonteCarlo } from './simulation.js';
import { fmtM, survivalColor } from './charts.js';

let _onRender = () => {};
export function setOnRender(fn) { _onRender = fn; }

let _onSyncUI = () => {};
export function setSyncUICallback(fn) { _onSyncUI = fn; }

// ─────────────────────────────────────────────────────────────────────────────
// Composable quick scenarios
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIO_GROUPS = [
  {
    id: 'return-model',
    label: 'Return model',
    tooltip: 'Choose how annual returns are generated without changing any other assumptions.',
    options: [
      { label: 'Monte Carlo', tooltip: 'Randomly samples returns from the configured expected return and volatility.', cfg: { simulationMethod: 'monte_carlo' } },
      { label: 'Historical', tooltip: 'Bootstraps returns from the historical real-return table.', cfg: { simulationMethod: 'historical_bootstrap' } },
      { label: 'Deterministic', tooltip: 'Runs one expected-return path with no random variation.', cfg: { simulationMethod: 'deterministic' } },
    ],
  },
  {
    id: 'withdrawal',
    label: 'Withdrawal strategy',
    tooltip: 'Switch the retirement spending rule while leaving ages, market, and family assumptions alone.',
    options: [
      { label: 'Constant', tooltip: 'Spend the same real-dollar lifestyle amount each retired year.', cfg: { withdrawalStrategy: 'constant_dollar' } },
      { label: 'Guardrails', tooltip: 'Cut or raise spending when the withdrawal rate moves outside configured guardrails.', cfg: { withdrawalStrategy: 'guardrails' } },
      { label: 'Guyton-Klinger', tooltip: 'Use Guyton-Klinger decision rules with capital preservation and prosperity triggers.', cfg: { withdrawalStrategy: 'guyton_klinger', withdrawalRate: 0.04 } },
      { label: 'Vanguard', tooltip: 'Use Vanguard-style dynamic spending with annual raise and cut limits.', cfg: { withdrawalStrategy: 'vanguard_dynamic', withdrawalRate: 0.04 } },
      { label: 'Percent', tooltip: 'Spend a fixed percentage of the current portfolio each retired year.', cfg: { withdrawalStrategy: 'percent_portfolio', withdrawalRate: 0.04 } },
      { label: '1/N', tooltip: 'Spend portfolio divided by remaining horizon years.', cfg: { withdrawalStrategy: 'one_over_n' } },
    ],
  },
  {
    id: 'retirement-age',
    label: 'Retirement age',
    tooltip: 'Change retirement timing for both people without changing spending or market assumptions.',
    options: [
      { label: 'Profile ages', tooltip: 'Restore retirement ages from the loaded profile.', cfg: () => ({ retireNathanAge: DEFAULT.retireNathanAge, retireTanyaAge: DEFAULT.retireTanyaAge }) },
      { label: 'Retire now', tooltip: 'Set each retirement age to the current age.', cfg: () => ({ retireNathanAge: DEFAULT.nathanAge, retireTanyaAge: DEFAULT.tanyaAge }) },
      { label: '5 yrs earlier', tooltip: 'Move each retirement age five years earlier than the profile.', cfg: () => ({ retireNathanAge: DEFAULT.retireNathanAge - 5, retireTanyaAge: DEFAULT.retireTanyaAge - 5 }) },
      { label: '5 yrs later', tooltip: 'Move each retirement age five years later than the profile.', cfg: () => ({ retireNathanAge: DEFAULT.retireNathanAge + 5, retireTanyaAge: DEFAULT.retireTanyaAge + 5 }) },
    ],
  },
  {
    id: 'spending',
    label: 'Spending level',
    tooltip: 'Adjust working-year spending and retirement spending level together.',
    options: [
      { label: 'Profile spend', tooltip: 'Restore spending from the loaded profile.', cfg: () => ({ baseSpending: DEFAULT.baseSpending, retirementSpendingFraction: DEFAULT.retirementSpendingFraction }) },
      { label: 'Lean spend', tooltip: 'Reduce working spending by 15% and retirement lifestyle by 10 percentage points.', cfg: () => ({ baseSpending: DEFAULT.baseSpending * 0.85, retirementSpendingFraction: Math.max(0.5, DEFAULT.retirementSpendingFraction - 0.10) }) },
      { label: 'High spend', tooltip: 'Increase working spending by 15% and retirement lifestyle by 10 percentage points.', cfg: () => ({ baseSpending: DEFAULT.baseSpending * 1.15, retirementSpendingFraction: Math.min(1.3, DEFAULT.retirementSpendingFraction + 0.10) }) },
    ],
  },
  {
    id: 'family-housing',
    label: 'Family & housing',
    tooltip: 'Try common child and housing combinations without touching income or market assumptions.',
    options: [
      { label: 'Profile', tooltip: 'Restore kids and housing assumptions from the loaded profile.', cfg: () => ({ numKids: DEFAULT.numKids, firstKidYear: DEFAULT.firstKidYear, upgradeHouse: DEFAULT.upgradeHouse, upgradeYear: DEFAULT.upgradeYear, upgradeAdditionalCost: DEFAULT.upgradeAdditionalCost }) },
      { label: 'No kids/house', tooltip: 'Remove child costs and future home upgrade costs.', cfg: { numKids: 0, upgradeHouse: false, upgradeAdditionalCost: 0 } },
      { label: 'Kids', tooltip: 'Model at least two children, without a future home upgrade.', cfg: () => ({ numKids: Math.max(2, DEFAULT.numKids), firstKidYear: DEFAULT.firstKidYear || 2, upgradeHouse: false }) },
      { label: 'Kids + house', tooltip: 'Model at least two children plus a future home upgrade.', cfg: () => ({ numKids: Math.max(2, DEFAULT.numKids), firstKidYear: DEFAULT.firstKidYear || 2, upgradeHouse: true, upgradeYear: DEFAULT.upgradeYear || 4, upgradeAdditionalCost: DEFAULT.upgradeAdditionalCost || 400000 }) },
    ],
  },
  {
    id: 'market-stress',
    label: 'Market stress',
    tooltip: 'Apply coarse market stress assumptions while leaving retirement age and spending unchanged.',
    options: [
      { label: 'Profile market', tooltip: 'Restore market return assumptions from the loaded profile.', cfg: () => ({ equityReturnNominal: DEFAULT.equityReturnNominal, equityStd: DEFAULT.equityStd, bondReturnNominal: DEFAULT.bondReturnNominal, inflation: DEFAULT.inflation }) },
      { label: 'Bear market', tooltip: 'Lower expected returns, increase equity volatility, and raise inflation.', cfg: { equityReturnNominal: 0.07, equityStd: 0.20, bondReturnNominal: 0.03, inflation: 0.04 } },
      { label: 'High inflation', tooltip: 'Keep nominal returns but raise inflation to reduce real returns.', cfg: () => ({ equityReturnNominal: DEFAULT.equityReturnNominal, equityStd: DEFAULT.equityStd, bondReturnNominal: DEFAULT.bondReturnNominal, inflation: 0.05 }) },
      { label: 'Low returns', tooltip: 'Reduce expected stock and bond returns while keeping profile inflation.', cfg: () => ({ equityReturnNominal: DEFAULT.equityReturnNominal - 0.02, equityStd: DEFAULT.equityStd, bondReturnNominal: DEFAULT.bondReturnNominal - 0.01, inflation: DEFAULT.inflation }) },
    ],
  },
];

const COMPARISON_PRESETS = [
  { label: 'Profile Baseline', cfg: {} },
  { label: 'Retire Now', cfg: () => ({ retireNathanAge: DEFAULT.nathanAge, retireTanyaAge: DEFAULT.tanyaAge }) },
  { label: 'Lean Spend', cfg: () => ({ baseSpending: DEFAULT.baseSpending * 0.85, retirementSpendingFraction: Math.max(0.5, DEFAULT.retirementSpendingFraction - 0.10) }) },
  { label: 'High Spend', cfg: () => ({ baseSpending: DEFAULT.baseSpending * 1.15, retirementSpendingFraction: Math.min(1.3, DEFAULT.retirementSpendingFraction + 0.10) }) },
  { label: 'Guyton-Klinger', cfg: { withdrawalStrategy: 'guyton_klinger', withdrawalRate: 0.04 } },
  { label: 'Historical', cfg: { simulationMethod: 'historical_bootstrap' } },
  { label: 'Bear Market', cfg: { equityReturnNominal: 0.07, equityStd: 0.20, bondReturnNominal: 0.03, inflation: 0.04 } },
];

function materializeScenarioCfg(scenario) {
  return typeof scenario.cfg === 'function' ? scenario.cfg() : { ...scenario.cfg };
}

function buildScenarioCfg(scenario) {
  return { ...DEFAULT, ...materializeScenarioCfg(scenario) };
}

function scenarioValueMatches(actual, expected) {
  return typeof actual === 'number' && typeof expected === 'number'
    ? Math.abs(actual - expected) < 0.000001
    : actual === expected;
}

function optionMatchesCurrent(option) {
  return Object.entries(materializeScenarioCfg(option))
    .every(([key, value]) => scenarioValueMatches(cfg[key], value));
}

function updateScenarioButtonStates() {
  SCENARIO_GROUPS.forEach((group, groupIndex) => {
    let found = false;
    group.options.forEach((option, optionIndex) => {
      const btn = document.querySelector(
        `.preset-btn[data-group="${groupIndex}"][data-option="${optionIndex}"]`
      );
      const active = !found && optionMatchesCurrent(option);
      if (active) found = true;
      btn?.classList.toggle('active', active);
    });
  });
}

function markCustom() {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  scenarioCache = null;
}

function renderPresets() {
  const grid = document.getElementById('preset-grid');
  grid.innerHTML = SCENARIO_GROUPS.map((group, groupIndex) => `
    <div class="scenario-type">
      <div class="scenario-type-label" data-group="${groupIndex}">${group.label}</div>
      <div class="scenario-options">
        ${group.options.map((option, optionIndex) => `
          <button class="preset-btn" data-group="${groupIndex}" data-option="${optionIndex}">${option.label}</button>
        `).join('')}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.scenario-type-label').forEach(label => {
    const group = SCENARIO_GROUPS[+label.dataset.group];
    if (!group?.tooltip) return;
    label.dataset.tooltip = group.tooltip;
    label.title = group.tooltip;
  });

  grid.querySelectorAll('.preset-btn').forEach(btn => {
    const group = SCENARIO_GROUPS[+btn.dataset.group];
    const option = group.options[+btn.dataset.option];
    if (option?.tooltip) {
      btn.dataset.tooltip = option.tooltip;
      btn.title = option.tooltip;
      btn.setAttribute('aria-label', `${option.label}: ${option.tooltip}`);
    }
    btn.addEventListener('click', () => {
      grid.querySelectorAll(`.preset-btn[data-group="${btn.dataset.group}"]`)
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.assign(cfg, materializeScenarioCfg(option));
      scenarioCache = null;
      _onSyncUI();
      updateScenarioButtonStates();
      _onRender();
    });
  });
  updateScenarioButtonStates();
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario comparison panel
// ─────────────────────────────────────────────────────────────────────────────
let scenarioCache = null;

function renderScenarioGrid(customStats) {
  if (!scenarioCache) {
    scenarioCache = COMPARISON_PRESETS.map(p => {
      const sc = runMonteCarlo(buildScenarioCfg(p));
      return {
        label: p.label,
        survival: sc.survival,
        portAtRetire: sc.portAtRetire,
        portAt70: sc.portAt70,
        required: sc.required,
      };
    });
  }

  const all = [...scenarioCache, { label: '★ Custom', ...customStats }];
  const grid = document.getElementById('scenario-grid');

  grid.innerHTML = all.map(s => {
    const pct = Math.round(s.survival * 100);
    const color = survivalColor(s.survival);
    const barColor = s.survival >= 0.9 ? '#3fb950' : s.survival >= 0.7 ? '#d29922' : '#f85149';
    const isCustom = s.label.startsWith('★');
    const cardStyle = isCustom ? 'border-color:var(--accent);background:rgba(124,58,237,0.05)' : '';
    return `
      <div class="scenario-card" style="${cardStyle}">
        <div class="scenario-name" style="${isCustom ? 'color:var(--accent)' : ''}">${s.label}</div>
        <div class="scenario-survival" style="color:${color}">${pct}%</div>
        <div class="survival-bar"><div class="survival-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="scenario-stat">
          <span class="scenario-stat-label">@ retire (p50)</span>
          <span class="scenario-stat-val">${fmtM(s.portAtRetire?.p50)}</span>
        </div>
        <div class="scenario-stat">
          <span class="scenario-stat-label">@ age 70 (p50)</span>
          <span class="scenario-stat-val">${fmtM(s.portAt70?.p50)}</span>
        </div>
        <div class="scenario-stat">
          <span class="scenario-stat-label">Required</span>
          <span class="scenario-stat-val">${fmtM(s.required)}</span>
        </div>
      </div>
    `;
  }).join('');
}

export { renderPresets, renderScenarioGrid, updateScenarioButtonStates, markCustom };
