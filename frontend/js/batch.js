/**
 * @fileoverview Batch analysis controller for CSV uploading, prediction, and export.
 *
 * Provides drag-and-drop CSV handling, multi-patient scoring through the
 * backend API, aggregate summary metrics rendering, tabular risk display,
 * and CSV export.
 */

import { predictBatch } from './api.js';
import { formatProbability, getRiskClass } from './utils.js';

let selectedBatchFile = null;
let batchPredictionData = null;

/**
 * Handle validation and selection of a CSV file.
 * @param {File} file
 */
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

/**
 * Render batch prediction results into the statistics cards and table.
 * @param {{n_rows: number, threshold: number, model: string, predictions: Array}} data
 */
export function renderBatchResults(data) {
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

/**
 * Export scored batch results as a downloaded CSV file.
 */
export function exportBatchCsv() {
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

/**
 * Initialize batch upload listeners, drag-and-drop, scoring, and CSV export.
 */
export function initBatch() {
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
