"""
Test suite for the fastai crime-type prediction endpoint and model.

Runs two layers of tests:
  1. Direct model tests – calls predict_crime() without any server
  2. FastAPI TestClient tests – hits /inference/predict-crime via HTTP

Usage:
    python -m pipeline.test_fastai_endpoints
"""

from __future__ import annotations

import json
import sys
import os
import textwrap
from pathlib import Path

# ── Ensure project root is on path ──
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ═══════════════════════════════════════════════════════════════════════
# TEST CASES — diverse locations across Kenya's regional profiles
# ═══════════════════════════════════════════════════════════════════════

TEST_CASES = [
    {
        "name": "Nairobi CBD (urban hub)",
        "latitude": -1.2864,
        "longitude": 36.8172,
        "month": "2025-11",
        "falls_within": "Nairobi Metropolitan Regional Command",
        "location": "Near Nairobi CBD Market, Nairobi",
        "context": "Simulated Kenya urban zone (Nairobi Metropolitan)",
        "expected_profile": "urban",  # expect drugs/robbery/shoplifting
    },
    {
        "name": "Mombasa coast (urban/coastal)",
        "latitude": -4.0435,
        "longitude": 39.6682,
        "month": "2025-06",
        "falls_within": "Coast Regional Command",
        "location": "At Mombasa CBD Street, Mombasa",
        "context": "Simulated Kenya urban zone (Coast)",
        "expected_profile": "urban",
    },
    {
        "name": "Garissa border zone",
        "latitude": -0.4532,
        "longitude": 39.6460,
        "month": "2025-03",
        "falls_within": "Kenya Border Security Command",
        "location": "Near Garissa Town Drive, Garissa",
        "context": "Simulated Kenya border zone (North Eastern)",
        "expected_profile": "border",  # expect weapons/drugs
    },
    {
        "name": "Mandera border (Somalia)",
        "latitude": 3.9366,
        "longitude": 41.8569,
        "month": "2025-08",
        "falls_within": "Kenya Border Security Command",
        "location": "At Mandera Border Post Junction, Mandera",
        "context": "Simulated border incident corridor (Somalia/Ethiopia)",
        "expected_profile": "border",
    },
    {
        "name": "Nyeri rural (Central highlands)",
        "latitude": -0.4201,
        "longitude": 36.9476,
        "month": "2025-04",
        "falls_within": "Central Regional Command",
        "location": "Around Nyeri Town Market, Nyeri",
        "context": "Simulated Kenya rural zone (Central)",
        "expected_profile": "rural",  # expect anti-social/burglary
    },
    {
        "name": "Kisii rural (Nyanza)",
        "latitude": -0.6773,
        "longitude": 34.7796,
        "month": "2025-09",
        "falls_within": "Nyanza Regional Command",
        "location": "On or near Kisii Town Bus Stage, Kisii",
        "context": "Simulated Kenya rural zone (Nyanza)",
        "expected_profile": "rural",
    },
    {
        "name": "Kilifi coast",
        "latitude": -3.6305,
        "longitude": 39.8499,
        "month": "2025-12",
        "falls_within": "Coast Regional Command",
        "location": "Near Kilifi Town Close, Kilifi",
        "context": "Simulated Kenya coastal zone (Coast)",
        "expected_profile": "coastal",
    },
    {
        "name": "Nakuru (Rift Valley, urban)",
        "latitude": -0.3031,
        "longitude": 36.0800,
        "month": "2025-07",
        "falls_within": "Rift Valley Regional Command",
        "location": "At Nakuru Town Junction, Nakuru",
        "context": "Simulated Kenya urban zone (Rift Valley)",
        "expected_profile": "urban",
    },
    {
        "name": "Samburu (Rift Valley, pastoral)",
        "latitude": 0.6716,
        "longitude": 37.3100,
        "month": "2025-02",
        "falls_within": "Rift Valley Regional Command",
        "location": "Around Maralal Highway Junction Road, Samburu",
        "context": "Simulated Kenya rift_valley zone (Rift Valley)",
        "expected_profile": "rift_valley",
    },
    {
        "name": "Busia border (Uganda)",
        "latitude": 0.4600,
        "longitude": 34.1115,
        "month": "2025-10",
        "falls_within": "Kenya Border Security Command",
        "location": "Near Busia OSBP Avenue, Busia",
        "context": "Simulated border incident corridor (Uganda)",
        "expected_profile": "border",
    },
]


