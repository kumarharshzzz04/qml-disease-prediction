# Leakage Audit — Hybrid Quantum Committee (86.89%)

Independent verification that the reported **86.89% test accuracy / 0.8519 F1**
is real and free of data leakage. Headline reflects the data-dependent
Z-encoding upgrade (both VQC and QSVM now re-upload real input on the Z axis)
and artifacts rebuilt with the pinned sklearn 1.3.2.

**Rerun it yourself:**

```bash
./venv/Scripts/python.exe scripts/verify_no_leakage.py 1 3   # fast proofs (~2 min)
./venv/Scripts/python.exe scripts/verify_no_leakage.py       # all proofs (~40 min)
```

Raw evidence: `verify_heavy.log` (heavy proofs, unedited output).

## Static code audit (train.py)

| Leakage vector | Finding |
|---|---|
| Preprocessor fit scope | Initial fit **on train only**; in OOF stacking the full preprocessor (imputer+scaler+**SelectKBest selector**) is **refit per fold** so feature selection never sees validation-fold labels |
| Stacking meta-learner | Fit on **out-of-fold** predictions; final members trained on full train set; test set untouched until the single final evaluation |
| Threshold tuning | Youden's J computed **on the same OOF predictions** — never on test |
| QSVM kernel | Kernel matrix built **within the training set**; test rows only enter at predict time |
| Classical tuning | GridSearchCV internal to the training split |
| Duplicate rows | **0 duplicate feature rows** in all 303 — no train/test membrane breach possible |
| Test set usage | Exactly once, at the final evaluation |

## Proof 1 — Artifact consistency (no retraining)

Rebuilding the official split (`random_state=42`, stratified) and loading **only**
the saved artifacts reproduces the reported numbers exactly:

- accuracy **0.8689** (reported 0.8689), F1 **0.8519** (reported 0.8519), n=61, threshold 0.565

## Proof 2 — Fresh split, everything rebuilt from scratch (seed 7)

Preprocessor, VQC, ensemble, quantum kernel, classical members, OOF stacking
and threshold tuning all re-derived on a **different** split:

- prior-run (pre Z-encoding): accuracy **0.8525**, F1 0.8475 — with *different*
  selected features (`exang, oldpeak, ca, thal` vs official `thalach, exang,
  slope, thal`), different tuned C (3.0) and different threshold (0.405).
  The match with the old headline was coincidental; the independence is not.
- NOTE: these fresh-split numbers are from the pre-upgrade run. To re-measure
  stability under the Z-encoding upgrade, run the full audit:
  `./venv/Scripts/python.exe scripts/verify_no_leakage.py 2` (~30 min).

## Proof 3 — Chance controls (canaries)

Models trained on **shuffled labels**, judged on their own training data:

| Model | Accuracy on shuffled labels |
|---|---|
| Quantum fidelity kernel | 0.541 |
| Classical SVM | 0.579 |
| Logistic Regression | 0.554 |

All ≈ chance → the models learn signal, they do not memorize.

## Proof 4 — Uncertainty across independent splits

Three more full-pipeline rebuilds (seeds 1–3): **0.7705, 0.8197, 0.8033**
→ mean **0.798 ± 0.025** (95% CI [0.770, 0.826]).

## Honest interpretation (use this wording in the report)

- The **86.89%** is **real and reproducible** on the official split; the
  pipeline **generalizes** (independent prior rebuilds: 0.77–0.85).
- Across arbitrary splits the expected accuracy is **~80% ± 2.5%**; a single
  61-sample test set carries ±5pt binomial noise, and the official split is on
  the favorable side of that spread. This is normal sampling variance, **not**
  leakage — the canaries and the OOF architecture rule that out.
- The headline is **not** a threshold-tuned-on-test ceiling: 86.89% uses the
  OOF-tuned threshold (0.565) and is reproduced from artifacts alone (Proof 1).
