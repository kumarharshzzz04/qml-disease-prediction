import pandas as pd, numpy as np, sys
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.metrics import accuracy_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, "backend")
from preprocess import fit_preprocessor, FEATURES, TARGET
from quantum_model import QuantumModel, QuantumEnsemble, QuantumKernelClassifier

# 1. Load Cleveland
df = pd.read_csv("data/heart.csv")
y = (df[TARGET] > 0).astype(int)
X = df[FEATURES].copy()

# 2. Add Interaction Features (The "Quantum Nudge")
X['age_thalach'] = X['age'] * X['thalach']
X['oldpeak_thal'] = X['oldpeak'] * X['thal']
FEATURES_EXT = FEATURES + ['age_thalach', 'oldpeak_thal']

Xtr, Xte, yt, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
ytr = yt.values; ytev = yte.values

# 3. Pipelines: 8-qubit for Quantum
pipe_q = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
    ("selector", SelectKBest(f_classif, k=8)),
    ("angle", MinMaxScaler((0, 3.14159)))
])
pipe_q.fit(Xtr, yt)
Aq = pipe_q.transform(Xtr); Bq = pipe_q.transform(Xte)

# 4. Pipelines: All 15 for Classical
pipe_c = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
    ("angle", MinMaxScaler((0, 3.14159)))
])
pipe_c.fit(Xtr, yt)
Ac = pipe_c.transform(Xtr); Bc = pipe_c.transform(Xte)

# 5. Members Setup
cv = StratifiedKFold(5, shuffle=True, random_state=42)
names = ["qkernel", "ens", "vqc", "svm_c3", "rf_tuned", "et_tuned"]
oof = np.zeros((len(ytr), len(names)))

print("--- Training Members (OOF 5-fold) ---")
for j, name in enumerate(names):
    for tri, vai in cv.split(Aq, ytr):
        if name == "qkernel":
            m = QuantumKernelClassifier(n_qubits=8, layers=2, C=3.0)
            m.fit(Aq[tri], ytr[tri])
            oof[vai, j] = m.predict_proba(Aq[vai])[:, 1]
        elif name == "ens":
            m = QuantumEnsemble(n_qubits=8, layers=4, n_members=3, epochs=60, seed=42)
            m.fit(Aq[tri], ytr[tri], verbose=False)
            oof[vai, j] = m.predict_proba(Aq[vai])[:, 1]
        elif name == "vqc":
            m = QuantumModel(n_qubits=8, layers=4, epochs=60, seed=42)
            m.fit(Aq[tri], ytr[tri], verbose=False)
            oof[vai, j] = m.predict_proba(Aq[vai])[:, 1]
        elif name == "svm_c3":
            m = SVC(C=3, gamma=0.5, probability=True, random_state=42)
            m.fit(Ac[tri], yt.iloc[tri])
            oof[vai, j] = m.predict_proba(Ac[vai])[:, 1]
        elif name == "rf_tuned":
            m = RandomForestClassifier(n_estimators=500, max_depth=6, random_state=42)
            m.fit(Ac[tri], yt.iloc[tri])
            oof[vai, j] = m.predict_proba(Ac[vai])[:, 1]
        elif name == "et_tuned":
            m = ExtraTreesClassifier(n_estimators=500, max_depth=6, random_state=42)
            m.fit(Ac[tri], yt.iloc[tri])
            oof[vai, j] = m.predict_proba(Ac[vai])[:, 1]
    print(f"DONE: {name}")

# 6. Greedy Selection on OOF
ths = np.linspace(0.1, 0.9, 161)
best_idx = []; rem = set(range(len(names))); best_oof = -1; best_thr = 0.5
while rem:
    trial = None
    for cand in sorted(rem):
        idx = best_idx + [cand]
        # Meta: Tuned Logistic Regression
        meta = LogisticRegression(max_iter=2000).fit(oof[:, idx], ytr)
        p = meta.predict_proba(oof[:, idx])[:, 1]
        bt_acc = -1; bt = 0.5
        for t in ths:
            acc = accuracy_score(ytr, (p >= t).astype(int))
            if acc > bt_acc: bt_acc, bt = acc, t
        if trial is None or bt_acc > trial[0]: trial = (bt_acc, cand, bt)
    acc, cand, thr = trial
    if acc > best_oof + 0.001:
        best_idx.append(cand); best_oof = acc; best_thr = thr; rem.remove(cand)
        print(f"+ {names[cand]} OOF {acc:.4f} thr {thr:.3f}")
    else: break

# 7. Final Test Evaluation (ONE TIME)
meta = LogisticRegression(max_iter=2000).fit(oof[:, best_idx], ytr)
finals = {}
for idx in best_idx:
    n = names[idx]
    if n == "qkernel": finals[n] = QuantumKernelClassifier(n_qubits=8, layers=2, C=3.0); finals[n].fit(Aq, ytr)
    elif n == "ens": finals[n] = QuantumEnsemble(n_qubits=8, layers=4, n_members=3, epochs=60, seed=42); finals[n].fit(Aq, ytr, verbose=False)
    elif n == "vqc": finals[n] = QuantumModel(n_qubits=8, layers=4, epochs=60, seed=42); finals[n].fit(Aq, ytr, verbose=False)
    elif n == "svm_c3": finals[n] = SVC(C=3, gamma=0.5, probability=True, random_state=42).fit(Ac, yt)
    elif n == "rf_tuned": finals[n] = RandomForestClassifier(n_estimators=500, max_depth=6, random_state=42).fit(Ac, yt)
    elif n == "et_tuned": finals[n] = ExtraTreesClassifier(n_estimators=500, max_depth=6, random_state=42).fit(Ac, yt)

cols = np.column_stack([finals[names[i]].predict_proba(Bq if names[i] in ["qkernel","vqc","ens"] else Bc)[:,1] for i in best_idx])
proba = meta.predict_proba(cols)[:, 1]
final_acc = accuracy_score(ytev, (proba >= best_thr).astype(int))

print("==========================================")
print(f"PUSHED HYBRID ACCURACY: {final_acc:.4f} ({int(final_acc*61)}/61)")
print(f"COMPOSITION: {[names[i] for i in best_idx]}")
print(f"THRESHOLD: {best_thr:.3f}")
print("==========================================")
