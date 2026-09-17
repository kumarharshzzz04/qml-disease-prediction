/**
 * @fileoverview Application-wide constants for the Quemeds frontend.
 *
 * Centralizes API configuration, benchmark data, risk configuration,
 * and patient field definitions. All other modules import from here
 * instead of scattering hardcoded values.
 */

/** Base URL for the FastAPI backend. */
export const API_BASE = 'http://127.0.0.1:8000';

/** Health-check polling interval (ms). */
export const HEALTH_CHECK_INTERVAL_MS = 6000;

/** CSS variable names for risk-level coloring. */
export const RISK_COLORS = {
  low:      'var(--color-success)',
  moderate: 'var(--color-warning)',
  high:     'var(--color-danger)',
};

/** Ordered patient feature fields matching the backend PatientData model. */
export const PATIENT_FIELDS = [
  'age', 'sex', 'cp', 'trestbps', 'chol', 'fbs',
  'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal',
];

/**
 * Benchmark model performance data.
 * Keys are metric names; values are arrays sorted by rank.
 * `type` controls the bar color class: 'primary' | 'cyan' | 'slate'.
 */
export const BENCHMARK_DATA = {
  accuracy: [
    { name: 'Hybrid Quantum Committee', val: '0.8525', width: 85.25, type: 'primary' },
    { name: 'SVM (tuned)',             val: '0.8525', width: 85.25, type: 'slate'   },
    { name: 'VQC Ensemble',            val: '0.8361', width: 83.61, type: 'cyan'    },
    { name: 'Random Forest (tuned)',   val: '0.8361', width: 83.61, type: 'slate'   },
    { name: 'Logistic Regression',     val: '0.8361', width: 83.61, type: 'slate'   },
  ],
  f1: [
    { name: 'Hybrid Quantum Committee', val: '0.8364', width: 83.64, type: 'primary' },
    { name: 'SVM (tuned)',             val: '0.8364', width: 83.64, type: 'slate'   },
    { name: 'VQC Ensemble',            val: '0.8214', width: 82.14, type: 'cyan'    },
    { name: 'Random Forest (tuned)',   val: '0.8214', width: 82.14, type: 'slate'   },
    { name: 'Logistic Regression',     val: '0.8214', width: 82.14, type: 'slate'   },
  ],
  precision: [
    { name: 'Hybrid Quantum Committee', val: '0.8519', width: 85.19, type: 'primary' },
    { name: 'SVM (tuned)',             val: '0.8519', width: 85.19, type: 'slate'   },
    { name: 'VQC Ensemble',            val: '0.8214', width: 82.14, type: 'cyan'    },
    { name: 'Random Forest (tuned)',   val: '0.8214', width: 82.14, type: 'slate'   },
    { name: 'Logistic Regression',     val: '0.8214', width: 82.14, type: 'slate'   },
  ],
  recall: [
    { name: 'Hybrid Quantum Committee', val: '0.8214', width: 82.14, type: 'primary' },
    { name: 'SVM (tuned)',             val: '0.8214', width: 82.14, type: 'slate'   },
    { name: 'VQC Ensemble',            val: '0.8214', width: 82.14, type: 'cyan'    },
    { name: 'Random Forest (tuned)',   val: '0.8214', width: 82.14, type: 'slate'   },
    { name: 'Logistic Regression',     val: '0.8214', width: 82.14, type: 'slate'   },
  ],
};
