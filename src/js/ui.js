import jsYaml from 'js-yaml';
import { cfg, DEFAULT, MONARCH_META } from './config.js';
import { hasSpouse, strategyLabel, methodLabel } from './simulation.js';
import { updateScenarioButtonStates, markCustom } from './scenarios.js';

let _onRender = () => {};
export function setOnRender(fn) { _onRender = fn; }

function primaryName() {
  return (cfg.person1Name || MONARCH_META.person1Name || 'Person 1').trim();
}

function spouseName() {
  return (cfg.person2Name || MONARCH_META.person2Name || 'Person 2').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Input binding
// ─────────────────────────────────────────────────────────────────────────────
function fmtPct(v, digits = 1) {
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtSignedPct(v, digits = 1) {
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(digits)}%`;
}

function fmtM(v) {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6)   return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3)   return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

const FORMATS = {
  nathanAge:                 v => String(Math.round(v)),
  tanyaAge:                  v => String(Math.round(v)),
  retireNathanAge:           v => String(Math.round(v)),
  retireTanyaAge:            v => String(Math.round(v)),
  portfolioTotal:            v => fmtM(v),
  swr:                       v => `${(v * 100).toFixed(2).replace(/\.?0+$/, '')}%`,
  nathanSalaryBase:          v => fmtM(v),
  tanyaSalaryBase:           v => fmtM(v),
  nathanRsuAnnual:           v => fmtM(v),
  tanyaRsuAnnual:            v => fmtM(v),
  rsuVestingYears:           v => String(Math.round(v)),
  incomeGrowthReal:          v => fmtPct(v),
  effectiveIncomeTax:        v => `${Math.round(v * 100)}%`,
  baseSpending:              v => fmtM(v),
  retirementSpendingFraction:v => `${Math.round(v * 100)}%`,
  spendingGrowthReal:        v => fmtPct(v),
  healthcareAnnual:          v => fmtM(v),
  medicareAge:               v => String(Math.round(v)),
  numKids:                   v => String(Math.round(v)),
  firstKidYear:              v => String(Math.round(v)),
  childcareAnnual:           v => fmtM(v),
  k12Annual:                 v => fmtM(v),
  collegeContribution:       v => fmtM(v),
  upgradeYear:               v => String(Math.round(v)),
  upgradeAdditionalCost:     v => fmtM(v),
  ssNathanAnnual:            v => fmtM(v),
  ssTanyaAnnual:             v => fmtM(v),
  ssClaimAge:                v => String(Math.round(v)),
  ssReductionFactor:         v => `${Math.round(v * 100)}%`,
  equityReturnNominal:       v => `${(v * 100).toFixed(1)}%`,
  equityStd:                 v => `${Math.round(v * 100)}%`,
  bondReturnNominal:         v => `${(v * 100).toFixed(1)}%`,
  inflation:                 v => `${(v * 100).toFixed(1)}%`,
  equityFractionWorking:     v => `${Math.round(v * 100)}%`,
  equityFractionRetired:     v => `${Math.round(v * 100)}%`,
  withdrawalRate:            v => `${(v * 100).toFixed(1)}%`,
  years:                     v => `${Math.round(v)} years`,
  mcRuns:                    v => String(Math.round(v)),
  upperGuardrail:            v => `${(v * 100).toFixed(1)}%`,
  lowerGuardrail:            v => `${(v * 100).toFixed(1)}%`,
  guardrailCut:              v => `${Math.round(v * 100)}%`,
  dynamicSpendingFloor:      v => fmtSignedPct(v),
  dynamicSpendingCeiling:    v => fmtSignedPct(v),
  gkCapitalPreservation:     v => `${Math.round(v * 100)}%`,
  gkProsperity:              v => `${Math.round(v * 100)}%`,
  gkAdjustment:              v => `${Math.round(v * 100)}%`,
  gkSunsetYears:             v => `${Math.round(v)} years`,
  spendingFloor:             v => `${Math.round(v * 100)}%`,
  spendingCeiling:           v => `${Math.round(v * 100)}%`,
};

const RANGE_FIELDS = Object.keys(FORMATS);
const TEXT_FIELDS = ['person1Name', 'person2Name'];
const SELECT_FIELDS = ['simulationMethod', 'withdrawalStrategy'];
const CHECKBOX_FIELDS = ['hasSpouse', 'upgradeHouse'];
const SIMULATION_METHODS = ['monte_carlo', 'historical_bootstrap', 'deterministic'];
const WITHDRAWAL_STRATEGIES = [
  'constant_dollar',
  'percent_portfolio',
  'one_over_n',
  'guardrails',
  'guyton_klinger',
  'vanguard_dynamic',
];
const SIDEBAR_STORAGE_KEY = 'retirementSimulator.sidebarCollapsed';
let yamlDirty = false;

const TOOLTIPS = {
  'sidebar-toggle': 'Show or hide the controls pane. On phones, expanded controls fill the screen and the results stay underneath.',
  yamlSettings: 'Profile-shaped YAML for the same settings controlled by the sliders, buttons, and selects.',
  applyYaml: 'Validate this YAML, update all controls, and rerun the simulation.',
  resetYaml: 'Replace the YAML draft with the current control values.',
  copyYaml: 'Copy the current YAML settings to the clipboard.',
  person1Name: 'Display name used in headings, chart tooltips, and age labels.',
  nathanAge: 'Current age of the primary person. The horizon runs from this age forward.',
  retireNathanAge: 'Age when primary work income stops and retirement spending begins.',
  hasSpouse: 'Controls whether spouse or partner income, retirement age, and benefits are included.',
  person2Name: 'Display name for the spouse or partner when the profile includes one.',
  tanyaAge: 'Current age of the spouse or partner.',
  retireTanyaAge: 'Age when spouse or partner work income stops.',
  portfolioTotal: 'Total investable assets available at the start of the simulation.',
  swr: 'Planning threshold for the Required to Retire metric. This does not force actual spending.',
  nathanSalaryBase: 'Primary annual base salary before taxes.',
  tanyaSalaryBase: 'Spouse or partner annual base salary before taxes.',
  nathanRsuAnnual: 'Primary annual equity or RSU grant value at full vest.',
  tanyaRsuAnnual: 'Spouse or partner annual equity or RSU grant value at full vest.',
  rsuVestingYears: 'Years until new RSU grants are treated as fully vested in annual income.',
  incomeGrowthReal: 'Expected annual income growth after removing inflation.',
  effectiveIncomeTax: 'Blended income tax rate applied to salary and RSU income.',
  baseSpending: 'Annual working-year spending in today dollars.',
  retirementSpendingFraction: 'Constant-dollar baseline retirement lifestyle spend as a fraction of working spending.',
  spendingGrowthReal: 'Annual lifestyle spending growth after removing inflation.',
  numKids: 'Number of children included in childcare, K-12, and college cash flows.',
  firstKidYear: 'Years from now until the first child cost schedule starts.',
  childcareAnnual: 'Annual childcare cost per child for ages 0 through 4.',
  k12Annual: 'Annual incremental K-12 cost per child for ages 5 through 17.',
  collegeContribution: 'One-time college contribution per child at age 18.',
  upgradeHouse: 'Adds a one-time future housing cost to the spending path.',
  upgradeYear: 'Simulation year when the home upgrade cost occurs.',
  upgradeAdditionalCost: 'Extra one-time housing cost in today dollars.',
  healthcareAnnual: 'Annual pre-Medicare healthcare cost added during retirement.',
  medicareAge: 'Age when the pre-Medicare healthcare add-on stops.',
  ssNathanAnnual: 'Primary annual Social Security benefit at the selected claim age.',
  ssTanyaAnnual: 'Spouse or partner annual Social Security benefit at the selected claim age.',
  ssClaimAge: 'Age when Social Security income begins.',
  ssReductionFactor: 'Haircut applied to Social Security estimates.',
  simulationMethod: 'Return engine: random Monte Carlo, historical bootstrap, or a deterministic expected-return path.',
  equityReturnNominal: 'Expected annual stock return before inflation in Monte Carlo and deterministic modes.',
  equityStd: 'Stock return volatility used by Monte Carlo mode.',
  bondReturnNominal: 'Expected annual bond return before inflation.',
  inflation: 'Expected annual inflation rate used to convert nominal returns to real returns.',
  equityFractionWorking: 'Stock allocation before both people are retired.',
  equityFractionRetired: 'Stock allocation after retirement begins.',
  withdrawalStrategy: 'Algorithm used to decide retirement lifestyle spending.',
  withdrawalRate: 'Portfolio percentage used by variable-rate strategies and Guyton-Klinger decision thresholds.',
  years: 'Number of years to simulate from the primary person current age.',
  mcRuns: 'Number of stochastic runs in Monte Carlo and historical bootstrap modes.',
  dynamicSpendingFloor: 'Largest year-over-year lifestyle spending cut in the Vanguard dynamic strategy.',
  dynamicSpendingCeiling: 'Largest year-over-year lifestyle spending raise in the Vanguard dynamic strategy.',
  gkCapitalPreservation: 'Guyton-Klinger capital preservation trigger as a percentage of the initial withdrawal rate.',
  gkProsperity: 'Guyton-Klinger prosperity trigger as a percentage of the initial withdrawal rate.',
  gkAdjustment: 'Guyton-Klinger raise or cut size when a decision rule triggers.',
  gkSunsetYears: 'Final years when Guyton-Klinger capital preservation cuts are disabled.',
  upperGuardrail: 'If net withdrawal rate rises above this, guardrails cut lifestyle spending.',
  lowerGuardrail: 'If net withdrawal rate falls below this, guardrails raise lifestyle spending.',
  guardrailCut: 'Size of each guardrail spending adjustment.',
  spendingFloor: 'Hard minimum lifestyle spending as a fraction of the constant-dollar baseline.',
  spendingCeiling: 'Hard maximum lifestyle spending as a fraction of the constant-dollar baseline.',
  'm-survival': 'Share of simulation paths with money remaining at the end of the horizon.',
  'm-port-retire': 'Median portfolio balance in the year primary retirement starts.',
  'm-port-70': 'Median portfolio balance when the primary person reaches age 70.',
  'm-required': 'Constant-dollar retirement spending divided by the chosen SWR threshold.',
  'm-fire': 'First retired year where the median path meets the Required to Retire threshold.',
  'portfolio-chart': 'Portfolio percentile bands across all outcomes for the selected return model.',
  'feasibility-card': 'Survival probability grid across nearby retirement ages and retirement spending levels.',
  'cohort-chart': 'Actual historical return sequences replayed from each valid start year.',
  'lifestyle-chart': 'Distribution of retirement lifestyle spending relative to the baseline retirement budget.',
  'cashflow-chart': 'Median-path income, spending, and net savings through time.',
  'dist-chart': 'Distribution of ending portfolio balances across simulated outcomes.',
  'scenario-grid': 'Preset comparison cards recomputed with the same profile defaults.',
};

const SECTION_TOOLTIPS = {
  presets: 'Composable shortcut groups. Each button changes one assumption category and preserves the other current settings.',
  yaml: 'Advanced editor for the same profile settings controlled by this UI. Apply YAML to update sliders, buttons, and charts.',
  ages: 'Who is included in the plan, current ages, and when each person stops working.',
  portfolio: 'Starting investable assets and the planning withdrawal-rate threshold used for required-to-retire metrics.',
  income: 'Employment income assumptions, RSU vesting, real income growth, and blended tax drag before retirement.',
  spending: 'Working-year lifestyle spending, retirement spending level, and real lifestyle growth.',
  kids: 'Child-related cash flows for childcare, K-12 costs, and college contributions.',
  housing: 'Optional one-time future home upgrade cost and timing.',
  healthcare: 'Retirement healthcare add-on before Medicare and the age when that add-on stops.',
  ss: 'Social Security benefit estimates, claim age, and benefit haircut assumptions.',
  market: 'Return model, nominal return assumptions, inflation, volatility, and stock allocation.',
  simulation: 'Simulation horizon, run count, withdrawal strategy, and strategy-specific dynamic-spending rules.',
  guardrails: 'Guardrail trigger thresholds, adjustment size, and hard lifestyle spending bounds.',
};

function setSidebarCollapsed(collapsed, persist) {
  const layout = document.querySelector('.layout');
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const label = document.getElementById('sidebar-toggle-text');
  if (!layout || !toggle) return;

  layout.classList.toggle('sidebar-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? 'Show simulator controls' : 'Hide simulator controls');
  if (sidebar) sidebar.setAttribute('aria-hidden', String(collapsed));
  if (label) label.textContent = collapsed ? 'Show controls' : 'Hide controls';

  if (persist) {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore storage failures; the visible state still changes.
    }
  }
}

function bindSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const layout = document.querySelector('.layout');
  if (!toggle || !layout) return;

  let collapsed = false;
  try {
    collapsed = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    collapsed = false;
  }
  setSidebarCollapsed(collapsed, false);

  toggle.addEventListener('click', () => {
    setSidebarCollapsed(!layout.classList.contains('sidebar-collapsed'), true);
  });
}

function numberOrDefault(c, key) {
  const value = c[key] ?? DEFAULT[key] ?? 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function integerOrDefault(c, key) {
  return Math.round(numberOrDefault(c, key));
}

function stringOrDefault(c, key, fallback = '') {
  const text = String(c[key] ?? DEFAULT[key] ?? fallback);
  return text.trim() ? text : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile persistence (localStorage + file I/O)
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE_STORAGE_KEY = 'retirement-simulator-profile-v1';

function saveProfileToStorage() {
  const textarea = document.getElementById('yamlSettings');
  if (textarea == null) return;
  try { window.localStorage.setItem(PROFILE_STORAGE_KEY, textarea.value); } catch {}
}

function loadProfileFromStorage() {
  try {
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) return false;
    const textarea = document.getElementById('yamlSettings');
    if (!textarea) return false;
    textarea.value = saved;
    const ok = applyYamlSettings();
    if (!ok) {
      try { window.localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function loadProfileFromText(text) {
  const textarea = document.getElementById('yamlSettings');
  if (!textarea) return;
  textarea.value = text;
  applyYamlSettings();
}

function downloadProfile() {
  const textarea = document.getElementById('yamlSettings');
  if (!textarea?.value) return;
  const blob = new Blob([textarea.value], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profile.yaml';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function bindDragDrop() {
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.items && [...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    const file = [...e.dataTransfer.files].find(
      f => f.name.endsWith('.yaml') || f.name.endsWith('.yml')
    );
    if (!file) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = (ev) => loadProfileFromText(String(ev.target?.result ?? ''));
    reader.readAsText(file);
  });
}

function cfgToProfileYaml(c = cfg) {
  const spouse = hasSpouse(c)
    ? {
        name: stringOrDefault(c, 'person2Name', 'Person 2'),
        current_age: integerOrDefault(c, 'tanyaAge'),
        retire_at: integerOrDefault(c, 'retireTanyaAge'),
      }
    : null;

  return {
    people: {
      primary: {
        name: stringOrDefault(c, 'person1Name', 'Person 1'),
        current_age: integerOrDefault(c, 'nathanAge'),
        retire_at: integerOrDefault(c, 'retireNathanAge'),
      },
      spouse,
    },
    portfolio: {
      total: numberOrDefault(c, 'portfolioTotal'),
    },
    income: {
      primary_salary: numberOrDefault(c, 'nathanSalaryBase'),
      primary_rsus_annual: numberOrDefault(c, 'nathanRsuAnnual'),
      spouse_salary: numberOrDefault(c, 'tanyaSalaryBase'),
      spouse_rsus_annual: numberOrDefault(c, 'tanyaRsuAnnual'),
      rsu_vesting_years: integerOrDefault(c, 'rsuVestingYears'),
      income_growth_real: numberOrDefault(c, 'incomeGrowthReal'),
      effective_income_tax: numberOrDefault(c, 'effectiveIncomeTax'),
    },
    spending: {
      base_annual: numberOrDefault(c, 'baseSpending'),
      retirement_fraction: numberOrDefault(c, 'retirementSpendingFraction'),
      growth_real: numberOrDefault(c, 'spendingGrowthReal'),
      healthcare_annual: numberOrDefault(c, 'healthcareAnnual'),
      medicare_age: integerOrDefault(c, 'medicareAge'),
      floor: numberOrDefault(c, 'spendingFloor'),
      ceiling: numberOrDefault(c, 'spendingCeiling'),
    },
    kids: {
      count: integerOrDefault(c, 'numKids'),
      first_kid_year: integerOrDefault(c, 'firstKidYear'),
      childcare_annual: numberOrDefault(c, 'childcareAnnual'),
      k12_annual: numberOrDefault(c, 'k12Annual'),
      college_contribution: numberOrDefault(c, 'collegeContribution'),
    },
    social_security: {
      primary_annual: numberOrDefault(c, 'ssNathanAnnual'),
      spouse_annual: numberOrDefault(c, 'ssTanyaAnnual'),
      claim_age: integerOrDefault(c, 'ssClaimAge'),
      reduction_factor: numberOrDefault(c, 'ssReductionFactor'),
    },
    house: {
      upgrade: Boolean(c.upgradeHouse),
      upgrade_year: integerOrDefault(c, 'upgradeYear'),
      upgrade_additional_cost: numberOrDefault(c, 'upgradeAdditionalCost'),
    },
    market: {
      equity_return_nominal: numberOrDefault(c, 'equityReturnNominal'),
      equity_std: numberOrDefault(c, 'equityStd'),
      bond_return_nominal: numberOrDefault(c, 'bondReturnNominal'),
      inflation: numberOrDefault(c, 'inflation'),
      equity_fraction_working: numberOrDefault(c, 'equityFractionWorking'),
      equity_fraction_retired: numberOrDefault(c, 'equityFractionRetired'),
    },
    simulation: {
      method: c.simulationMethod ?? DEFAULT.simulationMethod ?? 'monte_carlo',
      withdrawal_strategy: c.withdrawalStrategy ?? DEFAULT.withdrawalStrategy ?? 'constant_dollar',
      withdrawal_rate: numberOrDefault(c, 'withdrawalRate'),
      swr: numberOrDefault(c, 'swr'),
      years: integerOrDefault(c, 'years'),
      mc_runs: integerOrDefault(c, 'mcRuns'),
      guardrails: {
        upper: numberOrDefault(c, 'upperGuardrail'),
        lower: numberOrDefault(c, 'lowerGuardrail'),
        cut: numberOrDefault(c, 'guardrailCut'),
      },
      dynamic_spending: {
        floor: numberOrDefault(c, 'dynamicSpendingFloor'),
        ceiling: numberOrDefault(c, 'dynamicSpendingCeiling'),
      },
      guyton_klinger: {
        capital_preservation: numberOrDefault(c, 'gkCapitalPreservation'),
        prosperity: numberOrDefault(c, 'gkProsperity'),
        adjustment: numberOrDefault(c, 'gkAdjustment'),
        sunset_years: integerOrDefault(c, 'gkSunsetYears'),
      },
    },
  };
}

function yamlPath(source, path) {
  return path.reduce((obj, key) => (obj == null ? undefined : obj[key]), source);
}

function yamlObject(source, path) {
  const value = yamlPath(source, path);
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path.join('.')} must be a mapping`);
  }
  return value;
}

