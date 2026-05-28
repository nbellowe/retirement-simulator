import { cfg, FALLBACK_DEFAULT } from './config.js';
import { clamp, hasSpouse } from './simulation.js';
import { syncUIFromCfg, syncYamlFromCfg, normalizeConfigBounds, setSidebarCollapsed, applyYamlSettings } from './ui.js';
import { updateScenarioButtonStates } from './scenarios.js';

let _onRender = () => {};
export function setOnRender(fn) { _onRender = fn; }

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding state
// ─────────────────────────────────────────────────────────────────────────────
const ONBOARDING_STORAGE_KEY = 'retirementSimulator.onboardingDismissed.v1';
let activeTourIndex = -1;

const WIZARD_PRESETS = {
  solo: {
    wizardPrimaryName: 'Person 1',
    wizardCurrentAge: 35,
    wizardRetireAge: 55,
    wizardPortfolio: 500000,
    wizardIncome: 150000,
    wizardSpending: 90000,
    wizardRetirementLifestyle: 0.85,
    wizardRisk: 'balanced',
    wizardKids: 0,
    wizardHasSpouse: false,
    wizardSpouseName: 'Person 2',
    wizardSpouseAge: 35,
  },
  family: {
    wizardPrimaryName: 'Alex',
    wizardCurrentAge: 35,
    wizardRetireAge: 52,
    wizardPortfolio: 1000000,
    wizardIncome: 400000,
    wizardSpending: 130000,
    wizardRetirementLifestyle: 0.85,
    wizardRisk: 'balanced',
    wizardKids: 2,
    wizardHasSpouse: true,
    wizardSpouseName: 'Jordan',
    wizardSpouseAge: 33,
  },
  near: {
    wizardPrimaryName: 'Person 1',
    wizardCurrentAge: 58,
    wizardRetireAge: 65,
    wizardPortfolio: 2500000,
    wizardIncome: 150000,
    wizardSpending: 90000,
    wizardRetirementLifestyle: 0.85,
    wizardRisk: 'conservative',
    wizardKids: 0,
    wizardHasSpouse: false,
    wizardSpouseName: 'Person 2',
    wizardSpouseAge: 58,
  },
};

const RISK_PRESETS = {
  conservative: {
    equityReturnNominal: 0.07,
    equityStd: 0.12,
    bondReturnNominal: 0.035,
    equityFractionWorking: 0.60,
    equityFractionRetired: 0.40,
  },
  balanced: {
    equityReturnNominal: 0.085,
    equityStd: 0.16,
    bondReturnNominal: 0.04,
    equityFractionWorking: 0.80,
    equityFractionRetired: 0.60,
  },
  growth: {
    equityReturnNominal: 0.095,
    equityStd: 0.19,
    bondReturnNominal: 0.04,
    equityFractionWorking: 0.90,
    equityFractionRetired: 0.70,
  },
};

