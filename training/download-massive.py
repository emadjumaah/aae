#!/usr/bin/env python3
"""
Download MASSIVE Arabic (ar-SA) + English (en-US) datasets from HuggingFace.

MASSIVE: 1M-Example Multilingual NLU Dataset (Amazon, CC-BY-4.0)
- 11,514 train / 2,033 dev / 2,974 test per language
- 60 intents, 18 scenarios (domains), 55 slot types
- Real human utterances, not template-generated

Usage:
  pip install pandas pyarrow
  python3 training/download-massive.py

Output: training/massive-ar.jsonl, training/massive-en.jsonl
"""

import json
from pathlib import Path
from io import BytesIO

import requests
import pandas as pd

OUT_DIR = Path(__file__).parent

PARQUET_API = "https://huggingface.co/api/datasets/AmazonScience/massive/parquet"

def download_locale(locale: str, output_name: str):
    """Download one locale from MASSIVE via parquet API and save as JSONL."""
    print(f"Downloading MASSIVE {locale}...")

    # Get parquet URLs for this locale
    resp = requests.get(PARQUET_API)
    resp.raise_for_status()
    urls_by_split = resp.json()[locale]

    out_path = OUT_DIR / output_name
    count = 0

    with open(out_path, "w", encoding="utf-8") as f:
        for split_name in ["train", "validation", "test"]:
            partition = {"validation": "dev"}.get(split_name, split_name)
            urls = urls_by_split.get(split_name, [])
            for url in urls:
                print(f"  Fetching {split_name}...")
                r = requests.get(url)
                r.raise_for_status()
                df = pd.read_parquet(BytesIO(r.content))
                for _, row in df.iterrows():
                    record = {
                        "id": str(row.get("id", count)),
                        "locale": row["locale"],
                        "partition": partition,
                        "scenario": row["scenario"],
                        "intent": row["intent"],
                        "utt": row["utt"],
                        "annot_utt": row["annot_utt"],
                    }
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    count += 1

    print(f"  → {out_path} ({count:,} examples)")

if __name__ == "__main__":
    download_locale("ar-SA", "massive-ar.jsonl")
    download_locale("en-US", "massive-en.jsonl")
    print("\nDone. Now run: python3 training/convert-massive.py")