function yamlString(source, path, next, key) {
  const value = yamlPath(source, path);
  if (value == null) return;
  next[key] = String(value);
}

function yamlNumber(source, path, next, key) {
  const value = yamlPath(source, path);
  if (value == null) return;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${path.join('.')} must be a number`);
  }
  next[key] = numeric;
}

function yamlInteger(source, path, next, key) {
  const value = yamlPath(source, path);
  if (value == null) return;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${path.join('.')} must be a whole number`);
  }
  next[key] = Math.round(numeric);
}

function yamlBoolean(source, path, next, key) {
  const value = yamlPath(source, path);
  if (value == null) return;
  if (typeof value !== 'boolean') {
    throw new Error(`${path.join('.')} must be true or false`);
  }
  next[key] = value;
}

function yamlEnum(source, path, next, key, allowed) {
  const value = yamlPath(source, path);
  if (value == null) return;
  const normalized = String(value);
  if (!allowed.includes(normalized)) {
    throw new Error(`${path.join('.')} must be one of: ${allowed.join(', ')}`);
  }
  next[key] = normalized;
}

function cfgFromProfileYaml(doc) {
  if (doc == null) return { ...DEFAULT };
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('YAML settings must be a mapping');
  }

  yamlObject(doc, ['people']);
  yamlObject(doc, ['people', 'primary']);
  yamlObject(doc, ['portfolio']);
  yamlObject(doc, ['income']);
  yamlObject(doc, ['spending']);
  yamlObject(doc, ['kids']);
  yamlObject(doc, ['social_security']);
  yamlObject(doc, ['house']);
  yamlObject(doc, ['market']);
  yamlObject(doc, ['simulation']);
  yamlObject(doc, ['simulation', 'guardrails']);
  yamlObject(doc, ['simulation', 'dynamic_spending']);
  yamlObject(doc, ['simulation', 'guyton_klinger']);

  const next = { ...DEFAULT };
  yamlString(doc, ['people', 'primary', 'name'], next, 'person1Name');
  yamlInteger(doc, ['people', 'primary', 'current_age'], next, 'nathanAge');
  yamlInteger(doc, ['people', 'primary', 'retire_at'], next, 'retireNathanAge');

  const people = yamlPath(doc, ['people']);
  if (people && Object.prototype.hasOwnProperty.call(people, 'spouse')) {
    const spouse = yamlPath(doc, ['people', 'spouse']);
    if (spouse == null) {
      next.hasSpouse = false;
      next.person2Name = '';
      next.tanyaAge = next.nathanAge;
      next.retireTanyaAge = next.retireNathanAge;
    } else {
      yamlObject(doc, ['people', 'spouse']);
      next.hasSpouse = true;
      yamlString(doc, ['people', 'spouse', 'name'], next, 'person2Name');
      yamlInteger(doc, ['people', 'spouse', 'current_age'], next, 'tanyaAge');
      yamlInteger(doc, ['people', 'spouse', 'retire_at'], next, 'retireTanyaAge');
    }
  }

  yamlNumber(doc, ['portfolio', 'total'], next, 'portfolioTotal');
  yamlNumber(doc, ['income', 'primary_salary'], next, 'nathanSalaryBase');
  yamlNumber(doc, ['income', 'primary_rsus_annual'], next, 'nathanRsuAnnual');
  yamlNumber(doc, ['income', 'spouse_salary'], next, 'tanyaSalaryBase');
  yamlNumber(doc, ['income', 'spouse_rsus_annual'], next, 'tanyaRsuAnnual');
  yamlInteger(doc, ['income', 'rsu_vesting_years'], next, 'rsuVestingYears');
  yamlNumber(doc, ['income', 'income_growth_real'], next, 'incomeGrowthReal');
  yamlNumber(doc, ['income', 'effective_income_tax'], next, 'effectiveIncomeTax');

  yamlNumber(doc, ['spending', 'base_annual'], next, 'baseSpending');
  yamlNumber(doc, ['spending', 'retirement_fraction'], next, 'retirementSpendingFraction');
  yamlNumber(doc, ['spending', 'growth_real'], next, 'spendingGrowthReal');
  yamlNumber(doc, ['spending', 'healthcare_annual'], next, 'healthcareAnnual');
  yamlInteger(doc, ['spending', 'medicare_age'], next, 'medicareAge');
  yamlNumber(doc, ['spending', 'floor'], next, 'spendingFloor');
  yamlNumber(doc, ['spending', 'ceiling'], next, 'spendingCeiling');

  yamlInteger(doc, ['kids', 'count'], next, 'numKids');
  yamlInteger(doc, ['kids', 'first_kid_year'], next, 'firstKidYear');
  yamlNumber(doc, ['kids', 'childcare_annual'], next, 'childcareAnnual');
  yamlNumber(doc, ['kids', 'k12_annual'], next, 'k12Annual');
  yamlNumber(doc, ['kids', 'college_contribution'], next, 'collegeContribution');

  yamlNumber(doc, ['social_security', 'primary_annual'], next, 'ssNathanAnnual');
  yamlNumber(doc, ['social_security', 'spouse_annual'], next, 'ssTanyaAnnual');
  yamlInteger(doc, ['social_security', 'claim_age'], next, 'ssClaimAge');
  yamlNumber(doc, ['social_security', 'reduction_factor'], next, 'ssReductionFactor');

  yamlBoolean(doc, ['house', 'upgrade'], next, 'upgradeHouse');
  yamlInteger(doc, ['house', 'upgrade_year'], next, 'upgradeYear');
  yamlNumber(doc, ['house', 'upgrade_additional_cost'], next, 'upgradeAdditionalCost');

  yamlNumber(doc, ['market', 'equity_return_nominal'], next, 'equityReturnNominal');
  yamlNumber(doc, ['market', 'equity_std'], next, 'equityStd');
  yamlNumber(doc, ['market', 'bond_return_nominal'], next, 'bondReturnNominal');
  yamlNumber(doc, ['market', 'inflation'], next, 'inflation');
  yamlNumber(doc, ['market', 'equity_fraction_working'], next, 'equityFractionWorking');
  yamlNumber(doc, ['market', 'equity_fraction_retired'], next, 'equityFractionRetired');

  yamlEnum(doc, ['simulation', 'method'], next, 'simulationMethod', SIMULATION_METHODS);
  yamlEnum(doc, ['simulation', 'withdrawal_strategy'], next, 'withdrawalStrategy', WITHDRAWAL_STRATEGIES);
  yamlNumber(doc, ['simulation', 'withdrawal_rate'], next, 'withdrawalRate');
  yamlNumber(doc, ['simulation', 'swr'], next, 'swr');
  yamlInteger(doc, ['simulation', 'years'], next, 'years');
  yamlInteger(doc, ['simulation', 'mc_runs'], next, 'mcRuns');
  yamlNumber(doc, ['simulation', 'guardrails', 'upper'], next, 'upperGuardrail');
  yamlNumber(doc, ['simulation', 'guardrails', 'lower'], next, 'lowerGuardrail');
  yamlNumber(doc, ['simulation', 'guardrails', 'cut'], next, 'guardrailCut');
  yamlNumber(doc, ['simulation', 'dynamic_spending', 'floor'], next, 'dynamicSpendingFloor');
  yamlNumber(doc, ['simulation', 'dynamic_spending', 'ceiling'], next, 'dynamicSpendingCeiling');
  yamlNumber(doc, ['simulation', 'guyton_klinger', 'capital_preservation'], next, 'gkCapitalPreservation');
  yamlNumber(doc, ['simulation', 'guyton_klinger', 'prosperity'], next, 'gkProsperity');
  yamlNumber(doc, ['simulation', 'guyton_klinger', 'adjustment'], next, 'gkAdjustment');
  yamlInteger(doc, ['simulation', 'guyton_klinger', 'sunset_years'], next, 'gkSunsetYears');
  return next;
}

