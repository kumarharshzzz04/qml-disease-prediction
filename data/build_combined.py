#!/usr/bin/env python3
# Built from scratch clean - replaces corrupted build_combined.py
import csv, sys, urllib.request, urllib.error, ssl
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent
try:
    sys.path.insert(0, str(PROJECT_ROOT))
    from backend.preprocess import FEATURES, TARGET
    COLUMN_NAMES = FEATURES + [TARGET]
except Exception as e:
    COLUMN_NAMES = ["age","sex","cp","trestbps","chol","fbs","restecg","thalach","exang","oldpeak","slope","ca","thal","target"]
BASE_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/"
SOURCES = {"cleveland":"processed.cleveland.data","hungarian":"processed.hungarian.data","switzerland":"processed.switzerland.data","va":"processed.va.data"}
try: ssl._create_default_https_context = ssl._create_unverified_context
except: pass
def binarize_target_value(raw: str) -> str:
    s=raw.strip()
    if s=="" or s=="?" or s.lower() in ("na","nan","null"): return ""
    try: v=float(s); return "1" if v>0 else "0"
    except: return s
def download_text(url, timeout=30):
    try:
        req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw=resp.read()
            try: return raw.decode("utf-8")
            except: return raw.decode("latin-1")
    except Exception as e:
        print(f"[warn] {url}: {e}", file=sys.stderr); return None
def parse_rows(text):
    rows=[]
    for line in text.strip().splitlines():
        line=line.strip()
        if not line: continue
        cells=[c.strip() for c in line.split(",")]
        if len(cells)<14: cells+=[""]*(14-len(cells))
        elif len(cells)>14: cells=cells[:14]
        rows.append(cells)
    return rows
def main():
    print(f"Columns: {COLUMN_NAMES}")
    per_source_rows={}; per_source_missing={}; per_source_counts={}; failed=[]
    for name,fname in SOURCES.items():
        url=BASE_URL+fname
        print(f"[{name}] {url} ...")
        text=download_text(url)
        if text is None:
            failed.append(name); per_source_counts[name]=0; per_source_missing[name]=[0]*14; per_source_rows[name]=[]; continue
        rows=parse_rows(text); per_source_rows[name]=rows; per_source_counts[name]=len(rows)
        miss=[0]*14
        for r in rows:
            for i,cell in enumerate(r):
                if cell=="?" or cell=="": miss[i]+=1
        per_source_missing[name]=miss
        print(f"  rows={len(rows)} miss={sum(miss)}")
    successful={k:v for k,v in per_source_rows.items() if len(v)>0}
    if not successful:
        print("[error] all failed", file=sys.stderr); sys.exit(1)
    all_rows=[]
    for name in SOURCES.keys(): all_rows.extend(per_source_rows.get(name,[]))
    total_before=len(all_rows)
    print(f"[combine] before dedup: {total_before}")
    binarized=[]
    for r in all_rows:
        nr=r.copy(); nr[13]=binarize_target_value(nr[13])
        for i in range(14):
            if nr[i]=="?": nr[i]=""
        binarized.append(nr)
    seen=set(); deduped=[]; dup=0
    for r in binarized:
        t=tuple(r)
        if t in seen: dup+=1
        else: seen.add(t); deduped.append(r)
    total_after=len(deduped)
    print(f"[dedup] removed {dup} -> {total_after}")
    combined_missing=[0]*14
    for r in deduped:
        for i,cell in enumerate(r):
            if cell=="": combined_missing[i]+=1
    combined_before=[0]*14
    for r in binarized:
        for i,cell in enumerate(r):
            if cell=="": combined_before[i]+=1
    heart_csv=DATA_DIR/"heart.csv"
    if heart_csv.exists(): print(f"[check] heart.csv untouched {heart_csv.stat().st_size} bytes")
    out_csv=DATA_DIR/"heart_combined.csv"
    generated_iso=datetime.now(timezone.utc).isoformat()
    with open(out_csv,"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f); w.writerow(COLUMN_NAMES); w.writerows(deduped)
    print(f"Wrote {out_csv} ({total_after} rows)")
    prov=DATA_DIR/"DATASET_PROVENANCE.md"
    lines=[]
    lines.append("# Combined Heart Disease Dataset — Provenance")
    lines.append(f"**Generated:** {generated_iso}")
    lines.append(f"**Output:** `data/heart_combined.csv` ({total_after} rows after dedup)")
    lines.append(f"**Source untouched:** `data/heart.csv`")
    lines.append("")
    lines.append("| Source | File | Rows |")
    lines.append("|---|---|---|")
    for k in SOURCES:
        lines.append(f"| {k} | {SOURCES[k]} | {per_source_counts.get(k,0)} |")
    lines.append(f"\nTotal before dedup: {total_before}, duplicates removed: {dup}, after: {total_after}")
    lines.append("")
    lines.append("## Missing per column (after dedup)")
    lines.append("| Column | "+" | ".join(SOURCES.keys())+" | Combined |")
    lines.append("|---|"+"---|"*(len(SOURCES)+1))
    for idx,col in enumerate(COLUMN_NAMES):
        counts=[str(per_source_missing.get(k,[0]*14)[idx]) for k in SOURCES]
        lines.append(f"| {col} | "+" | ".join(counts)+f" | {combined_missing[idx]} |")
    c=Counter([r[13] for r in deduped])
    lines.append(f"\nTarget: 0={c.get('0',0)} 1={c.get('1',0)}")
    lines.append(f"Expected 920 before dedup (303+294+123+200); actual {total_before}->{total_after}")
    lines.append("- Column order from backend/preprocess.py; run python data/build_combined.py to regenerate.")
    prov.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {prov}")
    print("=== DONE ===")
if __name__=="__main__": main()