def _divider(title: str) -> str:
    return f"\n{'='*60}\n {title}\n{'='*60}"


# ═══════════════════════════════════════════════════════════════════════
# TEST 1: Direct model inference (no server needed)
# ═══════════════════════════════════════════════════════════════════════

def test_direct_model():
    print(_divider("TEST 1: Direct Model Inference"))

    from backend.app.ml.fastai_predict import predict_crime

    results = []
    for i, tc in enumerate(TEST_CASES, 1):
        print(f"\n--- Case {i}: {tc['name']} ---")
        try:
            result = predict_crime(
                latitude=tc["latitude"],
                longitude=tc["longitude"],
                month=tc["month"],
                falls_within=tc["falls_within"],
                location=tc["location"],
                context=tc["context"],
            )
            print(f"  Predicted: {result['predicted_crime_type']}")
            print(f"  Confidence: {result['confidence']:.4f}")

            # Show top 3 probabilities
            sorted_probs = sorted(result["probabilities"].items(), key=lambda x: -x[1])[:3]
            for name, prob in sorted_probs:
                print(f"    {name}: {prob:.4f}")

            results.append({
                "case": tc["name"],
                "predicted": result["predicted_crime_type"],
                "confidence": result["confidence"],
                "profile": tc["expected_profile"],
                "status": "OK",
            })
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({
                "case": tc["name"],
                "predicted": "ERROR",
                "confidence": 0,
                "profile": tc["expected_profile"],
                "status": str(e),
            })

    return results


# ═══════════════════════════════════════════════════════════════════════
# TEST 2: FastAPI TestClient (endpoint test, no auth)
# ═══════════════════════════════════════════════════════════════════════