function setYamlStatus(message, state = '') {
  const status = document.getElementById('yamlStatus');
  if (!status) return;
  status.textContent = message;
  status.className = state ? `yaml-status ${state}` : 'yaml-status';
}

function syncYamlFromCfg(message = '') {
  const textarea = document.getElementById('yamlSettings');
  if (!textarea) return;
  textarea.value = jsYaml.dump(cfgToProfileYaml(cfg), {
    noRefs: true,
    sortKeys: false,
    lineWidth: 120,
  });
  yamlDirty = false;
  setYamlStatus(message, message ? 'ok' : '');
  saveProfileToStorage();
}

function applyYamlSettings() {
  const textarea = document.getElementById('yamlSettings');
  if (!textarea) return false;
  try {
    const parsed = jsYaml.load(textarea.value);
    Object.assign(cfg, cfgFromProfileYaml(parsed));
    normalizeConfigBounds();
    markCustom();
    syncUIFromCfg();
    updateScenarioButtonStates();
    _onRender();
    setYamlStatus('Applied YAML', 'ok');
    saveProfileToStorage();
    return true;
  } catch (err) {
    setYamlStatus(err?.message ?? String(err), 'error');
    return false;
  }
}

async function copyYamlSettings() {
  const textarea = document.getElementById('yamlSettings');
  if (!textarea) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(textarea.value);
    } else {
      textarea.select();
      document.execCommand('copy');
    }
    setYamlStatus('Copied YAML', 'ok');
  } catch {
    setYamlStatus('Copy failed', 'error');
  }
}

