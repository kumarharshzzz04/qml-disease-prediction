/**
 * @fileoverview Centralized API layer for the Quemeds frontend.
 *
 * All fetch calls go through this module. Handles error formatting,
 * JSON parsing, and provides typed responses matching the backend
 * Pydantic models (PredictionResponse, BatchPredictionResponse).
 */

import { API_BASE } from './constants.js';

/**
 * Custom error class for API failures.
 * Contains the HTTP status code and a user-friendly message.
 */
export class ApiError extends Error {
  /**
   * @param {string} message — Human-readable error
   * @param {number} status  — HTTP status code (0 if network error)
   */
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Internal helper: perform a fetch and return parsed JSON.
 * Throws ApiError on failure.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    throw new ApiError(
      'Unable to reach the backend. Is the API server running?',
      0,
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail
        ? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail))
        : detail;
    } catch { /* response body wasn't JSON — keep statusText */ }
    throw new ApiError(detail, res.status);
  }

  return res.json();
}

/**
 * Check backend health.
 * @returns {Promise<{status: string, model: string, threshold: number}>}
 */
export async function checkHealth() {
  return request(`${API_BASE}/health`);
}

/**
 * Run a single-patient prediction.
 * @param {Record<string, number>} patientData — 13 clinical features
 * @returns {Promise<{probability: number, risk: string, recommendation: string, threshold: number, model: string}>}
 */
export async function predict(patientData) {
  return request(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patientData),
  });
}

/**
 * Run batch prediction from a CSV file.
 * @param {File} file — CSV file with 13-column header
 * @returns {Promise<{n_rows: number, threshold: number, model: string, predictions: Array}>}
 */
export async function predictBatch(file) {
  const formData = new FormData();
  formData.append('file', file);

  return request(`${API_BASE}/predict/csv`, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Fetch feature importance data (if available).
 * @returns {Promise<Object>}
 */
export async function getFeatureImportance() {
  return request(`${API_BASE}/feature_importance`);
}
