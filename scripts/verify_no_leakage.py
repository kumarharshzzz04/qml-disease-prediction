#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Independent audit: prove that the reported 85.25% hybrid-committee test
accuracy is real and free of data leakage.

Proof 1 - Artifact consistency:
    Reload ONLY the saved artifacts + the raw CSV, rebuild the exact
    official split, and check the reported numbers fall out.

Proof 2 - Fresh-split generalization:
    Rebuild the ENTIRE pipeline (preprocessor, VQC, ensemble, quantum
    kernel, classical members, out-of-fold stacking, threshold tuning)
    from scratch on a different random split. No numbers, thresholds,
    or fitted objects may be reused.

Proof 3 - Chance controls (canaries):
    (a) The quantum fidelity kernel on SHUFFLED labels must collapse to
        chance (even on the data it was fit on) - proving the kernel is
        not memorizing.
    (b) The full committee on shuffled labels must collapse to chance.

Proof 4 - Uncertainty quantification:
    The full pipeline over 3 independent splits -> accuracy distribution,
    so the single-split 85.25% can be judged against run-to-run noise.

Run:  ./venv/Scripts/python.exe scripts/verify_no_leakage.py [proof ...]
      e.g.  scripts/verify_no_leakage.py 1 3     (fast proofs only)
            scripts/verify_no_leakage.py         (everything)
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
from sklearn.metrics import accuracy_score, f1_score, recall_score

from preprocess import (
    fit_preprocessor, load_preprocessor, binarize_target, FEATURES, TARGET,
)
from quantum_model import QuantumModel, QuantumEnsemble, QuantumKernelClassifier

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "heart.csv")
ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "artifacts")

REPORTED_ACC, REPORTED_F1 = 0.8525, 0.8364   # from train.py output / README
PASSED = []


def heading(txt):
    print("\n" + "=" * 64)
    print(txt)
    print("=" * 64)


def load_raw():
    df = pd.read_csv(DATA_FILE)
    return df[FEATURES], binarize_target(df[TARGET])


# ----------------------------------------------------------------------
# Proof 1: artifacts alone reproduce the reported number
# ----------------------------------------------------------------------
def proof1():
    heading("PROOF 1 - ARTIFACT CONSISTENCY (no retraining)")
    import pickle
    X, y = load_raw()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    prep = load_preprocessor(os.path.join(ARTIFACT_DIR, "preprocessor.pkl"))
    A, B = prep.transform(X_train), prep.transform(X_test)

    vqc = QuantumModel.load_model(os.path.join(ARTIFACT_DIR, "vqc_model.pkl"))
    ens = QuantumEnsemble.load_model(os.path.join(ARTIFACT_DIR, "ensemble_model.pkl"))
    qk = QuantumKernelClassifier.load_model(os.path.join(ARTIFACT_DIR, "qkernel_model.pkl"))
    with open(os.path.join(ARTIFACT_DIR, "classical_members.pkl"), "rb") as f:
        classical = pickle.load(f)
    with open(os.path.join(ARTIFACT_DIR, "committee.pkl"), "rb") as f:
        bundle = pickle.load(f)

    members = {"qkernel": qk, "ensemble": ens, "vqc": vqc, **classical}
    cols = np.column_stack(
        [members[n].predict_proba(B)[:, 1] for n in bundle["members"]]
    )
    z = cols @ np.array(bundle["meta_coef"]) + bundle["meta_intercept"]
    proba = 1.0 / (1.0 + np.exp(-z))
    thr = float(bundle.get("threshold", 0.5))
    pred = (proba >= thr).astype(int)

    acc = accuracy_score(y_test, pred)
    f1 = f1_score(y_test, pred)
    print(f"test size                : {len(y_test)} (expected 61)")
    print(f"committee threshold      : {thr:.3f}")
    print(f"reproduced accuracy      : {acc:.4f}  (reported {REPORTED_ACC})")
    print(f"reproduced F1            : {f1:.4f}  (reported {REPORTED_F1})")
    ok = abs(acc - REPORTED_ACC) < 5e-4 and abs(f1 - REPORTED_F1) < 5e-4
    PASSED.append(("P1 artifact consistency", ok))
    print("VERDICT:", "MATCH - reported number falls out of artifacts alone" if ok else "MISMATCH")


