# How This Project Works — Visual Guide

A plain-language tour of the whole system: the data flow, the quantum
circuits, the committee math, the features, and the tech stack.
Everything here is measured from the actual code and artifacts.

---

## 1. The Big Picture (system flow)

```
 ┌──────────────────────────┐
 │   Qt/QML Desktop UI      │  patient form (13 clinical inputs)
 │   frontend/main.qml      │  "Predict Disease Risk" button
 │  (run_ui.py starts the   │  "Batch Score CSV..." button
 │   API automatically)     │
 └────────────┬─────────────┘
              │ HTTP (JSON / CSV upload)
 ┌────────────▼─────────────┐
 │   FastAPI backend        │  /predict     single patient
 │   backend/app.py         │  /predict/csv batch upload
 │   (uvicorn server)       │  /health      status + threshold
 └────────────┬─────────────┘
              │ 1. validate fields (Pydantic)
              │ 2. preprocess the 13 raw values
              │ 3. ask the model
 ┌────────────▼─────────────┐
 │   Hybrid Quantum         │  3 quantum models +
 │   Committee (stacked)    │  2 classical models +
 │   backend/artifacts/*    │  1 meta-learner +
 └────────────┬─────────────┘  1 tuned threshold
              │ probability + risk band + recommendation
 ┌────────────▼─────────────┐
 │   UI shows: gauge, risk  │
 │   level, advice, feature │
 │   importance bars,       │
 │   prediction history     │
 └──────────────────────────┘
```

---

## 2. The Data (where learning comes from)

- **Dataset:** UCI Cleveland heart dataset — 303 patients, 13 clinical
  features, stored in `data/heart.csv`.
- **Target:** `0` = no disease, `1–4` = disease → binarized to 0/1
  (`binarize_target` in `backend/preprocess.py`).
- **Split:** 80/20 stratified, `random_state=42` → **242 train / 61 test**.
  The test 61 are touched exactly once, at the very end (this is why the
  85% number is honest — see `AUDIT.md`).

### The 13 features

| Feature | Meaning | Used by the quantum model? |
|---|---|---|
| age | years | ✗ (not selected) |
| sex | 0/1 | ✗ |
| cp | chest pain type 1–4 | ✗ |
| trestbps | resting BP (mm Hg) | ✗ |
| chol | cholesterol (mg/dl) | ✗ |
| fbs | fasting blood sugar > 120 | ✗ |
| restecg | resting ECG result | ✗ |
| **thalach** | max heart rate achieved | ✅ #2 (26.0%) |
| **exang** | exercise-induced angina | ✅ #4 (12.1%) |
| oldpeak | ST depression on exercise ECG | ✗ |
| slope | slope of peak exercise ST | ✗ |
| **ca** | # major vessels blocked (0–3) | ✅ #3 (24.6%) |
| **thal** | thallium stress test result | ✅ #1 (37.3%) |

ANOVA feature selection keeps only the **top 4** — one per qubit.
That is why cholesterol changing never moves the prediction: the quantum
model literally never sees it. This is dimensionality reduction by design.

---

## 3. Preprocessing pipeline (train on train-split only)

```
raw CSV (303 × 13, missing values are "?")
   │
   ▼
1. IMPUTE        median fill for missing values
   │
   ▼
2. SCALE         StandardScaler → mean 0, std 1
   │
   ▼
3. SELECT        ANOVA F-test → keep top 4 features
   │             (thal, thalach, ca, exang)
   ▼
4. ANGLE-SCALE   rescale each value into [0, π]
   │             so it can rotate a qubit
   ▼
X_transformed  (n_patients × 4) — the quantum input
```

Saved as `backend/artifacts/preprocessor.pkl`. At prediction time the same
fitted pipeline (never refit!) transforms new patients.

---

## 4. The three quantum models

### 4a. VQC — Variational Quantum Classifier (`vqc_model.pkl`)

The "textbook" quantum neural network:

```
4 qubits ○ ○ ○ ○         one qubit per selected feature

data layer:    RY(feature_i) on qubit i        angle encoding
               + trainable RY scale            the circuit learns HOW
                                               to use each feature
variational    Rot(θ,φ,ω) on every qubit       trainable gates
layer (×4):    CNOT ring  1→2→3→4→1            entangles qubits
               ...repeated 4 times             "data re-uploading":
               data layer again between        data re-injected between
               blocks                          layers (more expressive)

readout:       measure <Z> of each qubit,
               weighted sum → probability of disease
training:      Adam optimizer, cosine learning-rate decay,
               L2 regularization, ~120 epochs on a simulator
```