def test_endpoint_no_auth():
    """
    Test the endpoint route logic by overriding the auth dependency.
    This does NOT require Supabase creds or a running server.
    """
    print(_divider("TEST 2: FastAPI Endpoint (auth overridden)"))

    try:
        # Set dummy env vars so the app can load without real Supabase creds
        import os
        os.environ.setdefault("SUPABASE_URL", "https://dummy.supabase.co")
        os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-key")
        os.environ.setdefault("SUPABASE_ANON_KEY", "dummy-anon-key")

        from fastapi.testclient import TestClient
        from backend.app.main import app
        from backend.app.deps import require_permission, get_current_role

        # Override get_current_role so all permission checks pass
        app.dependency_overrides[get_current_role] = lambda: "admin"

        client = TestClient(app)
        results = []

        for i, tc in enumerate(TEST_CASES, 1):
            print(f"\n--- Case {i}: {tc['name']} ---")
            payload = {
                "latitude": tc["latitude"],
                "longitude": tc["longitude"],
                "month": tc["month"],
                "falls_within": tc["falls_within"],
                "location": tc["location"],
                "context": tc["context"],
            }

            try:
                resp = client.post("/inference/predict-crime", json=payload)
                print(f"  HTTP {resp.status_code}")

                if resp.status_code == 200:
                    data = resp.json()
                    print(f"  Predicted: {data['predicted_crime_type']}")
                    print(f"  Confidence: {data['confidence']:.4f}")
                    results.append({
                        "case": tc["name"],
                        "http_status": resp.status_code,
                        "predicted": data["predicted_crime_type"],
                        "confidence": data["confidence"],
                        "status": "OK",
                    })
                else:
                    print(f"  Response: {resp.text[:200]}")
                    results.append({
                        "case": tc["name"],
                        "http_status": resp.status_code,
                        "predicted": "N/A",
                        "confidence": 0,
                        "status": resp.text[:100],
                    })
            except Exception as e:
                print(f"  ERROR: {e}")
                results.append({
                    "case": tc["name"],
                    "http_status": 0,
                    "predicted": "ERROR",
                    "confidence": 0,
                    "status": str(e)[:100],
                })

        # Cleanup override
        app.dependency_overrides.clear()
        return results

    except Exception as e:
        print(f"  Could not run endpoint tests: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# TEST 3: Batch prediction from CSV sample
# ═══════════════════════════════════════════════════════════════════════

def test_batch_csv():
    """Load a sample from the enhanced CSV and predict, then show accuracy."""
    print(_divider("TEST 3: Batch CSV Prediction (accuracy check)"))

    import pandas as pd
    csv_path = ROOT / "data" / "crime" / "kenya-enhanced-crime-data.csv"
    if not csv_path.exists():
        print(f"  CSV not found: {csv_path}")
        return {}

    df = pd.read_csv(csv_path).sample(200, random_state=42)
    print(f"  Sampled {len(df)} rows from {csv_path.name}")

    from backend.app.ml.fastai_predict import predict_crime

    correct = 0
    total = 0
    by_class: dict[str, dict[str, int]] = {}

    for _, row in df.iterrows():
        actual = row["Crime type"]
        try:
            result = predict_crime(
                latitude=float(row["Latitude"]),
                longitude=float(row["Longitude"]),
                month=str(row["Month"]),
                falls_within=str(row["Falls within"]),
                location=str(row["Location"]),
                context=str(row.get("Context", "")),
                last_outcome_category=str(row["Last outcome category"]) if pd.notna(row.get("Last outcome category")) else None,
            )
            predicted = result["predicted_crime_type"]

            if actual not in by_class:
                by_class[actual] = {"correct": 0, "total": 0}
            by_class[actual]["total"] += 1
            if predicted == actual:
                by_class[actual]["correct"] += 1
                correct += 1
            total += 1

        except Exception as e:
            total += 1  # count as wrong

    accuracy = correct / max(total, 1)
    print(f"\n  Overall accuracy: {correct}/{total} = {accuracy:.2%}")
    print(f"\n  {'Crime Type':<35} {'Correct':>7} {'Total':>7} {'Acc':>8}")
    print(f"  {'-'*60}")
    for cls in sorted(by_class.keys()):
        d = by_class[cls]
        acc = d["correct"] / max(d["total"], 1)
        print(f"  {cls:<35} {d['correct']:>7} {d['total']:>7} {acc:>7.1%}")

    return {"accuracy": accuracy, "correct": correct, "total": total, "by_class": by_class}


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    print(textwrap.dedent("""
    ╔══════════════════════════════════════════════════════════╗
    ║  FARSI fastai Crime Model — Endpoint & Model Test Suite ║
    ╚══════════════════════════════════════════════════════════╝
    """))

    # Test 1: Direct model
    direct_results = test_direct_model()

    # Test 3: Batch CSV
    batch_results = test_batch_csv()

    # Test 2: FastAPI endpoint (may fail without Supabase — that's OK)
    endpoint_results = test_endpoint_no_auth()

    # ── Summary ──
    print(_divider("SUMMARY"))
    print(f"\n  Direct model tests: {sum(1 for r in direct_results if r['status'] == 'OK')}/{len(direct_results)} passed")
    if batch_results:
        print(f"  Batch CSV accuracy: {batch_results.get('accuracy', 0):.2%} ({batch_results.get('correct', 0)}/{batch_results.get('total', 0)})")
    print(f"  Endpoint tests: {sum(1 for r in endpoint_results if r.get('status') == 'OK')}/{len(endpoint_results)} passed")

    print("\nDone.")


if __name__ == "__main__":
    main()