const TOUR_STEPS = [
  {
    target: 'sb-presets',
    section: 'presets',
    title: 'Quick Scenarios',
    body: 'Preset buttons change one assumption family at a time, so you can test retirement timing, spending, family costs, and market assumptions without rebuilding the whole profile.',
  },
  {
    target: 'sb-ages',
    section: 'ages',
    title: 'Ages & Retirement',
    body: 'This section defines who is in the plan and when work income stops. The rest of the charts use these ages as the timeline anchor.',
  },
  {
    target: 'sb-spending',
    section: 'spending',
    title: 'Spending',
    body: 'Working-year spending and retirement lifestyle percentage drive the withdrawal need. This is usually the highest-impact area to sanity-check first.',
  },
  {
    target: 'sb-market',
    section: 'market',
    title: 'Market & Returns',
    body: 'Switch the return engine or tune return, inflation, volatility, and allocation assumptions. Historical bootstrap ignores the equity return sliders.',
  },
  {
    target: 'sb-simulation',
    section: 'simulation',
    title: 'Simulation & Withdrawals',
    body: 'Choose the withdrawal rule, run count, and horizon. Variable strategies expose additional controls only when they are relevant.',
  },
  {
    target: 'tour-metrics',
    title: 'Top Metrics',
    body: 'The cards summarize survivability, retirement readiness, required portfolio, and the age when the current plan becomes funded on the median path.',
  },
  {
    target: 'tour-portfolio-card',
    title: 'Portfolio Trajectory',
    body: 'The main chart shows the median path and percentile bands so you can see both the expected path and downside dispersion.',
  },
  {
    target: 'tour-scenario-card',
    title: 'Scenario Comparison',
    body: 'This panel compares the current profile with preset scenarios after each major change.',
  },
  {
    target: 'sb-yaml',
    section: 'yaml',
    title: 'YAML Settings',
    body: 'The YAML editor is the portable profile. Use it to load, edit, copy, download, and version your full set of assumptions.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Intro guide, profile builder, and UI tour
// ─────────────────────────────────────────────────────────────────────────────
function setOnboardingStatus(message, state = '') {
  const status = document.getElementById('onboarding-status');
  if (!status) return;
  status.textContent = message;
  status.className = state ? `onboarding-status ${state}` : 'onboarding-status';
}

function showOnboardingTab(tab) {
  document.querySelectorAll('[data-onboarding-tab]').forEach(btn => {
    const active = btn.dataset.onboardingTab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-onboarding-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.onboardingPanel === tab);
  });
}

function setOnboardingVisible(visible, persistDismissal = false) {
  const modal = document.getElementById('onboarding');
  if (!modal) return;
  modal.classList.toggle('show', visible);
  modal.setAttribute('aria-hidden', String(!visible));
  document.body.classList.toggle('modal-open', visible);
  if (visible) {
    setTimeout(() => {
      const active = modal.querySelector('.onboarding-tab.active') ?? document.getElementById('onboarding-close');
      active?.focus();
    }, 0);
  } else if (persistDismissal) {
    try { window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1'); } catch {}
  }
}

function maybeShowOnboarding() {
  let dismissed = false;
  try {
    dismissed = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    dismissed = false;
  }
  if (!dismissed) {
    setTimeout(() => setOnboardingVisible(true, false), 350);
  }
}

function setWizardField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = Boolean(value);
  } else {
    el.value = String(value);
  }
}

function setWizardPreset(name) {
  const preset = WIZARD_PRESETS[name] ?? WIZARD_PRESETS.solo;
  Object.entries(preset).forEach(([id, value]) => setWizardField(id, value));
  document.querySelectorAll('.profile-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.profilePreset === name);
  });
  syncWizardSpouseFields();
}

function syncWizardSpouseFields() {
  const hasPartner = Boolean(document.getElementById('wizardHasSpouse')?.checked);
  document.querySelectorAll('.wizard-spouse-fields').forEach(el => {
    el.classList.toggle('hidden', !hasPartner);
  });
}

function readWizardNumber(id, fallback, min, max) {
  const value = Number(document.getElementById(id)?.value);
  const safe = Number.isFinite(value) ? value : fallback;
  return clamp(safe, min, max);
}

function readWizardString(id, fallback) {
  const value = String(document.getElementById(id)?.value ?? '').trim();
  return value || fallback;
}

function sampleProfileConfig() {
  return {
    ...FALLBACK_DEFAULT,
    person1Name: 'Alex',
    person2Name: 'Jordan',
    hasSpouse: true,
    nathanAge: 35,
    tanyaAge: 33,
    retireNathanAge: 52,
    retireTanyaAge: 50,
    portfolioTotal: 850000,
    nathanSalaryBase: 185000,
    nathanRsuAnnual: 60000,
    tanyaSalaryBase: 140000,
    tanyaRsuAnnual: 40000,
    effectiveIncomeTax: 0.30,
    baseSpending: 130000,
    retirementSpendingFraction: 0.80,
    healthcareAnnual: 20000,
    numKids: 2,
    firstKidYear: 2,
    childcareAnnual: 30000,
    k12Annual: 8000,
    collegeContribution: 75000,
    ssNathanAnnual: 28000,
    ssTanyaAnnual: 22000,
    ssReductionFactor: 0.85,
    upgradeHouse: true,
    upgradeYear: 3,
    upgradeAdditionalCost: 500000,
    withdrawalStrategy: 'guardrails',
    mcRuns: 500,
  };
}

