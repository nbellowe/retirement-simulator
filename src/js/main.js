import {
  setOnRender as uiSetOnRender,
  bindSidebarToggle, bindYamlEditor, bindInputs, bindDragDrop,
  syncUIFromCfg, applyMetaDefaults,
  loadProfileFromStorage,
} from './ui.js';
import {
  setOnRender as scenariosSetOnRender,
  setSyncUICallback,
  renderPresets,
  renderScenarioGrid,
} from './scenarios.js';
import {
  updateMetrics, updatePortfolioChart, updateCashflowChart, updateDistChart,
  updateFeasibilityHeatmap, updateHistoricalCohortChart, updateLifestyleChart,
  updateGuardrailsInsight,
} from './charts.js';
import { runMonteCarlo } from './simulation.js';
import { cfg } from './config.js';
import {
  setOnRender as onboardingSetOnRender,
  bindOnboarding, maybeShowOnboarding,
} from './onboarding.js';

let renderTimer = null;

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(doRender, 60);
}

function doRender() {
  document.getElementById('computing').classList.add('show');
  // Let the browser paint the spinner before heavy computation
  requestAnimationFrame(() => {
    const stats = runMonteCarlo(cfg);
    updateMetrics(stats);
    updatePortfolioChart(stats);
    updateHistoricalCohortChart();
    updateLifestyleChart(stats);
    updateCashflowChart(stats.medianPath);
    updateDistChart(stats.finalVals);
    updateGuardrailsInsight(stats);

    // Lazy compute scenario grid (computed once then cached, only custom updates)
    setTimeout(() => {
      updateFeasibilityHeatmap();
      renderScenarioGrid(stats);
      document.getElementById('computing').classList.remove('show');
    }, 0);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  uiSetOnRender(scheduleRender);
  scenariosSetOnRender(scheduleRender);
  onboardingSetOnRender(scheduleRender);
  setSyncUICallback(syncUIFromCfg);

  applyMetaDefaults();
  renderPresets();
  bindSidebarToggle();
  bindOnboarding();
  bindYamlEditor();
  bindInputs();
  bindDragDrop();

  const profileWasLoaded = loadProfileFromStorage();
  if (!profileWasLoaded) {
    syncUIFromCfg();
    scheduleRender();
  }
  maybeShowOnboarding();
});
