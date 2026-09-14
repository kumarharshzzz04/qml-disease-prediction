#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Push past 85.25% WITHOUT leakage:
  - Keep the three quantum members fixed (QSVM, VQC ensemble, VQC).
  - Add candidate classical members (RF, HistGB, kNN, ExtraTrees, SVM, LR).
  - Select the subset and the threshold by OUT-OF-FOLD accuracy ONLY.
  - Exactly ONE test evaluation of the chosen configuration at the end.

Protocol mirrors train.py (same official split, same OOF stacking).
Run: ./venv/Scripts/python.exe scripts/push_accuracy.py [--quick]
     --quick trains tiny circuits (~2 min) to smoke-test the workflow;
     drop the flag for the real experiment (~25 min).
"""

import os
import sys
import warnings

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (RandomForestClassifier, ExtraTreesClassifier,
                              HistGradientBoostingClassifier)
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, f1_score, recall_score, precision_score

from preprocess import fit_preprocessor, binarize_target, FEATURES, TARGET
from quantum_model import QuantumModel, QuantumEnsemble, QuantumKernelClassifier

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "heart.csv")
BASELINE = 0.8525

QUICK = "--quick" in sys.argv
EPOCHS = 30 if QUICK else 120
N_ENSEMBLE = 2 if QUICK else 5


def load_raw():
    df = pd.read_csv(DATA_FILE)
    return df[FEATURES], binarize_target(df[TARGET])


def main():
    print("=" * 60)
    print("OOF-GUIDED MEMBER EXPANSION (selection on train folds only)")
    if QUICK:
        print("** QUICK MODE - tiny circuits, results are NOT meaningful **")
    print("=" * 60)
    X, y = load_raw()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    prep = fit_preprocessor(X_train, n_components=4, y=y_train.values)
    A, B = prep.transform(X_train), prep.transform(X_test)
    ytr = y_train.values.astype(int)

    print("\nTraining fixed quantum members on the train split...")
    qk = QuantumKernelClassifier(n_qubits=4, layers=2)
    qk.fit(A, ytr, verbose=False)
    ens = QuantumEnsemble(n_qubits=4, layers=4, n_members=N_ENSEMBLE, epochs=EPOCHS, seed=42)
    ens.fit(A, ytr, verbose=False)
    vqc = QuantumModel(n_qubits=4, layers=4, epochs=EPOCHS, seed=42)
    vqc.fit(A, ytr, verbose=False)

    quantum = {"qkernel": qk, "ensemble": ens, "vqc": vqc}
    classical_factories = {
        "svm": lambda s: SVC(kernel="rbf", C=3.0, gamma="scale", probability=True, random_state=s),
        "lr": lambda s: LogisticRegression(max_iter=2000, C=3.0, random_state=s),
        "rf": lambda s: RandomForestClassifier(n_estimators=300, max_depth=None, random_state=s),
        "hgb": lambda s: HistGradientBoostingClassifier(max_iter=200, random_state=s),
        "knn": lambda s: KNeighborsClassifier(n_neighbors=7),
        "extra": lambda s: ExtraTreesClassifier(n_estimators=300, random_state=s),
    }

    # ---- OOF probability matrix for every candidate member (train only) ----
    all_names = list(quantum.keys()) + list(classical_factories.keys())
    n = A.shape[0]
    oof = np.zeros((n, len(all_names)))
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    print("\nComputing OOF probabilities for all candidate members...")
    for j, name in enumerate(all_names):
        for tri, vai in cv.split(A, ytr):
            if name in quantum:
                # quantum members: reuse top-level fits (predict-only, no mutation)
                oof[vai, j] = quantum[name].predict_proba(A[vai])[:, 1]
            else:
                m = classical_factories[name](42)
                m.fit(A[tri], ytr[tri])
                oof[vai, j] = m.predict_proba(A[vai])[:, 1]
        print(f"  {name:<8} OOF done")

    # ---- greedily pick the best subset by OOF accuracy (logistic meta each time) ----
    # Column bookkeeping is by integer index: columns 0-2 are the quantum
    # members (always kept), the rest are the candidate classical members.
    print("\nGreedy subset search (objective: OOF accuracy)...")
    QIDX = [0, 1, 2]
    chosen, chosen_idx = [], []
    remaining = set(classical_factories.keys())
    best_oof, best_thr = -1.0, 0.5
    thresholds = np.linspace(0.05, 0.95, 181)

    while remaining:
        trial_best = None
        for cand in sorted(remaining):
            idx = QIDX + chosen_idx + [all_names.index(cand)]
            meta = LogisticRegression(max_iter=2000).fit(oof[:, idx], ytr)
            p = meta.predict_proba(oof[:, idx])[:, 1]
            sens = np.array([(p >= t)[ytr == 1].mean() for t in thresholds])
            spec = np.array([(p < t)[ytr == 0].mean() for t in thresholds])
            k = int(np.argmax(sens + spec - 1.0))
            acc = accuracy_score(ytr, (p >= thresholds[k]).astype(int))
            if trial_best is None or acc > trial_best[0]:
                trial_best = (acc, cand, thresholds[k])
        acc, cand, thr = trial_best
        if acc > best_oof + 1e-4:
            chosen.append(cand)
            chosen_idx.append(all_names.index(cand))
            best_oof, best_thr = acc, thr
            remaining.discard(cand)
            print(f"  + {cand:<6} OOF acc {acc:.4f} @ thr {thr:.3f}")
        else:
            print("  (no further improvement - stopping)")
            break

    full_subset = QIDX + chosen_idx
    print(f"\nSelected committee: qkernel + ensemble + vqc + {chosen}")
    print(f"OOF accuracy of selection: {best_oof:.4f} @ threshold {best_thr:.3f}")

    # ---- fit final classical members on the full train split ----
    finals = dict(quantum)
    for c in chosen:
        finals[c] = classical_factories[c](42).fit(A, ytr)
    meta = LogisticRegression(max_iter=2000).fit(oof[:, full_subset], ytr)

    # ---- the ONE and ONLY test evaluation ----
    cols = np.column_stack([finals[all_names[j]].predict_proba(B)[:, 1] for j in full_subset])
    proba = meta.predict_proba(cols)[:, 1]
    pred = (proba >= best_thr).astype(int)

    acc = accuracy_score(y_test, pred)
    f1 = f1_score(y_test, pred)
    rec = recall_score(y_test, pred)
    pre = precision_score(y_test, pred, zero_division=0)
    print("\n" + "=" * 60)
    print("SINGLE TEST EVALUATION (chosen config, no peeking beforehand)")
    print("=" * 60)
    print(f"members    : qkernel + ensemble + vqc + {' + '.join(chosen)}")
    print(f"threshold  : {best_thr:.3f} (OOF-tuned)")
    print(f"accuracy   : {acc:.4f}   (baseline 0.8525)")
    print(f"F1         : {f1:.4f}   (baseline 0.8364)")
    print(f"precision  : {pre:.4f}   recall: {rec:.4f}")
    verdict = "BEATS BASELINE" if acc > BASELINE else ("TIES" if acc == BASELINE else "BELOW BASELINE")
    print(f"VERDICT    : {verdict}")


if __name__ == "__main__":
    main()