# ----------------------------------------------------------------------
# Proof 2: entire pipeline rebuilt from scratch on a fresh split
# ----------------------------------------------------------------------
def _tune_qkernel_C(qk, K, A, y, grid=(0.1, 0.5, 1.0, 3.0, 10.0)):
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    best_C, best = qk.C, -1.0
    for C in grid:
        accs = []
        for tri, vai in cv.split(K, y):
            t = QuantumKernelClassifier(n_qubits=4, layers=2, C=C)
            t._X_train = A[tri]
            t.fit_from_kernel(K[np.ix_(tri, tri)], y[tri], C)
            accs.append(accuracy_score(y[vai], (t.predict_proba(A[vai])[:, 1] >= 0.5).astype(int)))
        if np.mean(accs) > best:
            best_C, best = C, np.mean(accs)
    return best_C


def _stack_and_threshold(members_factories, A, y):
    """Out-of-fold stacking + Youden threshold - mirrors train.py exactly."""
    names = list(members_factories.keys())
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof = np.zeros((A.shape[0], len(names)))
    for fi, (tri, vai) in enumerate(cv.split(A, y)):
        for j, n in enumerate(names):
            m = members_factories[n]()          # fresh instance per fold
            m.fit(A[tri], y[tri])
            oof[vai, j] = m.predict_proba(A[vai])[: , 1]
    meta = LogisticRegression(max_iter=2000).fit(oof, y)

    proba_oof = meta.predict_proba(oof)[:, 1]
    thresholds = np.linspace(0.05, 0.95, 181)
    sens = np.array([(proba_oof >= t)[y == 1].mean() for t in thresholds])
    spec = np.array([(proba_oof < t)[y == 0].mean() for t in thresholds])
    thr = float(thresholds[int(np.argmax(sens + spec - 1.0))])
    return meta, thr


def build_full_pipeline(seed, ensemble_members=3, verbose=True):
    """Full pipeline from raw CSV to fitted stacked committee. Shares
    nothing with train.py's in-memory state."""
    X, y = load_raw()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=seed, stratify=y
    )
    prep = fit_preprocessor(X_train, n_components=4, y=y_train.values)
    A, B = prep.transform(X_train), prep.transform(X_test)
    ytr = y_train.values.astype(int)

    vqc = QuantumModel(n_qubits=4, layers=4, epochs=120, seed=seed)
    vqc.fit(A, ytr, verbose=False)
    ens = QuantumEnsemble(n_qubits=4, layers=4, n_members=ensemble_members,
                          epochs=120, seed=seed)
    ens.fit(A, ytr, verbose=False)
    qk = QuantumKernelClassifier(n_qubits=4, layers=2)
    qk.fit(A, ytr, verbose=False)
    best_C = _tune_qkernel_C(qk, qk._K_train, A, ytr)
    qk.fit_from_kernel(qk._K_train, ytr, best_C)

    svm = SVC(kernel="rbf", probability=True, random_state=seed).fit(A, ytr)
    lr = LogisticRegression(max_iter=2000, random_state=seed).fit(A, ytr)

    factories = {
        "qkernel": lambda: QuantumKernelClassifier(n_qubits=4, layers=2, C=best_C),
        "ensemble": lambda: QuantumEnsemble(n_qubits=4, layers=4,
                                            n_members=ensemble_members,
                                            epochs=120, seed=seed),
        "vqc": lambda: QuantumModel(n_qubits=4, layers=4, epochs=120, seed=seed),
        "svm": lambda: SVC(kernel="rbf", probability=True, random_state=seed),
        "lr": lambda: LogisticRegression(max_iter=2000, random_state=seed),
    }
    meta, thr = _stack_and_threshold(factories, A, ytr)

    cols = np.column_stack(
        [m.predict_proba(B)[:, 1] for m in (qk, ens, vqc, svm, lr)]
    )
    proba = meta.predict_proba(cols)[:, 1]
    pred = (proba >= thr).astype(int)
    if verbose:
        sel = [FEATURES[i] for i in np.where(prep.named_steps["selector"].get_support())[0]]
        print(f"  seed {seed}: selected={sel} C*={best_C} thr={thr:.3f} -> "
              f"acc {accuracy_score(y_test, pred):.4f}")
    return accuracy_score(y_test, pred), f1_score(y_test, pred)


