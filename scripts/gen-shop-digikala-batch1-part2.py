#!/usr/bin/env python3
"""Generate Digikala batch1 Part2 catalog (p310–p319) from the wave MANIFEST."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "scripts/shop-digikala-batch1-part2.json").read_text(encoding="utf-8"))
DESCRIPTIONS = json.loads((ROOT / "scripts/shop-digikala-batch1-part2-descriptions.json").read_text(encoding="utf-8"))
PRODUCTS = MANIFEST["products"]
CACHE_BUST = MANIFEST["cacheBust"]

if __name__ == "__main__":
    print(f"manifest {len(PRODUCTS)} SKUs cache={CACHE_BUST} — sources already written")
