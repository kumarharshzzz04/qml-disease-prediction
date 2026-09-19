import pandas as pd, numpy as np, sys
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, "backend")
from preprocess import fit_preprocessor, FEATURES, TARGET
from quantum_model import QuantumModel, QuantumEnsemble, QuantumKernelClassifier

# 1. Load Combined (918) — Larger N is required for stable ~90%
df = pd.read_csv("data/heart_combined.csv")
y = (df[TARGET] > 0).astype(int)
X = df[FEATURES].copy()

# 2. Add Clinical Interaction Terms (Non-linear signal for Quantum/Ensembles)
X['age_thalach'] = X['age'] * X['thalach']
X['oldpeak_thal'] = X['oldpeak'] * X['thal']
X['ca_cp'] = X['ca'] * X['cp']
FEATURES_EXT = FEATURES + ['age_thalach', 'oldpeak_thal', 'ca_cp']

# 3. Protocol: Nested Cross-Validation (5x5) for true performance estimate
# We evaluate the ENTIRE pipeline (selection + training) inside folds.
outer_cv = StratifiedKFold(5, shuffle=True, random_state=42)
outer_scores = []

print(f"Starting 5-fold Nested CV on {len(df)} samples...")

for fold, (train_idx, test_idx) in enumerate(outer_cv.split(X, y)):
    Xtr, Xte = X.iloc[train_idx], X.iloc[test_idx]
    ytr, yte = y.iloc[train_idx], y.iloc[test_idx]
    
    # Preprocessing (fit on inner train only)
    # 8 qubits selected via ANOVA for interaction capture
    pipe_q = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("selector", SelectKBest(f_classif, k=8)),
        ("angle", MinMaxScaler((0, 3.14159)))
    ])
    pipe_q.fit(Xtr, ytr)
    Aq = pipe_q.transform(Xtr); Bq = pipe_q.transform(Xte)
    
    pipe_c = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("angle", MinMaxScaler((0, 3.14159)))
    ])
    pipe_c.fit(Xtr, ytr)
    Ac = pipe_c.transform(Xtr); Bc = pipe_c.transform(Xte)
    
    # Member candidates
    inner_cv = StratifiedKFold(5, shuffle=True, random_state=fold) # Different seed per inner fold
    
    # 8-qubit Quantum members (Projective Kernel + Ensemble)
    q_kernel = QuantumKernelClassifier(n_qubits=8, layers=2, C=3.0)
    q_ens = QuantumEnsemble(n_qubits=8, layers=4, n_members=3, epochs=60, seed=fold)
    
    # Classical members
    svc = SVC(C=3.0, gamma='auto', probability=True, random_state=fold)
    et = ExtraTreesClassifier(n_estimators=500, max_depth=8, random_state=fold)
    hgb = HistGradientBoostingClassifier(max_iter=200, random_state=fold)
    
    # OOF Stacking for Meta-Learner (Logistic Meta)
    members = [q_kernel, q_ens, svc, et, hgb]
    names = ["QK", "QE", "SVC", "ET", "HGB"]
    oof_preds = np.zeros((len(ytr), len(members)))
    
    for i, model in enumerate(members):
        for inner_tri, inner_vai in inner_cv.split(Aq, ytr):
            # Fit on inner train, predict on inner validation
            m_clone = model.__class__(**model.get_params()) if hasattr(model, 'get_params') else model
            # Note: manual handling for quantum clones if needed, but here constructors suffice
            if names[i] in ["QK", "QE"]:
                m_clone.fit(Aq[inner_tri], ytr.iloc[inner_tri], verbose=False if hasattr(m_clone, 'verbose') else None)
                oof_preds[inner_vai, i] = m_clone.predict_proba(Aq[inner_vai])[:, 1]
            else:
                m_clone.fit(Ac[inner_tri], ytr.iloc[inner_tri])
                oof_preds[inner_vai, i] = m_clone.predict_proba(Ac[inner_vai])[:, 1]
    
    # Train meta-learner
    meta = LogisticRegression(max_iter=2000).fit(oof_preds, ytr)
    
    # Refit all on full inner train
    q_kernel.fit(Aq, ytr); q_ens.fit(Aq, ytr, verbose=False); svc.fit(Ac, ytr); et.fit(Ac, ytr); hgb.fit(Ac, ytr)
    
    # Predict on unseen outer test
    test_cols = np.column_stack([
        q_kernel.predict_proba(Bq)[:, 1],
        q_ens.predict_proba(Bq)[:, 1],
        svc.predict_proba(Bc)[:, 1],
        et.predict_proba(Bc)[:, 1],
        hgb.predict_proba(Bc)[:, 1]
    ])
    final_proba = meta.predict_proba(test_cols)[:, 1]
    
    # Tune threshold on OOF only
    best_t = 0.5; best_t_acc = 0
    for t in np.linspace(0.1, 0.9, 101):
        p_oof = meta.predict_proba(oof_preds)[:, 1]
        acc = accuracy_score(ytr, (p_oof >= t).astype(int))
        if acc > best_t_acc: best_t_acc, best_t = acc, t
        
    fold_acc = accuracy_score(yte, (final_proba >= best_t).astype(int))
    outer_scores.append(fold_acc)
    print(f"Fold {fold+1} Accuracy: {fold_acc:.4f} (thr: {best_t:.3f})")

print("\n" + "="*40)
print(f"FINAL NESTED CV ACCURACY: {np.mean(outer_scores):.4f} (+/- {np.std(outer_scores):.4f})")
print(f"This is the TRUE generalized performance on 918 patients.")
print("="*40)