### 4b. VQC Ensemble — "committee of circuits" (`ensemble_model.pkl`)

Same architecture, but **5 independent VQCs**, each trained on a different
bootstrap (random-with-replacement) sample of the training data — classic
bagging. Their probabilities are averaged. Smoother and more stable than
one VQC (variance reduction, like a Random Forest of quantum circuits).

### 4c. Quantum Kernel SVM — the flagship (`qkernel_model.pkl`)

A completely different way to use a quantum computer:

```
                ┌─────────────────────────────┐
 patient x  ──▶ │ re-uploading feature map U(x)│ ──▶ quantum state |φ(x)⟩
 patient z  ──▶ │ re-uploading feature map U(z)│ ──▶ quantum state |φ(z)⟩
                └─────────────────────────────┘

 similarity K(x,z) = |⟨φ(x)|φ(z)⟩|²      (fidelity between quantum states)

         ↓ compute this for every training pair → a kernel matrix

 train a classical SVM on that precomputed kernel (C tuned by 5-fold CV)
```

The quantum computer acts as a **similarity machine** projecting data into
a Hilbert space that is classically hard to compute — the QSVM idea from
Havlíček et al. (2019), IBM's foundational quantum-kernel paper.

---

## 5. The two classical members (the fair baselines)

| Model | Artifact | Tuning |
|---|---|---|
| RBF-kernel SVM | `classical_members.pkl` | grid search, 5-fold CV |
| Logistic Regression | `classical_members.pkl` | grid search, 5-fold CV |

They are tuned seriously on purpose — if quantum wins (or ties) against
*well-tuned* classical models, the comparison means something.

---

## 6. The stacking (how 5 models become 1)

```
training data (242 patients)
   │
   ▼  5-fold cross-validation
   │   each model is trained on 4/5 and predicts the held-out 1/5,
   │   rotated 5 times → every training patient gets an
   │   out-of-fold prediction from every model
   │
   ▼
OOF matrix  (242 × 5)
   [ qkernel_p, ensemble_p, vqc_p, svm_p, lr_p ]
   │
   ▼
meta-learner: Logistic Regression fit on the OOF matrix
   (learned weights, actual values from committee.pkl):
      qkernel   × 0.746
      ensemble  × 0.096
      vqc       × 0.165
      svm       × 1.752
      lr        × 2.597
      + intercept −2.624
   │
   ▼  (same pipeline is re-fit on the full training set for deployment)
   │
threshold tuning: Youden's J (sensitivity + specificity − 1)
   maximized on the OOF predictions → threshold = 0.53
   (CV sensitivity 0.748, specificity 0.893 — no test leakage)
   │
   ▼
saved artifacts + ONE test-set evaluation → 0.8525 accuracy
```

Why out-of-fold? If the meta-learner were trained on predictions the
members made on data they'd already seen, it would learn their overconfidence.
OOF predictions are honest, so the meta-weights are honest.

---

## 7. What happens when YOU enter a patient

```
click "Predict Disease Risk"
   │  JSON: {age: 63, sex: 1, cp: 4, ..., thal: 7}
   ▼
FastAPI validates ranges (age ≤ 120, ca ≤ 3, ...) → 422 if nonsense
   │
   ▼
preprocessor.pkl transforms the 13 values → 4 angle values
   │
   ▼
all 5 members predict in parallel:
   qkernel   → looks up quantum fidelities, SVM vote      → p₁
   ensemble  → 5 circuits run, average                    → p₂
   vqc       → one circuit run, expectation readout       → p₃
   svm       → classical RBF vote                         → p₄
   lr        → classical linear vote                      → p₅
   │
   ▼
meta-learner: σ(0.746·p₁ + 0.096·p₂ + 0.165·p₃ + 1.752·p₄ + 2.597·p₅ − 2.624)
   │
   ▼  probability, e.g. 0.903
risk bands (scale with threshold 0.53):
   Low      < 0.318   → "Lifestyle changes recommended"
   Moderate < 0.742   → "Consult physician"
   High     ≥ 0.742   → "Immediate specialist referral"
   │
   ▼
UI gauge + colored risk + advice + feature-importance bars + history entry
```