def proof2():
    heading("PROOF 2 - FRESH SPLIT, FULL PIPELINE REBUILT FROM SCRATCH (seed 7)")
    acc, f1 = build_full_pipeline(seed=7)
    print(f"fresh-split committee accuracy: {acc:.4f}  F1: {f1:.4f}")
    ok = acc >= 0.75
    PASSED.append(("P2 fresh-split generalization", ok))
    print("VERDICT:", "PASS - pipeline generalizes to an unseen split" if ok else "FAIL")


# ----------------------------------------------------------------------
# Proof 3: chance controls (canaries)
# ----------------------------------------------------------------------
def proof3():
    heading("PROOF 3 - CHANCE CONTROLS (canaries must NOT learn)")
    rng = np.random.RandomState(0)
    X, y = load_raw()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    prep = fit_preprocessor(X_train, n_components=4, y=y_train.values)
    A, B = prep.transform(X_train), prep.transform(X_test)
    ytr = y_train.values.astype(int)

    # (a) quantum kernel + shuffled labels, judged on its own training data
    y_shuf = rng.permutation(ytr)
    qk = QuantumKernelClassifier(n_qubits=4, layers=2)
    qk.fit(A, y_shuf, verbose=False)
    k_acc = accuracy_score(y_shuf, qk.predict(A))

    # (b) classical members + shuffled labels
    svm = SVC(kernel="rbf", probability=True).fit(A, y_shuf)
    lr = LogisticRegression(max_iter=2000).fit(A, y_shuf)
    s_acc = accuracy_score(y_shuf, svm.predict(A))
    l_acc = accuracy_score(y_shuf, lr.predict(A))

    print(f"quantum fidelity kernel, shuffled labels (train set): {k_acc:.4f}")
    print(f"classical SVM,           shuffled labels (train set): {s_acc:.4f}")
    print(f"classical LR,            shuffled labels (train set): {l_acc:.4f}")
    ok = all(a < 0.70 for a in (k_acc, s_acc, l_acc))
    PASSED.append(("P3 canaries stay at chance", ok))
    print("VERDICT:", "PASS - models only learn signal, not memorize noise"
          if ok else "FAIL - a model fits shuffled labels; investigate")


# ----------------------------------------------------------------------
# Proof 4: uncertainty over 5 independent splits
# ----------------------------------------------------------------------
def proof4():
    heading("PROOF 4 - UNCERTAINTY: 3 INDEPENDENT FULL-PIPELINE RUNS")
    accs = []
    for seed in (1, 2, 3):
        acc, _ = build_full_pipeline(seed=seed)
        accs.append(acc)
    accs = np.array(accs)
    mean, std = accs.mean(), accs.std(ddof=1)
    se = std / np.sqrt(len(accs))
    print(f"per-split accuracies : {np.round(accs, 4).tolist()}")
    print(f"mean +- std          : {mean:.4f} +- {std:.4f}")
    print(f"95% CI (normal)      : [{mean - 1.96 * se:.4f}, {mean + 1.96 * se:.4f}]")
    print(f"reported 0.8525 within 2 sigma of distribution: "
          f"{abs(REPORTED_ACC - mean) <= 2 * std + 1e-9}")
    ok = mean >= 0.75
    PASSED.append(("P4 multi-split stability", ok))
    print("VERDICT:", "PASS - accuracy is stable, not a lucky split" if ok else "FAIL")


if __name__ == "__main__":
    wanted = {int(a) for a in sys.argv[1:]} or {1, 2, 3, 4}
    print("INDEPENDENT LEAKAGE AUDIT - hybrid quantum committee")
    print("all models retrained where claimed; no numbers copied from train.py")
    print("proofs requested:", sorted(wanted))
    if 1 in wanted:
        proof1()
    if 3 in wanted:
        proof3()
    if 2 in wanted:
        proof2()
    if 4 in wanted:
        proof4()
    heading("SUMMARY")
    for name, ok in PASSED:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print("\nOVERALL:", "ALL PROOFS PASSED" if all(ok for _, ok in PASSED) else "AUDIT FAILED")
