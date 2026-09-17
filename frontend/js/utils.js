/**
 * @fileoverview Shared utility functions for the Quemeds frontend.
 *
 * Pure functions for formatting, risk-level determination, and
 * timestamp generation. No DOM manipulation or side effects.
 */

import { RISK_COLORS } from './constants.js';

/**
 * Format a 0–1 probability as a percentage string.
 * @param {number} prob — Value between 0 and 1.
 * @returns {string} e.g. "38.1%"
 */
export function formatProbability(prob) {
  return `${(prob * 100).toFixed(1)}%`;
}

/**
 * Normalise a risk level string to its lowercase CSS class.
 * @param {string} risk — "Low", "Moderate", or "High"
 * @returns {string} "low" | "moderate" | "high"
 */
export function getRiskClass(risk) {
  return risk.toLowerCase();
}

/**
 * Return the CSS variable string for a given risk level.
 * @param {string} risk — "Low", "Moderate", or "High"
 * @returns {string} CSS variable reference
 */
export function getRiskColor(risk) {
  return RISK_COLORS[getRiskClass(risk)] || RISK_COLORS.moderate;
}

/**
 * Format a Date object into the display timestamp used in the UI.
 * @param {Date} date
 * @returns {string} e.g. "Sep 16, 2026 • 1:48 PM"
 */
export function formatTimestamp(date) {
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