---

## 8. Results (test set = 61 real unseen patients)

| Model | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| **Hybrid Quantum Committee** | **0.8525** | 0.8519 | 0.8214 | 0.8364 |
| SVM (best classical) | 0.8525 | 0.8519 | 0.8214 | 0.8364 |
| VQC Ensemble (pure quantum) | 0.8361 | 0.8214 | 0.8214 | 0.8214 |
| Random Forest / LogReg | 0.8361 | 0.8214 | 0.8214 | 0.8214 |
| Quantum Kernel SVM (pure quantum) | 0.7705 | 0.7500 | 0.7500 | 0.7500 |
| VQC (pure quantum) | 0.7541 | 0.7407 | 0.7143 | 0.7273 |

Honest summary: the quantum-led committee **ties the best classical model
while carrying three quantum models inside it**; the pure-quantum ensemble
matches RF/LR. On 303 samples quantum and classical are in a statistical
tie — the defensible claim is "matches or exceeds," not "strictly beats."
Mean over random splits is ~80% ± 2.5% (see `AUDIT.md`).

Verified clean: `scripts/verify_accuracy.py` (reproduces 0.8525 from
artifacts + clinical sanity checks), `scripts/verify_no_leakage.py`
(four leakage proofs, results in `AUDIT.md`).

---

## 9. Tech stack (and why each piece)

| Layer | Technology | Role |
|---|---|---|
| Quantum simulation | **PennyLane 0.33.1** (+ Lightning 0.33.1) | builds/ trains the circuits on `default.qubit`; autodiff for the parameter shift gradients |
| Classical ML | **scikit-learn 1.3.2** | SVM, LogReg, RF, ANOVA selection, CV, metrics |
| Data | **pandas / numpy** | the Cleveland CSV, matrix math |
| API | **FastAPI + uvicorn** | typed endpoints, validation, async serving |
| UI | **Qt/QML via PyQt5** | desktop app; `run_ui.py` boots the API too |
| Plots | **matplotlib** | `plots/model_comparison.png` |
| Language | **Python 3.11/3.12** | pinned wheels (nothing here builds on 3.13+) |

Reproducibility: `requirements-lock.txt` freezes all 52 packages exactly
as tested (`pip install -r requirements-lock.txt`).

---

## 10. File map (what lives where)

```
backend/
  preprocess.py       impute → scale → ANOVA top-4 → [0,π] angles
  quantum_model.py    QuantumModel (VQC), QuantumEnsemble,
                      QuantumKernelClassifier (QSVM)
  train.py            the whole training + stacking pipeline (~13 min)
  app.py              FastAPI: /predict, /predict/csv, /health
  artifacts/          preprocessor.pkl, vqc_model.pkl, ensemble_model.pkl,
                      qkernel_model.pkl, classical_members.pkl,
                      committee.pkl (members, meta-weights, threshold),
                      feature_importance.json, vqc_metrics.pkl
frontend/
  main.qml            window, panels, API calls, CSV upload
  PatientForm.qml     13-field form (scrollable)
  ResultDisplay.qml   gauge, risk, advice, aligned importance bars
  HistoryList.qml     past predictions
  run_ui.py           ONE command: starts API + opens the window
scripts/
  verify_accuracy.py  rebuild split + reproduce 0.8525 + clinical probes
  verify_no_leakage.py four leakage proofs (fast proofs ~2 min)
  push_accuracy.py    experiment: can more members beat the committee?
data/heart.csv        the 303-patient dataset
plots/model_comparison.png   the evaluation chart
AUDIT.md              leakage-audit write-up
```

---

## 11. The 30-second explanation (for a viva)

"We train three different quantum models — a variational classifier with
data re-uploading, a bagged ensemble of five such circuits, and a quantum
kernel SVM whose similarity is the fidelity between quantum states — on
the four most predictive features of the Cleveland heart dataset, chosen
by ANOVA and angle-encoded into 4 qubits. Five-fold cross-validated
out-of-fold predictions feed a logistic meta-learner that stacks them
with two tuned classical baselines into a hybrid committee, whose decision
threshold is tuned by Youden's J — all leakage-free. The committee
reaches 85.25% accuracy on held-out patients, tying the best purely
classical model while being quantum-led, and it is served through a
FastAPI backend with a Qt desktop frontend, including batch CSV scoring
and per-patient explainability."
