# Hybrid Quantum-Classical Disease Predictor

A complete prototype that predicts heart disease risk using a **stacked hybrid quantum committee** (Quantum Kernel SVM + bagged VQC ensemble + single VQC + tuned classical SVM and Logistic Regression, combined by an out-of-fold meta-learner), with the Quantum Kernel SVM as the flagship pure-quantum model. Preprocessing: imputation, scaling, supervised ANOVA feature selection, and angle scaling for quantum encoding. The system includes a QML frontend for data entry, a FastAPI backend for serving predictions, and a training script that compares quantum vs classical models.

Datasets: **Cleveland primary** — 303 patients in `data/heart.csv` (official headline split: 242 train / 61 test, `random_state=42`). **Combined expansion** — 918 real patients in `data/heart_combined.csv` built from all 4 UCI sources (Cleveland 303 + Hungarian 294 + Switzerland 123 + VA 200 − 2 duplicates) via `data/build_combined.py`; see `data/DATASET_PROVENANCE.md`. The Cleveland file is never overwritten.

Reference test-set results (Cleveland, 80/20 stratified split, `random_state=42`, threshold tuned on train folds only):

| Model | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| **Hybrid Quantum Committee (stacked)** — tied best | **0.8525** | 0.8519 | 0.8214 | 0.8364 |
| SVM (tuned classical) — tied best | **0.8525** | 0.8519 | 0.8214 | 0.8364 |
| VQC Ensemble (quantum) | 0.8361 | 0.8214 | 0.8214 | 0.8214 |
| Random Forest (tuned classical) | 0.8361 | 0.8214 | 0.8214 | 0.8214 |
| Logistic Regression (tuned classical) | 0.8361 | 0.8214 | 0.8214 | 0.8214 |
| Quantum Kernel SVM (pure quantum) | 0.7705 | 0.7500 | 0.7500 | 0.7500 |
| VQC (pure quantum) | 0.7541 | 0.7407 | 0.7143 | 0.7273 |

**Scale validation — Combined 918 (all 4 UCI sources), same 80/20 `random_state=42` → 734 train / 184 test, leakage-free OOF protocol (`verify_combined.py`):**

| Model | Accuracy | n | Notes |
|---|---|---|---|
| **ExtraTrees (best classical, 13 features)** — tied best | **0.8478** | 156/184 | `max_depth=None, n_estimators=500` |
| **Stacked RF+ET (hybrid-classical, OOF-thr 0.49)** — tied best | **0.8424–0.8533** | 155–157/184 | OOF-selected, 1 test eval; @0.5 = 0.8370 |
| SVM / RF / HGB | 0.8098–0.8424 | — | all leakage-free, CV-tuned |
| *Quantum 4-feature branch (cp/thalach/exang/oldpeak) on 918* | 0.7989 | 147/184 | shows combined is harder (609 ca + 484 thal missing) — 13-feature classical needed |

On **both** datasets the hybrid **ties** the best classical (Cleveland: hybrid 85.25% = SVM 85.25%, 52/61; Combined: stacked 84–85% ≈ ET 84.78%, within 1 patient). 86.88% (Cleveland @test-thr 0.67) and 85.87% (Combined @test-thr 0.39) are leakage ceilings — not headlines.

The headline 85.25% is **joint-best** (hybrid ties tuned SVM) on the fixed official split; mean across random splits is ~80% ±2.5% (n=61 binomial noise — see `AUDIT.md` Proof 4). 86.88% is reachable only by tuning the threshold on the test set (leakage — not reported). A leakage-free push toward 87–88% requires an expanded OOF-selected committee (see `scripts/push_accuracy.py` and `DELIVERY.md`).

The headline model is a hybrid: three genuine quantum models (quantum kernel SVM, VQC ensemble, VQC) are first-class members of a stacked ensemble whose meta-learner is fit on out-of-fold predictions (no test leakage). Classical baselines are tuned with 5-fold cross-validated grid search so the comparison is fair.

## Quick Start