function applyConfigFromOnboarding(nextCfg, message) {
  Object.assign(cfg, nextCfg);
  normalizeConfigBounds();
  updateScenarioButtonStates();
  syncUIFromCfg();
  _onRender();
  setOnboardingStatus(message, 'ok');
}

function applyWizardProfile() {
  const hasPartner = Boolean(document.getElementById('wizardHasSpouse')?.checked);
  const primaryAge = Math.round(readWizardNumber('wizardCurrentAge', 35, 18, 85));
  const spouseAge = Math.round(readWizardNumber('wizardSpouseAge', primaryAge, 18, 85));
  const retireAge = Math.round(readWizardNumber('wizardRetireAge', 55, 35, 85));
  const householdIncome = readWizardNumber('wizardIncome', 150000, 0, 2000000);
  const risk = RISK_PRESETS[document.getElementById('wizardRisk')?.value] ?? RISK_PRESETS.balanced;
  const primaryShare = hasPartner ? 0.60 : 1;

  const next = {
    ...FALLBACK_DEFAULT,
    ...risk,
    person1Name: readWizardString('wizardPrimaryName', 'Person 1'),
    person2Name: hasPartner ? readWizardString('wizardSpouseName', 'Person 2') : '',
    hasSpouse: hasPartner,
    nathanAge: primaryAge,
    tanyaAge: hasPartner ? spouseAge : primaryAge,
    retireNathanAge: Math.max(primaryAge, retireAge),
    retireTanyaAge: hasPartner ? Math.max(spouseAge, retireAge) : Math.max(primaryAge, retireAge),
    portfolioTotal: readWizardNumber('wizardPortfolio', 500000, 0, 100000000),
    nathanSalaryBase: Math.round(householdIncome * primaryShare),
    tanyaSalaryBase: hasPartner ? Math.round(householdIncome * (1 - primaryShare)) : 0,
    baseSpending: readWizardNumber('wizardSpending', 90000, 0, 1000000),
    retirementSpendingFraction: readWizardNumber('wizardRetirementLifestyle', 0.85, 0.4, 1.5),
    numKids: Math.round(readWizardNumber('wizardKids', 0, 0, 6)),
    ssNathanAnnual: primaryAge >= 50 ? 28000 : 20000,
    ssTanyaAnnual: hasPartner ? (spouseAge >= 50 ? 22000 : 16000) : 0,
    ssReductionFactor: primaryAge < 45 ? 0.85 : 0.95,
    years: Math.max(30, Math.min(90, 100 - primaryAge)),
  };

  if (next.numKids > 0) {
    next.firstKidYear = primaryAge >= 45 ? 0 : 2;
  }

  applyConfigFromOnboarding(next, 'Starter profile built. The YAML editor and charts now reflect these assumptions.');
}

function openGuideSection(section) {
  if (!section) return;
  setSidebarCollapsed(false, false);
  const header = document.querySelector(`.section-header[data-section="${section}"]`);
  const body = document.getElementById('sb-' + section);
  if (!header || !body) return;
  body.classList.remove('hidden');
  header.classList.add('open');
}

function clearTourHighlight() {
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
}

