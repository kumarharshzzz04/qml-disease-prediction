/**
 * @fileoverview Overview dashboard and shared UI controller.
 *
 * Handles live API health status monitoring, recent prediction session history,
 * model performance benchmark charts, and comparison metric toggles.
 */

import { BENCHMARK_DATA, HEALTH_CHECK_INTERVAL_MS } from './constants.js';
import { checkHealth } from './api.js';
import { formatProbability, getRiskClass, getRiskColor, formatTimestamp } from './utils.js';

let sessionHistory = [
  { time: 'Sep 16, 2026 • 1:48 PM', risk: 'Moderate', prob: 0.381 },
  { time: 'Sep 16, 2026 • 1:47 PM', risk: 'Moderate', prob: 0.433 },
  { time: 'Sep 16, 2026 • 1:47 PM', risk: 'Moderate', prob: 0.550 },
  { time: 'Sep 16, 2026 • 1:46 PM', risk: 'Low', prob: 0.245 },
  { time: 'Sep 16, 2026 • 1:45 PM', risk: 'Moderate', prob: 0.423 },
];

/**
 * Render the session prediction history in the overview list.
 */
export function updateHistoryUI() {
  const list = document.getElementById('overview-recent-list');
  if (!list) return;

  list.innerHTML = sessionHistory.slice(0, 5).map((item) => {
    const rLower = getRiskClass(item.risk);
    const dotColor = getRiskColor(item.risk);
    return `
      <div class="recent-item">
        <div class="recent-left">
          <div class="recent-dot" style="background: ${dotColor};"></div>
          <span class="recent-time">${item.time}</span>
          <span class="badge-risk ${rLower}">${item.risk}</span>
        </div>
        <span class="recent-prob">${formatProbability(item.prob)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Add a newly completed prediction to session history and update UI.
 * @param {string} risk - Risk level ("Low", "Moderate", "High")
 * @param {number} prob - Predicted probability (0-1)
 */
export function addHistoryEntry(risk, prob) {
  const timeStr = formatTimestamp(new Date());
  sessionHistory.unshift({ time: timeStr, risk, prob });
  updateHistoryUI();
}

/**
 * Perform health check call to API and update topbar status pill.
 */
export async function checkApiHealth() {
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  const model = document.getElementById('api-status-model');

  try {
    const data = await checkHealth();
    if (dot) dot.className = 'status-dot';
    if (text) text.textContent = 'API Connected';
    if (model) model.textContent = data.model || 'hybrid-quantum-committee (stacked)';
  } catch (e) {
    if (dot) dot.className = 'status-dot error';
    if (text) text.textContent = 'Backend Offline';
    if (model) model.textContent = 'Run `python -m uvicorn backend.app:app`';
  }
}

/**
 * Initialise overview dashboard elements, benchmark selector, and health polling.
 */
export function initOverview() {
  updateHistoryUI();
  checkApiHealth();
  setInterval(checkApiHealth, HEALTH_CHECK_INTERVAL_MS);

  // Model Performance Dropdown Controller
  const metricSelect = document.getElementById('overview-metric-select');
  if (metricSelect) {
    metricSelect.addEventListener('change', (e) => {
      const metric = e.target.value;
      const chart = document.getElementById('overview-perf-chart');
      const items = BENCHMARK_DATA[metric];
      if (!chart || !items) return;

      chart.innerHTML = items.map((item) => `
        <div class="perf-row">
          <span class="perf-name">${item.name}</span>
          <div class="perf-track"><div class="perf-bar ${item.type}" style="width: ${item.width}%;"></div></div>
          <span class="perf-val">${item.val}</span>
        </div>
      `).join('');
    });
  }

  // Benchmark Metric Toggles in Model Comparison View
  const toggles = document.querySelectorAll('#benchmark-metric-toggles button');
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggles.forEach((b) => {
        b.className = 'btn btn-outline';
      });
      btn.className = 'btn btn-primary';
    });
  });
}
