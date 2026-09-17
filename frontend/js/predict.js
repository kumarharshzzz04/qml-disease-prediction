/**
 * @fileoverview Predict form controller and prediction result renderer.
 *
 * Collects 13 clinical feature inputs, validates values, submits to the
 * backend prediction endpoint, updates the UI with the prediction result,
 * and records the prediction into session history.
 */

import { PATIENT_FIELDS } from './constants.js';
import { predict } from './api.js';
import { formatProbability, getRiskClass, getRiskColor } from './utils.js';
import { addHistoryEntry } from './overview.js';

/**
 * Render prediction result on the result card.
 * @param {{probability: number, risk: string, recommendation: string, threshold: number, model: string}} result
 */
export function renderPredictionResult(result) {
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

  // Add to session history
  addHistoryEntry(risk, result.probability);
}

/**
 * Initialize predict form submission listener.
 */
export function initPredict() {
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