function focusGuideTarget(targetId, section) {
  openGuideSection(section);
  const target = document.getElementById(targetId);
  if (!target) return;
  clearTourHighlight();
  target.classList.add('tour-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => target.classList.remove('tour-highlight'), 4200);
}

function setTourStep(index) {
  if (index < 0 || index >= TOUR_STEPS.length) {
    endGuidedTour();
    return;
  }

  activeTourIndex = index;
  const step = TOUR_STEPS[index];
  focusGuideTarget(step.target, step.section);

  const callout = document.getElementById('tour-callout');
  document.getElementById('tour-progress').textContent = `Step ${index + 1} of ${TOUR_STEPS.length}`;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-body').textContent = step.body;
  document.getElementById('tour-prev').disabled = index === 0;
  document.getElementById('tour-next').textContent = index === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
  callout?.classList.remove('hidden');
}

function startGuidedTour() {
  setOnboardingVisible(false, false);
  setTourStep(0);
}

function endGuidedTour() {
  activeTourIndex = -1;
  clearTourHighlight();
  document.getElementById('tour-callout')?.classList.add('hidden');
}

function loadProfileFromText(text) {
  const textarea = document.getElementById('yamlSettings');
  if (!textarea) return false;
  textarea.value = text;
  const ok = applyYamlSettings();
  setOnboardingStatus(
    ok ? 'Profile loaded. You can close the guide or continue the tour.' : 'Profile could not be loaded. Check the YAML error in settings.',
    ok ? 'ok' : 'error'
  );
  return ok;
}

function bindOnboarding() {
  document.getElementById('open-onboarding')?.addEventListener('click', () => {
    endGuidedTour();
    setOnboardingVisible(true, false);
  });
  document.getElementById('onboarding-close')?.addEventListener('click', () => setOnboardingVisible(false, true));
  document.getElementById('onboarding-done')?.addEventListener('click', () => setOnboardingVisible(false, true));
  document.getElementById('onboarding-dismiss')?.addEventListener('click', () => {
    setOnboardingStatus('Intro guide will not open automatically. Use the header button to reopen it.', 'ok');
    setOnboardingVisible(false, true);
  });
  document.getElementById('onboarding')?.addEventListener('click', (e) => {
    if (e.target?.id === 'onboarding') setOnboardingVisible(false, true);
  });

  document.querySelectorAll('[data-onboarding-tab]').forEach(btn => {
    btn.addEventListener('click', () => showOnboardingTab(btn.dataset.onboardingTab));
  });
  document.querySelectorAll('[data-jump-onboarding-tab]').forEach(btn => {
    btn.addEventListener('click', () => showOnboardingTab(btn.dataset.jumpOnboardingTab));
  });

  document.getElementById('onboarding-load-profile')?.addEventListener('click', () => {
    document.getElementById('profileFileInput')?.click();
  });
  document.getElementById('onboarding-load-sample')?.addEventListener('click', () => {
    applyConfigFromOnboarding(sampleProfileConfig(), 'Sample profile loaded. The profile remains local to this browser.');
  });
  document.getElementById('onboarding-use-defaults')?.addEventListener('click', () => {
    applyConfigFromOnboarding({ ...FALLBACK_DEFAULT }, 'Default starter profile loaded.');
  });

  document.querySelectorAll('.profile-preset').forEach(btn => {
    btn.addEventListener('click', () => setWizardPreset(btn.dataset.profilePreset));
  });
  document.getElementById('wizardHasSpouse')?.addEventListener('change', syncWizardSpouseFields);
  document.getElementById('apply-wizard-profile')?.addEventListener('click', applyWizardProfile);
  document.getElementById('reset-wizard-profile')?.addEventListener('click', () => {
    setWizardPreset('solo');
    setOnboardingStatus('Builder reset.', '');
  });

  document.getElementById('start-ui-tour')?.addEventListener('click', startGuidedTour);
  document.querySelectorAll('.tour-step').forEach(btn => {
    btn.addEventListener('click', () => {
      setOnboardingVisible(false, false);
      focusGuideTarget(btn.dataset.guideTarget, btn.dataset.guideSection);
    });
  });
  document.getElementById('tour-prev')?.addEventListener('click', () => setTourStep(activeTourIndex - 1));
  document.getElementById('tour-next')?.addEventListener('click', () => setTourStep(activeTourIndex + 1));
  document.getElementById('tour-close')?.addEventListener('click', endGuidedTour);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const onboardingOpen = document.getElementById('onboarding')?.classList.contains('show');
    if (onboardingOpen) setOnboardingVisible(false, true);
    if (activeTourIndex >= 0) endGuidedTour();
  });

  setWizardPreset('solo');
}

export { bindOnboarding, maybeShowOnboarding, setOnboardingVisible };