function bindYamlEditor() {
  document.getElementById('yamlSettings')?.addEventListener('input', () => {
    yamlDirty = true;
    setYamlStatus('YAML edits not applied', 'dirty');
  });
  document.getElementById('applyYaml')?.addEventListener('click', applyYamlSettings);
  document.getElementById('resetYaml')?.addEventListener('click', () => {
    syncYamlFromCfg('Reset from controls');
  });
  document.getElementById('copyYaml')?.addEventListener('click', () => {
    copyYamlSettings();
  });
  document.getElementById('loadProfile')?.addEventListener('click', () => {
    document.getElementById('profileFileInput')?.click();
  });
  document.getElementById('profileFileInput')?.addEventListener('change', (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadProfileFromText(String(ev.target?.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('downloadProfile')?.addEventListener('click', downloadProfile);
}

function bindInputs() {
  RANGE_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (!el || el.type !== 'range') return;
    const valEl = document.getElementById('v-' + field);

    el.addEventListener('input', () => {
      const val = parseFloat(el.value);
      cfg[field] = val;
      if (valEl) valEl.textContent = FORMATS[field]?.(val) ?? val;
      normalizeConfigBounds();
      syncUIFromCfg();
      updateRealReturnNote();
      markCustom();
      _onRender();
    });
  });

  TEXT_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    el.addEventListener('input', () => {
      cfg[field] = el.value;
      updateDisplayLabels();
      syncYamlFromCfg();
      markCustom();
      _onRender();
    });
  });

  SELECT_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    el.addEventListener('change', () => {
      cfg[field] = el.value;
      syncUIFromCfg();
      markCustom();
      _onRender();
    });
  });

  CHECKBOX_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    el.addEventListener('change', () => {
      cfg[field] = el.checked;
      syncUIFromCfg();
      markCustom();
      _onRender();
    });
  });

  // Section collapse toggles
  document.querySelectorAll('.section-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const id = hdr.dataset.section;
      const body = document.getElementById('sb-' + id);
      if (!body) return;
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      hdr.classList.toggle('open', !open);
    });
  });

  applyTooltips();
}

