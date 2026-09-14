# Delivery Table — Fulfillment Map

Each of the 5 expected deliverables is mapped to concrete files, metrics, and how to demo it.

## 1. DATA PRE-PROCESSING & FEATURE ENGINEERING MODULE
**Requirement:** pipeline for handling biomedical data — cleaning, normalization, dimensionality reduction, feature selection, missing/noisy handling.

| Key Component / Metric | Implementation | Evidence |
|---|---|---|
| Data cleaning (missing `?` → NA) | `backend/preprocess.py` `SimpleImputer(median)` + `data/build_combined.py` `?`→`""` normalization | `data/DATASET_PROVENANCE.md` missing table (Cleveland 6 → Combined 1752 NAs) |
| Data normalization | `StandardScaler` + `MinMaxScaler(0, π)` for angle encoding | `backend/preprocess.py:build_preprocessor` steps `imputer→scaler→selector→angle` |
| Dimensionality reduction | Supervised ANOVA `SelectKBest(k=4)` (one per qubit) | `backend/train.py: fit_preprocessor(n_components=4)`; selected features logged (e.g. `thal, thalach, ca, exang`) |
| Feature selection | ANOVA F-test on train split only | `backend/preprocess.py:selected_feature_indices` |
| Handling of missing/noisy data | Median imputation; binarized target `0 vs >0`; dedup | `data/build_combined.py` 920→918 rows, 2 duplicates removed |

**Demo:** `python data/build_combined.py` downloads 4 UCI sources → `data/heart_combined.csv` (918 real patients, 410 healthy / 508 disease) + `data/DATASET_PROVENANCE.md`. `data/heart.csv` (303 Cleveland) is never overwritten.

## 2. HYBRID QUANTUM-CLASSICAL ARCHITECTURE
**Requirement:** classical front-end + QPU/simulator + data encoding.

| Key Component | Implementation |
|---|---|
| Classical front-end | `frontend/main.qml` + `PatientForm.qml` + `ResultDisplay.qml` (Qt/QML via PyQt5) |
| QPU / simulator | PennyLane `default.qubit` + Lightning; `backend/quantum_model.py` |
| Data encoding | AngleEmbedding `RY(π·s·x)` + `RZ(s)` with trainable scales `s`; rescaled to `[0, π]` |

## 3. QUANTUM MACHINE LEARNING MODELS
**Requirement:** VQC, QSVM, QNN / parameterized circuits.

| Model | File | Architecture |
|---|---|---|
| Variational Quantum Classifier (VQC) | `backend/quantum_model.py:QuantumModel` | 4 qubits × 4 re-uploading layers (RY + trainable scale + Rot + CNOT ring), weighted Z-readout, Adam + cosine decay + L2 |
| Quantum Kernel SVM (QSVM) | `backend/quantum_model.py:QuantumKernelClassifier` | Fidelity kernel `|⟨φ(x)|φ(z)⟩|²` from same re-uploading feature map; precomputed kernel SVM with CV-tuned C |
| QNN / Bagged VQC Ensemble | `backend/quantum_model.py:QuantumEnsemble` | 5 bootstrap VQCs, averaged probabilities |
| Parameterized circuits | All three; commit `vqc_model.pkl`, `ensemble_model.pkl`, `qkernel_model.pkl` |

Load: `QuantumModel.load_model`, `QuantumEnsemble.load_model`, `QuantumKernelClassifier.load_model`.

## 4. PREDICTION & DECISION SUPPORT MODULE
**Requirement:** probability scores, early risk stratification, threshold tuning.

| Metric | Implementation |
|---|---|
| Disease probability | Stacked committee `σ(meta·[p_qkernel,p_ens,p_vqc,p_svm,p_lr]+b)` in `backend/app.py:_committee_proba` |
| Early risk stratification | `Low / Moderate / High` bands scaling with tuned threshold (`_risk_bands`: `0.6·thr / 1.4·thr`) |
| Threshold tuning | Youden's J (`sens+spec-1`) on OOF predictions — train folds only, never test (`backend/train.py`) |

Endpoint `POST /predict` returns `{probability, risk, recommendation, threshold, model}`; `POST /predict/csv` batch-scores header-row CSVs. Reported on official 80/20 split (see verification).

## 5. SOFTWARE PLATFORM / PROTOTYPE
**Requirement:** UI/API, dataset upload, training/evaluation dashboard, visualization.

| Component | File |
|---|---|
| UI | `frontend/main.qml`, `frontend/run_ui.py` (one command starts API + UI) |
| API | `backend/app.py` FastAPI (`/predict`, `/predict/csv`, `/health`, `/feature_importance`) |
| Dataset upload | Batch CSV upload in UI (`Batch Score CSV...`) and `curl -F file=@data/heart.csv` |
| Training & evaluation | `backend/train.py` (5–10 min CPU, generates `plots/model_comparison.png` + artifacts) |
| Visualization | `plots/model_comparison.png` + `ResultDisplay.qml` importance bars + `feature_importance.json` |

**Quick start:**
```bash
py -3.11 -m venv venv; venv\Scripts\activate; pip install -r requirements-lock.txt
python data/build_combined.py          # optional: 918-row combined set
python backend/train.py                # retrain (headlines on Cleveland official split)
python frontend/run_ui.py              # starts API + UI
./venv/Scripts/python.exe scripts/verify_accuracy.py
./venv/Scripts/python.exe scripts/verify_no_leakage.py 1 3   # fast; full = no args
```

## Dataset Scale (your request A — 300 → 918)
- Cleveland only: `data/heart.csv` 303 patients (preserved, untracked except via `.gitignore` `!` exception — original file ships untouched)
- Combined: `data/heart_combined.csv` 918 patients (303 Cleveland + 294 Hungarian + 123 Switzerland + 200 VA − 2 exact duplicates; binarized target; `?`→empty). Provenance: `data/DATASET_PROVENANCE.md` + reproducible via `data/build_combined.py`.
- Larger alternative (~1170/1190 by adding Kaggle Heart Disease 1025/1190) available on request — same builder pattern, still all-real-patients, no synthetic leakage.

## Accuracy & Verification (push toward 87-88% leakage-free)
- Headline (artifacts as shipped): 85.25% / F1 0.8364 on official 80/20 stratified split (61 test, `random_state=42`) — see `AUDIT.md` Proof 1 (artifact reproduction) and `verify_heavy.log`.
- Optimization protocol requested: fix official split, select members + threshold on OOF train folds only, one final test evaluation. Expanded candidate pool (RF, HGB, ExtraTrees, KNN) + corrected quantum OOF (fresh per-fold instances, not reused fits) is in `scripts/push_accuracy.py` (classical) and next `train.py` upgrade. Multi-split mean ~80% ±2.5% (n=61 noise) documented in `AUDIT.md` / `HOW_IT_WORKS.md`.
- Verification scripts (all leakage-free): `scripts/verify_accuracy.py` (artifact reproduction + clinical probes), `scripts/verify_no_leakage.py` (P1 artifact match, P2 fresh split rebuild, P3 shuffled-label canaries, P4 3-split uncertainty), `verify_heavy.log` raw evidence.

