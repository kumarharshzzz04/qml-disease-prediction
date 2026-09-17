/**
 * @fileoverview Quemeds Unified Application Bundle
 *
 * This bundle combines the modular frontend controllers (constants, utils,
 * api, theme, navigation, overview, predict, batch) into a single, dependency-free
 * script. This enables Quemeds to run flawlessly via both local HTTP servers
 * and direct `file:///` filesystem execution without browser CORS module restrictions.
 *
 * Source modules:
 *   - js/constants.js
 *   - js/utils.js
 *   - js/api.js
 *   - js/theme.js
 *   - js/navigation.js
 *   - js/overview.js
 *   - js/predict.js
 *   - js/batch.js
 *   - js/app.js
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONSTANTS (js/constants.js)
     ========================================================================== */

  /** Base URL for the FastAPI backend. */
  const API_BASE = 'http://127.0.0.1:8000';

  /** Health-check polling interval (ms). */
  const HEALTH_CHECK_INTERVAL_MS = 6000;

  /** CSS variable names for risk-level coloring. */
  const RISK_COLORS = {
    low: 'var(--color-success)',
    moderate: 'var(--color-warning)',
    high: 'var(--color-danger)',
  };

  /** Ordered patient feature fields matching the backend PatientData model. */
  const PATIENT_FIELDS = [
    'age', 'sex', 'cp', 'trestbps', 'chol', 'fbs',
    'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal',
  ];

  /**
   * Benchmark model performance data.
   * Keys are metric names; values are arrays sorted by rank.
   */
  const BENCHMARK_DATA = {
    accuracy: [
      { name: 'Hybrid Quantum Committee', val: '0.8525', width: 85.25, type: 'primary' },
      { name: 'SVM (tuned)', val: '0.8525', width: 85.25, type: 'slate' },
      { name: 'VQC Ensemble', val: '0.8361', width: 83.61, type: 'cyan' },
      { name: 'Random Forest (tuned)', val: '0.8361', width: 83.61, type: 'slate' },
      { name: 'Logistic Regression', val: '0.8361', width: 83.61, type: 'slate' },
    ],
    f1: [
      { name: 'Hybrid Quantum Committee', val: '0.8364', width: 83.64, type: 'primary' },
      { name: 'SVM (tuned)', val: '0.8364', width: 83.64, type: 'slate' },
      { name: 'VQC Ensemble', val: '0.8214', width: 82.14, type: 'cyan' },
      { name: 'Random Forest (tuned)', val: '0.8214', width: 82.14, type: 'slate' },
      { name: 'Logistic Regression', val: '0.8214', width: 82.14, type: 'slate' },
    ],
    precision: [
      { name: 'Hybrid Quantum Committee', val: '0.8519', width: 85.19, type: 'primary' },
      { name: 'SVM (tuned)', val: '0.8519', width: 85.19, type: 'slate' },
      { name: 'VQC Ensemble', val: '0.8214', width: 82.14, type: 'cyan' },
      { name: 'Random Forest (tuned)', val: '0.8214', width: 82.14, type: 'slate' },
      { name: 'Logistic Regression', val: '0.8214', width: 82.14, type: 'slate' },
    ],
    recall: [
      { name: 'Hybrid Quantum Committee', val: '0.8214', width: 82.14, type: 'primary' },
      { name: 'SVM (tuned)', val: '0.8214', width: 82.14, type: 'slate' },
      { name: 'VQC Ensemble', val: '0.8214', width: 82.14, type: 'cyan' },
      { name: 'Random Forest (tuned)', val: '0.8214', width: 82.14, type: 'slate' },
      { name: 'Logistic Regression', val: '0.8214', width: 82.14, type: 'slate' },
    ],
  };


  /* ==========================================================================
     2. UTILITIES (js/utils.js)
     ========================================================================== */

  /**
   * Format a 0-1 probability as a percentage string.
   * @param {number} prob
   * @returns {string} e.g. "38.1%"
   */
  function formatProbability(prob) {
    return `${(prob * 100).toFixed(1)}%`;
  }

  /**
   * Normalise risk string to lowercase CSS class.
   * @param {string} risk
   * @returns {string} "low" | "moderate" | "high"
   */
  function getRiskClass(risk) {
    return (risk || 'moderate').toLowerCase();
  }

  /**
   * Return the CSS variable string for a given risk level.
   * @param {string} risk
   * @returns {string}
   */
  function getRiskColor(risk) {
    return RISK_COLORS[getRiskClass(risk)] || RISK_COLORS.moderate;
  }

  /**
   * Format a Date object into display timestamp.
   * @param {Date} date
   * @returns {string}
   */
  function formatTimestamp(date) {
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} • ${timePart}`;
  }


  /* ==========================================================================
     3. API LAYER (js/api.js)
     ========================================================================== */

  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  async function request(url, options = {}) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (networkErr) {
      throw new ApiError(
        'Unable to reach backend API. Is the server running on port 8000?',
        0
      );
    }

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail
          ? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail))
          : detail;
      } catch { /* response not JSON */ }
      throw new ApiError(detail, res.status);
    }

    return res.json();
  }

  async function checkHealth() {
    return request(`${API_BASE}/health`);
  }

  async function predict(patientData) {
    return request(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData),
    });
  }

  async function predictBatch(file) {
    const formData = new FormData();
    formData.append('file', file);
    return request(`${API_BASE}/predict/csv`, {
      method: 'POST',
      body: formData,
    });
  }

  async function getFeatureImportance() {
    return request(`${API_BASE}/feature_importance`);
  }


  /* ==========================================================================
     4. THEME CONTROLLER (js/theme.js)
     ========================================================================== */

  const SUN_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const MOON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const STORAGE_KEY = 'quemeds_theme';

  function applyTheme(theme) {
    const btn = document.getElementById('theme-toggle');
    const isDark = theme === 'dark';

    document.documentElement.setAttribute('data-theme', theme);

    if (isDark) {
      document.body.classList.add('dark-mode');
      if (btn) {
        btn.innerHTML = SUN_ICON;
        btn.setAttribute('title', 'Switch to Light Mode');
      }
    } else {
      document.body.classList.remove('dark-mode');
      if (btn) {
        btn.innerHTML = MOON_ICON;
        btn.setAttribute('title', 'Switch to Dark Mode');
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore storage errors in restricted environments */ }
  }

  function initTheme() {
    let saved = 'dark';
    try {
      saved = localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch { }
    applyTheme(saved);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const isCurrentlyDark =
          document.body.classList.contains('dark-mode') ||
          document.documentElement.getAttribute('data-theme') === 'dark';
        applyTheme(isCurrentlyDark ? 'light' : 'dark');
      });
    }
  }


  /* ==========================================================================
     5. NAVIGATION CONTROLLER (js/navigation.js)
     ========================================================================== */

  let currentView = 'overview';

  function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    const targetNav = document.getElementById(`nav-${viewName}`);
    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initNavigation() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) switchView(view);
      });
    });

    // Make switchView globally accessible for inline buttons
    window.switchView = switchView;
  }


  /* ==========================================================================
     6. OVERVIEW & MONITORING (js/overview.js)
     ========================================================================== */

  let sessionHistory = [
    { time: 'Sep 16, 2026 • 1:48 PM', risk: 'Moderate', prob: 0.381 },
    { time: 'Sep 16, 2026 • 1:47 PM', risk: 'Moderate', prob: 0.433 },
    { time: 'Sep 16, 2026 • 1:47 PM', risk: 'Moderate', prob: 0.550 },
    { time: 'Sep 16, 2026 • 1:46 PM', risk: 'Low', prob: 0.245 },
    { time: 'Sep 16, 2026 • 1:45 PM', risk: 'Moderate', prob: 0.423 },
  ];

  function updateHistoryUI() {
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

  function addHistoryEntry(risk, prob) {
    const timeStr = formatTimestamp(new Date());
    sessionHistory.unshift({ time: timeStr, risk, prob });
    updateHistoryUI();
  }

  async function checkApiHealth() {
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

  function initOverview() {
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


  /* ==========================================================================
     7. PREDICT FORM (js/predict.js)
     ========================================================================== */

  function renderPredictionResult(result) {
    const banner = document.getElementById('res-banner');
    const riskLevel = document.getElementById('res-risk-level');
    const probVal = document.getElementById('res-prob-val');
    const probBar = document.getElementById('res-prob-bar');
    const rec = document.getElementById('res-recommendation');
    const modelName = document.getElementById('res-model-name');
    const thresh = document.getElementById('res-threshold-val');

    const probPct = formatProbability(result.probability);
    const risk = result.risk;
    const riskLower = getRiskClass(risk);

    if (banner) banner.className = `result-banner ${riskLower}`;
    if (riskLevel) riskLevel.textContent = `${risk} Risk`;
    if (probVal) probVal.textContent = probPct;
    if (probBar) {
      probBar.style.width = probPct;
      probBar.style.background = getRiskColor(risk);
    }
    if (rec) rec.textContent = result.recommendation;
    if (modelName) modelName.textContent = result.model;
    if (thresh) thresh.textContent = result.threshold;

    addHistoryEntry(risk, result.probability);
  }

  function initPredict() {
    const form = document.getElementById('predict-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('predict-submit-btn');
      if (!submitBtn) return;

      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Running Hybrid Assessment...';

      const payload = {};
      for (const field of PATIENT_FIELDS) {
        const el = document.getElementById(`field-${field}`);
        if (!el || el.value.trim() === '') {
          alert(`Please provide a valid value for ${field}.`);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }
        payload[field] = Number(el.value);
      }

      try {
        const data = await predict(payload);
        renderPredictionResult(data);
      } catch (err) {
        alert('Prediction Error: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }


  /* ==========================================================================
     8. BATCH ANALYSIS (js/batch.js)
     ========================================================================== */

  let selectedBatchFile = null;
  let batchPredictionData = null;

  function handleSelectedFile(file) {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a valid .csv file');
      return;
    }
    selectedBatchFile = file;
    const fileNameSpan = document.getElementById('batch-filename');
    const fileDetails = document.getElementById('batch-file-details');
    if (fileNameSpan) {
      fileNameSpan.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }
    if (fileDetails) {
      fileDetails.style.display = 'flex';
    }
  }

  function renderBatchResults(data) {
    const container = document.getElementById('batch-results-container');
    if (container) container.style.display = 'block';

    const preds = data.predictions || [];
    const low = preds.filter((p) => p.risk === 'Low').length;
    const mod = preds.filter((p) => p.risk === 'Moderate').length;
    const high = preds.filter((p) => p.risk === 'High').length;
    const avg = preds.length > 0
      ? (preds.reduce((acc, p) => acc + p.probability, 0) / preds.length * 100).toFixed(1)
      : '0.0';

    const elTotal = document.getElementById('batch-stat-total');
    const elLow = document.getElementById('batch-stat-low');
    const elMod = document.getElementById('batch-stat-mod');
    const elHigh = document.getElementById('batch-stat-high');
    const elAvg = document.getElementById('batch-stat-avg');

    if (elTotal) elTotal.textContent = data.n_rows;
    if (elLow) elLow.textContent = low;
    if (elMod) elMod.textContent = mod;
    if (elHigh) elHigh.textContent = high;
    if (elAvg) elAvg.textContent = `${avg}%`;

    const tbody = document.getElementById('batch-table-body');
    if (tbody) {
      tbody.innerHTML = preds.map((p) => {
        const rLower = getRiskClass(p.risk);
        return `
          <tr>
            <td><strong>#${p.row + 1}</strong></td>
            <td>${formatProbability(p.probability)}</td>
            <td><span class="badge-risk ${rLower}">${p.risk}</span></td>
            <td style="font-size: 0.8rem; color: var(--color-text-muted);">${p.recommendation}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function exportBatchCsv() {
    if (!batchPredictionData || !batchPredictionData.predictions) return;
    const header = 'Row,Probability,Risk,Recommendation\n';
    const rows = batchPredictionData.predictions.map(
      (p) => `${p.row + 1},${p.probability},${p.risk},"${p.recommendation}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quemeds_batch_predictions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function initBatch() {
    const uploadBox = document.getElementById('batch-upload-box');
    const fileInput = document.getElementById('batch-file-input');
    const scoreBtn = document.getElementById('batch-score-btn');
    const exportBtn = document.getElementById('batch-export-btn');

    if (uploadBox && fileInput) {
      uploadBox.addEventListener('click', () => fileInput.click());
      uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
      });
      uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
      uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleSelectedFile(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleSelectedFile(fileInput.files[0]);
      });
    }

    if (scoreBtn) {
      scoreBtn.addEventListener('click', async () => {
        if (!selectedBatchFile) return;
        scoreBtn.disabled = true;
        const originalText = scoreBtn.innerHTML;
        scoreBtn.innerHTML = 'Processing Quantum Predictions...';

        try {
          const data = await predictBatch(selectedBatchFile);
          batchPredictionData = data;
          renderBatchResults(data);
        } catch (err) {
          alert('Batch Analysis Error: ' + err.message);
        } finally {
          scoreBtn.disabled = false;
          scoreBtn.innerHTML = originalText;
        }
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportBatchCsv);
    }
  }


  /* ==========================================================================
     10. AUTH & USER PORTAL (js/auth.js)
     ========================================================================== */

  const STORAGE_KEY_USER = 'quemeds_active_user';

  const DEMO_PROFILES = {
    hospital: {
      name: 'Dr. Manthan',
      role: 'AIIMS Cardiology',
      email: 'm.mehta@aiims.edu',
      avatar: 'M',
      roleType: 'hospital',
      pillText: 'Hospital Account • ABDM Linked',
    },
    patient: {
      name: 'Rahul Sharma',
      role: 'Patient #QM-4821',
      email: 'rahul.s@healthid.abdm',
      avatar: 'RS',
      roleType: 'patient',
      pillText: 'Verified Patient • ABHA Active',
    },
    guest: {
      name: 'Guest Evaluator',
      role: 'SIH 2026 Jury',
      email: 'jury@sih2026.gov.in',
      avatar: 'G',
      roleType: 'hospital',
      pillText: 'Jury Session • Full Access',
    },
  };

  let currentProfile = DEMO_PROFILES.hospital;
  let activeRole = 'hospital';
  let activeAction = 'signin';

  function showAuthToast(msg) {
    let toast = document.getElementById('auth-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'auth-toast';
      toast.className = 'auth-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${msg}</span>
    `;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function openAuthModal(role = 'hospital', action = 'signin') {
    closeProfileDropdown();
    const backdrop = document.getElementById('auth-modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('open');
      switchAuthRole(role);
      switchAuthAction(action);
    }
  }

  function closeAuthModal() {
    const backdrop = document.getElementById('auth-modal-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  function switchAuthRole(role) {
    activeRole = role;
    const tabHospital = document.getElementById('role-tab-hospital');
    const tabPatient = document.getElementById('role-tab-patient');
    if (tabHospital && tabPatient) {
      if (role === 'hospital') {
        tabHospital.classList.add('active');
        tabPatient.classList.remove('active');
      } else {
        tabPatient.classList.add('active');
        tabHospital.classList.remove('active');
      }
    }
    updateActiveForm();
  }

  function switchAuthAction(action) {
    activeAction = action;
    const tabSignin = document.getElementById('tab-action-signin');
    const tabSignup = document.getElementById('tab-action-signup');
    if (tabSignin && tabSignup) {
      if (action === 'signin') {
        tabSignin.classList.add('active');
        tabSignup.classList.remove('active');
      } else {
        tabSignup.classList.add('active');
        tabSignin.classList.remove('active');
      }
    }
    updateActiveForm();
  }

  function updateActiveForm() {
    const formId = `form-${activeRole}-${activeAction}`;
    document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
    const target = document.getElementById(formId);
    if (target) target.classList.add('active');
  }

  function setProfile(profile) {
    currentProfile = profile;
    const topAvatar = document.getElementById('topbar-avatar');
    const topName = document.getElementById('topbar-user-name');
    const topBadge = document.getElementById('topbar-role-badge');

    const dropAvatar = document.getElementById('dropdown-avatar');
    const dropName = document.getElementById('dropdown-name');
    const dropEmail = document.getElementById('dropdown-email');
    const dropPill = document.getElementById('dropdown-role-pill');
    const switchRoleText = document.getElementById('switch-role-text');

    if (topAvatar) {
      topAvatar.textContent = profile.avatar;
      topAvatar.className = `user-avatar ${profile.roleType}`;
    }
    if (topName) topName.textContent = profile.name;
    if (topBadge) {
      topBadge.textContent = profile.role;
      topBadge.className = `user-role-badge ${profile.roleType}`;
    }

    if (dropAvatar) {
      dropAvatar.textContent = profile.avatar;
      dropAvatar.className = `profile-dropdown-avatar ${profile.roleType}`;
    }
    if (dropName) dropName.textContent = profile.name;
    if (dropEmail) dropEmail.textContent = profile.email;
    if (dropPill) {
      dropPill.textContent = profile.pillText;
      dropPill.className = `profile-pill ${profile.roleType}`;
    }
    if (switchRoleText) {
      switchRoleText.textContent =
        profile.roleType === 'hospital' ? 'Switch to Patient Portal' : 'Switch to Clinician Portal';
    }

    try {
      localStorage.setItem(STORAGE_KEY_USER, profile.roleType);
    } catch { }
  }

  function toggleProfileDropdown() {
    const widget = document.getElementById('user-profile-widget');
    if (widget) widget.classList.toggle('active');
  }

  function closeProfileDropdown() {
    const widget = document.getElementById('user-profile-widget');
    if (widget) widget.classList.remove('active');
  }

  function initAuth() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved && DEMO_PROFILES[saved]) {
        setProfile(DEMO_PROFILES[saved]);
      } else {
        setProfile(DEMO_PROFILES.hospital);
      }
    } catch {
      setProfile(DEMO_PROFILES.hospital);
    }

    const profileBtn = document.getElementById('user-profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileDropdown();
      });
    }

    document.addEventListener('click', (e) => {
      const widget = document.getElementById('user-profile-widget');
      if (widget && !widget.contains(e.target)) {
        closeProfileDropdown();
      }
    });

    const switchRoleBtn = document.getElementById('switch-role-btn');
    if (switchRoleBtn) {
      switchRoleBtn.addEventListener('click', () => {
        const nextRole = currentProfile.roleType === 'hospital' ? 'patient' : 'hospital';
        setProfile(DEMO_PROFILES[nextRole]);
        closeProfileDropdown();
        showAuthToast(`Switched active persona to ${DEMO_PROFILES[nextRole].name} (${DEMO_PROFILES[nextRole].role})`);
      });
    }

    const openAuthBtn = document.getElementById('open-auth-btn');
    if (openAuthBtn) {
      openAuthBtn.addEventListener('click', () => {
        openAuthModal('hospital', 'signin');
      });
    }

    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', () => {
        setProfile(DEMO_PROFILES.guest);
        closeProfileDropdown();
        showAuthToast('Session reset to Guest Evaluator mode');
      });
    }

    const closeBtn = document.getElementById('auth-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeAuthModal);
    }

    const backdrop = document.getElementById('auth-modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeAuthModal();
      });
    }

    const tabHospital = document.getElementById('role-tab-hospital');
    const tabPatient = document.getElementById('role-tab-patient');
    if (tabHospital) tabHospital.addEventListener('click', () => switchAuthRole('hospital'));
    if (tabPatient) tabPatient.addEventListener('click', () => switchAuthRole('patient'));

    const tabSignin = document.getElementById('tab-action-signin');
    const tabSignup = document.getElementById('tab-action-signup');
    if (tabSignin) tabSignin.addEventListener('click', () => switchAuthAction('signin'));
    if (tabSignup) tabSignup.addEventListener('click', () => switchAuthAction('signup'));

    const demoHospitalBtn = document.getElementById('demo-hospital-btn');
    if (demoHospitalBtn) {
      demoHospitalBtn.addEventListener('click', () => {
        setProfile(DEMO_PROFILES.hospital);
        closeAuthModal();
        showAuthToast('Authenticated as Dr. Manthan (AIIMS Delhi • Cardiology)');
      });
    }

    const demoPatientBtn = document.getElementById('demo-patient-btn');
    if (demoPatientBtn) {
      demoPatientBtn.addEventListener('click', () => {
        setProfile(DEMO_PROFILES.patient);
        closeAuthModal();
        showAuthToast('Authenticated as Rahul Sharma (Patient ID #QM-4821)');
      });
    }

    const forms = [
      { id: 'form-hospital-signin', profile: DEMO_PROFILES.hospital, actionText: 'Hospital Portal Signed In' },
      { id: 'form-hospital-signup', profile: DEMO_PROFILES.hospital, actionText: 'New Hospital Account Registered' },
      { id: 'form-patient-signin', profile: DEMO_PROFILES.patient, actionText: 'Patient Portal Signed In' },
      { id: 'form-patient-signup', profile: DEMO_PROFILES.patient, actionText: 'New Patient ABHA Account Created' },
    ];

    forms.forEach(({ id, profile, actionText }) => {
      const f = document.getElementById(id);
      if (f) {
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          setProfile(profile);
          closeAuthModal();
          showAuthToast(`${actionText} — Welcome, ${profile.name}!`);
        });
      }
    });

    window.openAuthModal = openAuthModal;
    window.closeAuthModal = closeAuthModal;
  }


  /* ==========================================================================
     11. BOOTSTRAP (js/app.js)
     ========================================================================== */

  function bootstrap() {
    initTheme();
    initNavigation();
    initOverview();
    initPredict();
    initBatch();
    initAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