function updateRealReturnNote() {
  const eqReal = ((cfg.equityReturnNominal ?? DEFAULT.equityReturnNominal) - (cfg.inflation ?? DEFAULT.inflation));
  const bdReal = ((cfg.bondReturnNominal ?? DEFAULT.bondReturnNominal) - (cfg.inflation ?? DEFAULT.inflation));
  const eqEl = document.getElementById('derived-eq-real');
  const bdEl = document.getElementById('derived-bd-real');
  if (eqEl) eqEl.textContent = `${(eqReal * 100).toFixed(1)}%`;
  if (bdEl) bdEl.textContent = `${(bdReal * 100).toFixed(1)}%`;
}

function normalizeConfigBounds() {
  cfg.nathanAge = Math.round(cfg.nathanAge ?? DEFAULT.nathanAge);
  cfg.tanyaAge = Math.round(cfg.tanyaAge ?? DEFAULT.tanyaAge ?? cfg.nathanAge);
  cfg.retireNathanAge = Math.max(cfg.nathanAge, Math.round(cfg.retireNathanAge ?? DEFAULT.retireNathanAge));
  cfg.retireTanyaAge = Math.max(cfg.tanyaAge, Math.round(cfg.retireTanyaAge ?? DEFAULT.retireTanyaAge ?? cfg.retireNathanAge));
  cfg.years = Math.max(1, Math.round(cfg.years ?? DEFAULT.years));
  cfg.mcRuns = Math.max(1, Math.round(cfg.mcRuns ?? DEFAULT.mcRuns));
  if (!hasSpouse(cfg)) {
    cfg.tanyaAge = cfg.nathanAge;
    cfg.retireTanyaAge = cfg.retireNathanAge;
  }
}