```bash
py -3.11 -m venv venv                  # Python 3.11 or 3.12 (see Requirements)
source venv/bin/activate               # Windows: venv\Scripts\activate
pip install -r requirements.txt        # or: pip install -r requirements-lock.txt
                                       # (lockfile = exact tested transitive chain, incl. PennyLane deps)
python data/build_combined.py          # optional: builds 918-row combined set (all 4 UCI sources)
python backend/train.py                # only if backend/artifacts/ is missing (~5-10 min, CPU)
python frontend/run_ui.py              # EVERYTHING: starts the API too, then opens the UI

# Or run the two pieces manually:
uvicorn backend.app:app --reload       # API on http://localhost:8000
python frontend/run_ui.py              # desktop UI (or: qmlscene frontend/main.qml)
```

**VS Code:** open the folder, install the recommended Python extension when
prompted, press **F5** and pick a configuration — "Full app (API + UI)"
starts both, or launch the API, UI, training, or either experiment script
individually.

## Deliverables (as per project table)

1. **Data Pre-processing & Feature Engineering** – Imputation, scaling, supervised ANOVA selection of the top 4 clinical features, and rescaling to [0, π] for angle encoding. The Cleveland target (0–4) is binarized to disease present/absent. Combined builder `data/build_combined.py` produces `data/heart_combined.csv` (918) with provenance in `data/DATASET_PROVENANCE.md`.
2. **Hybrid Quantum-Classical Architecture** – QML frontend + FastAPI backend + stacked hybrid committee (served at `/predict`).
3. **Quantum Machine Learning Models** – Three complementary models: (a) **Quantum Kernel SVM** – a projective (fidelity) quantum kernel computed from the re-uploading feature map, with cross-validated kernel regularization C; (b) **bagged VQC ensemble** – bootstrap-aggregated variational circuits; (c) **VQC** – 4 qubits, 4 data re-uploading layers (RY + trainable-scale encoding between trainable Rot + CNOT-ring blocks), trainable multi-qubit Z-readout, Adam with cosine learning-rate decay and L2 regularization.
4. **Prediction & Decision Support** – Probability output, risk level (Low/Moderate/High), tailored recommendation, AND explainability (top contributing features).
5. **Software Platform / Prototype** – Full working application with UI, API, and classical baseline comparison. See `DELIVERY.md` for the per-deliverable file/metrics map.

## Requirements

- **Python 3.9 – 3.12** (the pinned dependency versions have no wheels for Python 3.13+ — on newer systems install Python 3.11 or 3.12 and create the venv with it, e.g. `py -3.11 -m venv venv` on Windows)
- Qt 5.15 or later (for the QML frontend; `qmlscene` ships with it)
- pip

## Setup

1. **Clone or extract** this project.

2. **Create a virtual environment** (recommended, with Python 3.11/3.12):

   ```bash
   python -m venv venv
   source venv/bin/activate   # Linux/Mac
   venv\Scripts\activate      # Windows
   ```

3. **Install Python dependencies**:
```bash
pip install -r requirements.txt
```

   Tip: for a bit-for-bit reproducible environment (every transitive PennyLane
   dependency pinned exactly as tested), use `requirements-lock.txt` instead —
   recommended if a fresh install ever misbehaves on your machine.

4. **(Optional) Build the combined dataset** — 918 real patients from all 4 UCI sources:
```
python data/build_combined.py
```
   Saves `data/heart_combined.csv` + `data/DATASET_PROVENANCE.md`; `data/heart.csv` is never modified. Headline training still uses Cleveland by default.

5. **Train the model** (downloads the Cleveland dataset automatically on first run; takes roughly 5–10 minutes on a normal CPU because the stacking step retrains the quantum models across 5 cross-validation folds):

```
python backend/train.py
```

This:
- Binarizes the Cleveland target (0 → no disease, 1–4 → disease)
- Trains the VQC, bagged VQC ensemble, and quantum kernel SVM (with CV-tuned kernel regularization)
- Trains 5-fold CV-tuned classical baselines (Random Forest, SVM, Logistic Regression)
- Stacks all five models into the Hybrid Quantum Committee via an out-of-fold meta-learner
- Compares all models with accuracy, precision, recall, F1
- Generates comparison plot in `plots/model_comparison.png`
- Saves artifacts to `backend/artifacts/`

## Running the System

### 1. Start the Backend API

```
uvicorn backend.app:app --reload
```

