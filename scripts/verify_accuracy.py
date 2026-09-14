#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
verify_accuracy.py -- two-part verification of the served model.

Part A: Rebuild the official split (seed 42, stratified 80/20) from the raw
        CSV, load ONLY the saved artifacts, run the exact committee inference
        path the API uses, and report held-out metrics.

Part B: Clinical-knowledge probes -- score profiles designed from the medical
        meaning of the UCI features and check the model agrees:
          - four single-feature flips (thal, thalach, ca, exang) must each
            INCREASE the predicted probability;
          - flipping a non-selected feature (chol) must NOT change the score
            (ANOVA selected only the top-4 features);
          - composite low / mid / high profiles must be strictly ordered.

Run: ./venv/Scripts/python.exe scripts/verify_accuracy.py
"""

import os
import pickle
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sklearn.model_selection import train_test_split  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
)

from backend.preprocess import (  # noqa: E402
    FEATURES, TARGET, binarize_target, load_preprocessor, transform_preprocessor,
)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARTIFACTS = os.path.join(ROOT, "backend", "artifacts")


# ---------------------------------------------------------------- committee
class LogisticRegressionStub:
    """Same reconstruction app.py performs from the stored coefficients."""

    def predict_proba(self, X):
        X = np.asarray(X, dtype=float)
        z = X @ self.coef_[0] + self.intercept_[0]
        p1 = 1.0 / (1.0 + np.exp(-z))
        return np.column_stack([1.0 - p1, p1])


def load_committee():
    with open(os.path.join(ARTIFACTS, "committee.pkl"), "rb") as f:
        bundle = pickle.load(f)
    from backend.quantum_model import (
        QuantumModel, QuantumEnsemble, QuantumKernelClassifier,
    )
    members = {
        "qkernel": QuantumKernelClassifier.load_model(
            os.path.join(ARTIFACTS, "qkernel_model.pkl")),
        "ensemble": QuantumEnsemble.load_model(
            os.path.join(ARTIFACTS, "ensemble_model.pkl")),
        "vqc": QuantumModel.load_model(
            os.path.join(ARTIFACTS, "vqc_model.pkl")),
    }
    with open(os.path.join(ARTIFACTS, "classical_members.pkl"), "rb") as f:
        members.update(pickle.load(f))
    meta = LogisticRegressionStub()
    meta.coef_ = np.array([bundle["meta_coef"]], dtype=float)
    meta.intercept_ = np.array([bundle["meta_intercept"]], dtype=float)
    threshold = round(float(bundle.get("threshold", 0.5)), 3)
    return bundle["members"], members, meta, threshold


def committee_proba(names, models, meta, X):
    cols = [models[n].predict_proba(X)[:, 1] for n in names]
    return meta.predict_proba(np.column_stack(cols))[:, 1]


def score_raw(names, models, meta, pre, df_raw):
    X = transform_preprocessor(df_raw, pre)
    return committee_proba(names, models, meta, X)


def risk_level(p, thr):
    low, high = round(0.6 * thr, 3), round(min(1.4 * thr, 0.95), 3)
    return "Low" if p < low else ("Moderate" if p < high else "High")


# ------------------------------------------------------------------- part A
def part_a():
    print("=" * 64)
    print("PART A: held-out accuracy, rebuilt from artifacts + raw CSV")
    print("=" * 64)

    df = pd.read_csv(os.path.join(ROOT, "data", "heart.csv"))
    X, y = df[FEATURES], binarize_target(df[TARGET])
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"split: {len(X_tr)} train / {len(X_te)} test  (seed 42, stratified)")

    pre = load_preprocessor(os.path.join(ARTIFACTS, "preprocessor.pkl"))
    names, models, meta, thr = load_committee()
    print(f"committee members: {names} | threshold {thr}")

    probs = score_raw(names, models, meta, pre, X_te)
    preds = (probs >= thr).astype(int)
    y_true = y_te.values

    acc = accuracy_score(y_true, preds)
    prec = precision_score(y_true, preds)
    rec = recall_score(y_true, preds)
    f1 = f1_score(y_true, preds)
    tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()

    print(f"\n  accuracy : {acc:.4f}   (expected 0.8525 = 52/61)")
    print(f"  precision: {prec:.4f}   recall: {rec:.4f}   F1: {f1:.4f}")
    print(f"  confusion: TN={tn} FP={fp} FN={fn} TP={tp}")
    ok = abs(acc - 0.8525) < 5e-4
    print(f"\nPART A VERDICT: {'PASS - matches the reported number' if ok else 'FAIL - mismatch!'}")
    return ok, (names, models, meta, pre, thr)


# ------------------------------------------------------------------- part B
BASE_LOW = {  # everything normal
    "age": 45, "sex": 0, "cp": 3, "trestbps": 118, "chol": 190, "fbs": 0,
    "restecg": 0, "thalach": 172, "exang": 0, "oldpeak": 0.4, "slope": 1,
    "ca": 0, "thal": 3,
}
MID = dict(BASE_LOW, age=57, sex=1, thalach=142, ca=1, thal=6, oldpeak=1.4)
BASE_HIGH = dict(BASE_LOW, age=66, sex=1, cp=4, trestbps=165, chol=310,
                 fbs=1, restecg=2, thalach=98, exang=1, oldpeak=3.2,
                 slope=2, ca=3, thal=7)


def part_b(ctx):
    names, models, meta, pre, thr = ctx
    print()
    print("=" * 64)
    print("PART B: clinical-knowledge probes")
    print("=" * 64)

    def p(profile):
        df = pd.DataFrame([profile])
        return float(score_raw(names, models, meta, pre, df)[0])

    checks = []

    # 1. composite profiles: strictly ordered risk
    p_low, p_mid, p_high = p(BASE_LOW), p(MID), p(BASE_HIGH)
    print(f"\ncomposite profiles (threshold {thr}, "
          f"bands: Low<{0.6*thr:.3f}  Mod<{min(1.4*thr,0.95):.3f}  High>=):")
    for label, prof, prob in [("healthy 45F", BASE_LOW, p_low),
                              ("mid-risk 57M", MID, p_mid),
                              ("classic high-risk 66M", BASE_HIGH, p_high)]:
        print(f"  {label:24s} -> {prob*100:5.1f}%  {risk_level(prob, thr)}")
    checks.append(("composite ordering low < mid < high",
                   p_low < p_mid < p_high))
    checks.append(("healthy profile lands in Low band",
                   risk_level(p_low, thr) == "Low"))
    checks.append(("classic high-risk profile lands in High band",
                   risk_level(p_high, thr) == "High"))

    # 2. single-feature flips from the healthy base must INCREASE risk
    print("\nsingle-feature flips (each must increase the probability):")
    flips = [
        ("thal   3 -> 7  (normal -> reversible defect)", {"thal": 7}),
        ("ca     0 -> 3  (no vessels -> 3 vessels)",     {"ca": 3}),
        ("exang  0 -> 1  (no angina -> exercise angina)", {"exang": 1}),
        ("thalach 172 -> 98 (high -> low max heart rate)", {"thalach": 98}),
    ]
    for label, patch in flips:
        before, after = p(BASE_LOW), p(dict(BASE_LOW, **patch))
        ok = after > before
        print(f"  {label:48s} {before*100:5.1f}% -> {after*100:5.1f}%"
              f"   {'OK' if ok else 'VIOLATION'}")
        checks.append((f"flip {label.split()[0]} increases risk", ok))

    # 3. control: a feature ANOVA did NOT select must not move the model
    before, after = p(BASE_LOW), p(dict(BASE_LOW, chol=420))
    print(f"\ncontrol: chol 190 -> 420 (not in selected top-4):"
          f" {before*100:.1f}% -> {after*100:.1f}%")
    checks.append(("chol flip leaves prediction unchanged (by design)",
                   abs(after - before) < 1e-12))

    n_ok = sum(1 for _, ok in checks if ok)
    print()
    print("=" * 64)
    print(f"PART B VERDICT: {n_ok}/{len(checks)} clinical checks passed"
          + ("" if n_ok == len(checks) else "  <-- REVIEW FAILURES"))
    print("=" * 64)
    return n_ok == len(checks)


if __name__ == "__main__":
    ok_a, ctx = part_a()
    ok_b = part_b(ctx)
    print()
    print("OVERALL:", "ALL CHECKS PASSED" if (ok_a and ok_b) else "SOMETHING FAILED")
    sys.exit(0 if (ok_a and ok_b) else 1)