function updatePanelState() {
  const historical = cfg.simulationMethod === 'historical_bootstrap';
  const deterministic = cfg.simulationMethod === 'deterministic';
  const guardrails = cfg.withdrawalStrategy === 'guardrails';
  const dynamic = cfg.withdrawalStrategy === 'vanguard_dynamic';
  const guytonKlinger = cfg.withdrawalStrategy === 'guyton_klinger';

  document.getElementById('hist-note').style.display = historical ? 'block' : 'none';
  document.getElementById('mc-sliders').style.opacity = historical ? '0.4' : '1';
  document.getElementById('mc-sliders').style.pointerEvents = historical ? 'none' : '';
  document.getElementById('real-return-note').style.display = historical ? 'none' : 'block';
  document.getElementById('guardrails-controls').classList.toggle('dim', !guardrails);
  document.getElementById('dynamic-spending-controls').classList.toggle('dim', !dynamic);
  document.getElementById('guyton-klinger-controls').classList.toggle('dim', !guytonKlinger);
  document.getElementById('housing-controls').classList.toggle('dim', !cfg.upgradeHouse);
  document.getElementById('mc-runs-group').style.opacity = deterministic ? '0.5' : '1';

  document.getElementById('mc-badge').textContent =
    deterministic ? `${methodLabel(cfg.simulationMethod)} path` : `${cfg.mcRuns} ${methodLabel(cfg.simulationMethod)} runs`;
}