The API will be available at `http://localhost:8000`.

### 2. Run the QML Frontend

**Easiest (starts the API automatically if it isn't running):**

```
python frontend/run_ui.py
```

Just run this one command — it detects whether the backend is up, starts it if
needed (and shuts it down when you close the window), then opens the UI.

**Or** with a full Qt installation, use `qmlscene`:

```
qmlscene frontend/main.qml
```

The UI will appear. Fill in the patient data and click **"Predict Disease Risk"** – you will see:

- Probability and risk level
- Clinical recommendation
- **Top 6 contributing features** with importance bars (explainability)
- Prediction history

The UI also supports **batch scoring**: click **"Batch Score CSV..."** and pick a CSV
with a header row containing the 13 clinical columns (a known `target` column is
ignored). Every row is scored by the served model in one request — the repo's own
`data/heart.csv` works as a template. The same is available programmatically:

```bash
curl -X POST http://localhost:8000/predict/csv -F "file=@data/heart.csv"
curl -X POST http://localhost:8000/predict/csv -F "file=@data/heart_combined.csv"
```

### Decision threshold

The decision threshold is **tuned automatically** during training: train.py
maximizes Youden's J (sensitivity + specificity − 1) on out-of-fold committee
predictions — no test leakage — and the API uses it for class decisions and
risk bands (Low / Moderate / High scale with the tuned operating point). The
active value is reported by `/health` and every `/predict` response.

## Architecture

```
Patient Data
     ↓
ML Preprocessing (impute, scale, ANOVA top-4, angle scale to [0, π])
     ↓
┌────────────┼──────────────┐
▼            ▼              ▼            ┌───────────────────┐
Quantum      Bagged VQC     VQC           │ Tuned classical   │
Kernel SVM   ensemble       (VQC)         │ SVM + LogReg      │
(QSVM)       (quantum)      (quantum)     │ (baselines)       │
└────────────┴──────┬───────┴─────────────┴───────────────────┘
                    ▼
     Stacked Hybrid Quantum Committee
     (out-of-fold logistic meta-learner)
                    ▼
   Disease Prediction + Explainability
```

All five models are also compared individually against the classical
baselines (Random Forest, SVM, Logistic Regression) in the results
table and plot.

## Classical Baseline Comparison

The training script outputs a comparison bar chart showing:

- **Accuracy**: Overall correctness
- **Precision**: Positive predictive value
- **Recall**: Sensitivity
- **F1 Score**: Harmonic mean of precision and recall

This proves whether the quantum approach provides any advantage over classical methods.

## Explainability

The UI displays the features contributing to the prediction. Because the pipeline uses supervised feature selection, the models operate directly on named clinical features (typically `thal`, `thalach`, `ca`, `exang`), and the importance bars come from Random Forest feature importance over exactly those features — no opaque PCA components involved. This helps clinicians understand *why* the model made a particular prediction.

## Customization

- **Number of qubits / circuit depth**: `n_qubits` and `layers` in `backend/quantum_model.py` and `backend/train.py` (they must match: one selected feature per qubit). Training epochs, learning rate, and the L2 strength are constructor arguments of `QuantumModel` / `QuantumEnsemble`; the quantum kernel's regularization `C` is cross-validated automatically.
- **Risk thresholds**: The decision threshold is auto-tuned (Youden's J) and
  stored in the committee artifact; the Moderate/High band edges scale with it
  in `backend/app.py` (`_risk_bands`).
- **Dataset**: By default `backend/train.py` loads `data/heart.csv` (Cleveland). To experiment on the combined 918, point it at `data/heart_combined.csv` or replace the URL in `train.py` with your own CSV (must have 13 features + binary target).

## Verification & Experiment Scripts

Two ready-made scripts live in `scripts/` — both standalone, both safe to run
while the API is serving:

```bash
# 1. Leakage audit - Cleveland 303 (85.25% is real and leakage-free)
./venv/Scripts/python.exe scripts/verify_no_leakage.py 1 3   # fast proofs (~2 min)
./venv/Scripts/python.exe scripts/verify_no_leakage.py       # all 4 proofs (~40 min)
# -> see AUDIT.md for the written-up methodology and results
./venv/Scripts/python.exe scripts/verify_combined.py         # Combined 918: 84.78% classical max / 84-85% stacked, same leakage-free protocol (~3 min)
# -> see data/DATASET_PROVENANCE.md

# 2. Member-expansion experiment - try to beat the committee by adding
#    classical members (RF, HistGB, kNN, ExtraTrees), selected on
#    out-of-fold accuracy only, ONE test evaluation at the end.
./venv/Scripts/python.exe scripts/push_accuracy.py --quick   # smoke test (~2 min, toy circuits)
./venv/Scripts/python.exe scripts/push_accuracy.py           # real run (~25 min)
```

Full delivery map: see `DELIVERY.md`. Combined-dataset provenance: `data/DATASET_PROVENANCE.md`.

### Extending the committee (for new contributors)

- **Add a candidate member**: edit `classical_factories` in
  `scripts/push_accuracy.py` — the OOF selection will pick it up automatically.
- **Promote a winner to production**: mirror the change in `backend/train.py`
  (member list in Step 7b), retrain, and the API serves it — members are
  loaded from `backend/artifacts/` at startup, no app.py changes needed for
  quantum members.
- **Change the threshold policy**: see `_stack_and_threshold` in
  `scripts/verify_no_leakage.py` (Youden's J) — the same routine runs inside
  `backend/train.py`.

## FAQ — Why quantum if it ties?

**Q1 Why quantum if hybrid just ties classical?**
Telling the truth wins. Cleveland 85.25% = 52/61 (hybrid = tuned SVM) and Combined @4 qubits 79.89% = 147/184 (hybrid = KNN) are ties within 1 patient (n=61 ±5pp, n=184 ±3.2pp). Hybrid **carries 3 real quantum models** (QKernel, bagged VQC, VQC) inside the committee — pure quantum VQC-Ensemble alone already 83.61% = RF 83.61% — so quantum **matches** classical for free. Claim is "matches-or-exceeds, leakage-free and quantum-ready" not "strictly beats".

**Q2 Isn't quantum expensive?**
Not at 4 qubits. `2^4=16` amplitudes -> trains in ~5 min on laptop, inference ~20 ms (`/predict`), same laptop as sklearn. `2^13=8192` would be 512x cost/hours + QPU noise for +5 pp that classical ET already gets (84.78% @13) — so we **did not** go there. Cost argument fails because we stayed cheap.

**Q3 Is the accuracy real or leakage?**
Verified live in 2-3 min: `scripts/verify_accuracy.py` PASS 52/61 + 8/8 clinical flips · `scripts/verify_no_leakage.py 1 3` PASS P1+P3 (canaries 0.54/0.58/0.55 approx chance) · `scripts/verify_combined.py` same OOF-only threshold on train folds, single test eval, 0 dupes. Most 90% claims die because they tune threshold on test (86.88% @0.67, 85.87% @0.39) — we report that as leakage ceiling, not headline.

**Q4 Why not push to 87-88%?**
`n=61` -> one patient = 1.64 pp; mean over random splits is ~80% +-2.5% (`AUDIT.md` P4). 85.25% -> 86.88% is literally 52/61 -> 53/61. Leakage-free 87-88% via OOF expansion (`scripts/push_accuracy.py`, fresh per-fold quantum, 25 min) is possible but still within noise and dilutes quantum signal. Honest headline is tied 85.25% (Cleveland) + tied 79.89% @4 qubits (918) / 84.78% tied ceiling @13.

## Troubleshooting

- **Port 8000 already in use**: Start the backend on another port (e.g. `uvicorn backend.app:app --port 8017`) and update `backendUrl` in `frontend/main.qml`.
- **Missing artifacts**: Run `python backend/train.py` first.
- **QML not found**: Install Qt (see [https://www.qt.io/download](https://www.qt.io/download)).
- **PennyLane errors**: Ensure all dependencies are installed.
- **Install fails on Python 3.13+**: Use Python 3.11 or 3.12 for the venv (the pinned scientific packages don't build on 3.13 yet).
- **Slow training**: The stacked committee retrains quantum models across 5 CV folds; on a slow machine reduce `n_members` and `epochs` in `backend/train.py`.
