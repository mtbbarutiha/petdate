#!/usr/bin/env python3
"""Generate Digikala batch1 Part4 catalog (p330–p341) from the wave MANIFEST."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-digikala-batch1-part4.json").read_text(encoding="utf-8"))
DESCRIPTIONS = json.loads((ROOT / "scripts/shop-digikala-batch1-part4-descriptions.json").read_text(encoding="utf-8"))
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

if __name__ == "__main__":
    print(f"manifest {len(PRODUCTS)} SKUs cache={CACHE_BUST} gallery=front-only — sources already written")