function updateDisplayLabels() {
  const names = hasSpouse(cfg) ? `${primaryName()} & ${spouseName()}` : primaryName();
  document.title = `Retirement Simulator · ${names}`;

  const sub = document.getElementById('header-sub');
  if (sub) sub.textContent = `${names} · ${methodLabel(cfg.simulationMethod)} · ${strategyLabel(cfg.withdrawalStrategy)}`;

  document.querySelectorAll('[data-person1]').forEach(el => { el.textContent = primaryName(); });
  document.querySelectorAll('[data-person2]').forEach(el => { el.textContent = spouseName(); });
  document.querySelectorAll('[data-spouse-only]').forEach(el => {
    el.style.display = hasSpouse(cfg) ? '' : 'none';
  });

  const survivalSub = document.getElementById('m-survival-sub');
  if (survivalSub) survivalSub.textContent = `to ${primaryName()} age ${cfg.nathanAge + cfg.years}`;
  const fireSub = document.getElementById('m-fire-sub');
  if (fireSub) fireSub.textContent = `${primaryName()}'s age when funded`;
  const distSub = document.getElementById('dist-chart-sub');
  if (distSub) distSub.textContent = `${primaryName()} age ${cfg.nathanAge + cfg.years} · all outcomes`;
  const portSub = document.getElementById('portfolio-chart-sub');
  if (portSub) {
    portSub.textContent = cfg.simulationMethod === 'deterministic'
      ? 'Expected-return path'
      : `${methodLabel(cfg.simulationMethod)} percentile bands · median deterministic path highlighted`;
  }

  const retireN = document.getElementById('retireNathanAge');
  if (retireN) {
    retireN.min = cfg.nathanAge;
    retireN.max = Math.max(85, cfg.retireNathanAge);
  }
  const retireT = document.getElementById('retireTanyaAge');
  if (retireT) {
    retireT.min = cfg.tanyaAge;
    retireT.max = Math.max(85, cfg.retireTanyaAge);
  }
}

