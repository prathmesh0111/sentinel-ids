#!/usr/bin/env python3
"""
SecureMart ML trainer — trains the two fraud-detection models on REAL traffic:

  1. RandomForestClassifier  (supervised)  — labels come from weak supervision:
     an IP window is "attack" (1) when it got blocked / brute-forced / DDoS'd /
     sent invalid IPs / jumped countries; "normal" (0) for calm legitimate use.
  2. IsolationForest         (unsupervised) — anomaly score over the same
     feature space without labels, catches novel behaviors.

Reads:  ml/data/current.json   {featureNames:[...], samples:[{f:[...],label}]}
Writes: ml/data/model.json     {rf:{...}, if:{...}, metrics:{...}}
"""
import json
import sys
import time
import math
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split

FEATURE_ORDER_DEFAULT = [
    "failed_logins_10m", "requests_1m", "burst_10s", "distinct_usernames_10m",
    "distinct_users", "geo_jumps_10m", "invalid_hits_10m", "avg_req_interval_ms",
    "ua_changes_10m", "is_private", "is_invalid_ip",
]


def export_tree_rf(tree, n_classes):
    t = tree.tree_
    node_count = t.node_count
    features = [-1] * node_count
    thresholds = [0.0] * node_count
    left = [-1] * node_count
    right = [-1] * node_count
    probs = [[0.0] * n_classes for _ in range(node_count)]
    for i in range(node_count):
        left[i] = int(t.children_left[i])
        right[i] = int(t.children_right[i])
        if t.children_left[i] == -1:  # leaf
            features[i] = -1
            counts = t.value[i][0]
            total = float(np.sum(counts))
            for c in range(min(n_classes, len(counts))):
                probs[i][c] = float(counts[c] / total) if total > 0 else 0.0
        else:
            features[i] = int(t.feature[i])
            thresholds[i] = float(t.threshold[i])
    return {"f": features, "t": thresholds, "l": left, "r": right, "p": probs}


def export_tree_if(tree):
    t = tree.tree_
    node_count = t.node_count
    features = [-1] * node_count
    thresholds = [0.0] * node_count
    left = [-1] * node_count
    right = [-1] * node_count
    for i in range(node_count):
        left[i] = int(t.children_left[i])
        right[i] = int(t.children_right[i])
        if t.children_left[i] != -1:
            features[i] = int(t.feature[i])
            thresholds[i] = float(t.threshold[i])
    return {"f": features, "t": thresholds, "l": left, "r": right}


def main():
    if len(sys.argv) < 3:
        print("usage: train.py <input.json> <output.json>")
        sys.exit(2)
    in_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    started = time.time()

    data = json.loads(in_path.read_text())
    feature_names = data.get("featureNames", FEATURE_ORDER_DEFAULT)
    raw = data.get("samples", [])
    X = np.array([s["f"] for s in raw], dtype=float)
    y = np.array([s.get("label") if s.get("label") is not None else -1 for s in raw], dtype=int)
    result = {"featureNames": feature_names, "rf": None, "if": None,
              "metrics": {"totalSamples": int(len(raw))}}

    # ── Isolation Forest (unsupervised — always trainable) ────────────────
    if_metrics = {}
    if len(X) >= 10:
        Xfinite = np.nan_to_num(X, nan=0.0, posinf=60000.0, neginf=0.0)
        contamination = 0.08 if len(X) >= 50 else 0.15
        iso = IsolationForest(n_estimators=100, contamination=contamination,
                              random_state=42, n_jobs=-1)
        iso.fit(Xfinite)
        scores = -iso.score_samples(Xfinite)  # higher = more anomalous
        if_metrics = {
            "nEstimators": 100,
            "contamination": contamination,
            "meanAnomaly": float(np.mean(scores)),
            "maxAnomaly": float(np.max(scores)),
            "trainedOn": int(len(X)),
        }
        result["if"] = {
            "nSamples": int(len(X)),
            "trees": [export_tree_if(est) for est in iso.estimators_],
            "metrics": if_metrics,
            "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "version": data.get("version", 1),
        }

    # ── Random Forest (supervised — needs both classes) ───────────────────
    mask = y >= 0
    Xl, yl = X[mask], y[mask]
    rf_metrics = {"note": "not enough labeled data — rule engine only"}
    if len(Xl) >= 20 and len(set(yl.tolist())) == 2:
        Xfinite = np.nan_to_num(Xl, nan=0.0, posinf=60000.0, neginf=0.0)
        attack_ratio = float(np.mean(yl))
        rf = RandomForestClassifier(
            n_estimators=100, max_depth=12, min_samples_leaf=2,
            class_weight="balanced", random_state=42,
            n_jobs=-1, oob_score=(len(Xl) >= 40),
        )
        if len(Xl) >= 30:
            stratify = yl if min(np.bincount(yl)) >= 2 else None
            Xtr, Xte, ytr, yte = train_test_split(Xfinite, yl, test_size=0.25,
                                                  random_state=42, stratify=stratify)
            rf.fit(Xtr, ytr)
            acc = float(rf.score(Xte, yte))
            pred = rf.predict(Xte)
            tp = int(((pred == 1) & (yte == 1)).sum())
            fp = int(((pred == 1) & (yte == 0)).sum())
            fn = int(((pred == 0) & (yte == 1)).sum())
            precision = tp / (tp + fp) if tp + fp else 0.0
            recall = tp / (tp + fn) if tp + fn else 0.0
            f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
            rf_metrics = {
                "testAccuracy": round(acc, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "trainSamples": int(len(Xtr)),
                "testSamples": int(len(Xte)),
                "attackRatio": round(attack_ratio, 4),
            }
        else:
            rf.fit(Xfinite, yl)
            rf_metrics = {
                "trainAccuracy": round(float(rf.score(Xfinite, yl)), 4),
                "trainSamples": int(len(Xl)),
                "attackRatio": round(attack_ratio, 4),
            }
        if hasattr(rf, "oob_score_") and rf.oob_score:
            rf_metrics["oobScore"] = round(float(rf.oob_score_), 4)

        importances = rf.feature_importances_
        rf_metrics["featureImportances"] = {
            name: round(float(imp), 4) for name, imp in zip(feature_names, importances)
        }
        result["rf"] = {
            "classes": [int(c) for c in rf.classes_],
            "trees": [export_tree_rf(est, len(rf.classes_)) for est in rf.estimators_],
            "metrics": rf_metrics,
            "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "version": data.get("version", 1),
        }

    result["metrics"]["rf"] = rf_metrics
    result["metrics"]["if"] = if_metrics
    result["metrics"]["trainingSeconds"] = round(time.time() - started, 2)
    result["metrics"]["python"] = f"{sys.version_info.major}.{sys.version_info.minor}"
    result["metrics"]["sklearn"] = __import__("sklearn").__version__

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, separators=(",", ":")))
    print(json.dumps({
        "ok": True,
        "rfTrained": result["rf"] is not None,
        "ifTrained": result["if"] is not None,
        "totalSamples": len(raw),
        "labeledSamples": int(mask.sum()),
        "seconds": result["metrics"]["trainingSeconds"],
    }))


if __name__ == "__main__":
    main()