function syncUIFromCfg() {
  normalizeConfigBounds();
  RANGE_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (!el || el.type !== 'range') return;
    el.value = cfg[field] ?? DEFAULT[field];
    const valEl = document.getElementById('v-' + field);
    if (valEl) valEl.textContent = FORMATS[field]?.(cfg[field]) ?? cfg[field];
  });
  TEXT_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = cfg[field] ?? DEFAULT[field] ?? '';
  });
  SELECT_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = cfg[field] ?? DEFAULT[field];
  });
  CHECKBOX_FIELDS.forEach(field => {
    const el = document.getElementById(field);
    if (el) el.checked = Boolean(cfg[field]);
  });
  updatePanelState();
  updateDisplayLabels();
  updateRealReturnNote();
  syncYamlFromCfg();
}

function applyTooltips() {
  document.querySelectorAll('.section-header').forEach(hdr => {
    const text = SECTION_TOOLTIPS[hdr.dataset.section];
    if (!text) return;
    hdr.dataset.tooltip = text;
    hdr.title = text;
  });

  Object.entries(TOOLTIPS).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const target = el.closest('.yaml-btn, .yaml-textarea, .control-group, .toggle-row, .metric-card, .chart-card') ?? el;
    target.dataset.tooltip = text;
    target.title = text;
    if (target !== el) el.title = text;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta defaults
// ─────────────────────────────────────────────────────────────────────────────
function applyMetaDefaults() {
  cfg.person1Name = cfg.person1Name ?? MONARCH_META.person1Name ?? 'Person 1';
  cfg.person2Name = cfg.person2Name ?? MONARCH_META.person2Name ?? '';
  cfg.hasSpouse = cfg.hasSpouse ?? MONARCH_META.hasSpouse ?? false;
  if (!hasSpouse(cfg)) {
    cfg.person2Name = '';
  }
}

export {
  bindSidebarToggle, bindYamlEditor, bindInputs, bindDragDrop,
  syncUIFromCfg, applyTooltips, applyMetaDefaults,
  loadProfileFromStorage, syncYamlFromCfg,
};
