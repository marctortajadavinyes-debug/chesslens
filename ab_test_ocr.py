#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import time
import glob
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple

# IMPORTANTE:
# Este archivo debe estar en la misma carpeta que process_image_gemini.py
import process_image_gemini as parser
from google import genai


# =========================================================
# CONFIG
# =========================================================

OUTPUT_DIR = Path("ab_test_outputs")


# =========================================================
# V2 — NUEVA IMPLEMENTACIÓN CON STRUCTURED OUTPUTS
# =========================================================


def call_gemini_rows_new(image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
    """
    OCR estricto para comparar con la versión actual.
    Filosofía ChessLens:
    - OCR puro
    - sin normalización
    - sin validación ajedrecística
    - sin adivinar
    """
    if not parser.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) env var not set")

    client = genai.Client(api_key=parser.GEMINI_API_KEY)

    system_instruction = (
        "Strict OCR task for a Catalan chess scoresheet.\n"
        "The scoresheet is handwritten and the move notation is in CATALAN.\n"
        "CRITICAL CONSTRAINTS:\n"
        "- This is STRICT OCR, not interpretation.\n"
        "- Do NOT normalize moves.\n"
        "- Do NOT validate chess legality.\n"
        "- Do NOT guess missing data. If a cell is empty or unreadable, return an empty string.\n"
        "- Preserve EXACT cell content.\n\n"
        "HEADERS:\n"
        "- Read ONLY the handwritten top fields.\n"
        "- IMPORTANT: Site must be the handwritten playing site/club if present.\n"
        "- DO NOT use printed federation address as Site.\n\n"
        "ROWS:\n"
        "- The moves table is split into THREE vertical blocks:\n"
        "  Block 1 = moves 1..25 (left)\n"
        "  Block 2 = moves 26..50 (middle)\n"
        "  Block 3 = moves 51..75 (right)\n"
        "- Read blocks STRICTLY in this order: LEFT, then MIDDLE, then RIGHT.\n"
        "- Inside each block, read rows from TOP to BOTTOM."
    )

    response_schema = {
        "type": "OBJECT",
        "properties": {
            "headers": {
                "type": "OBJECT",
                "properties": {
                    "Event": {"type": "STRING"},
                    "Site": {"type": "STRING"},
                    "Date": {"type": "STRING"},
                    "Round": {"type": "STRING"},
                    "White": {"type": "STRING"},
                    "Black": {"type": "STRING"},
                    "Result": {"type": "STRING"},
                },
                "required": [
                    "Event",
                    "Site",
                    "Date",
                    "Round",
                    "White",
                    "Black",
                    "Result",
                ],
            },
            "rows": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "n": {"type": "INTEGER"},
                        "w": {"type": "STRING"},
                        "b": {"type": "STRING"},
                    },
                    "required": ["n", "w", "b"],
                },
            },
        },
        "required": ["headers", "rows"],
    }

    prompt = "Transcribe this chess scoresheet exactly as instructed, extracting headers and the grid of moves."

    contents = [
        {
            "role": "user",
            "parts": [
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": image_bytes,
                    }
                },
                {"text": prompt},
            ],
        }
    ]

    resp = client.models.generate_content(
        model=parser.GEMINI_MODEL,
        contents=contents,
        config={
            "temperature": 0,
            "max_output_tokens": 4000,
            "thinking_config": {"thinking_budget": 0},
            "system_instruction": system_instruction,
            "response_mime_type": "application/json",
            "response_schema": response_schema,
        },
    )

    text = getattr(resp, "text", None) or "{}"

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Gemini returned invalid JSON despite structured outputs: {str(e)}\n"
            f"Raw response:\n{text}"
        )

    return parser.normalize_ocr_payload(raw)


# =========================================================
# HELPERS
# =========================================================


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def safe_float_str(value: Any) -> str:
    if isinstance(value, (int, float)):
        return f"{value:.2f}"
    return str(value)


def sanitize_name(name: str) -> str:
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name)
    return safe.strip("_") or "unnamed"


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def extract_summary(output: Dict[str, Any], elapsed: float) -> Dict[str, Any]:
    """
    Resume los datos importantes de una corrida sin asumir demasiado
    sobre la estructura exacta del pipeline.
    """
    meta = output.get("meta", {}) if isinstance(output, dict) else {}
    ocr = output.get("ocr", {}) if isinstance(output, dict) else {}

    headers = {}
    if isinstance(meta.get("headers_normalized"), dict):
        headers = meta.get("headers_normalized", {})
    elif isinstance(ocr.get("headers"), dict):
        headers = ocr.get("headers", {})

    rows_count = 0
    if isinstance(meta.get("rows_count"), int):
        rows_count = meta.get("rows_count", 0)
    elif isinstance(ocr.get("rows"), list):
        rows_count = len(ocr.get("rows", []))

    pushed_moves = None
    for key in ("valid_moves_count", "pushed_moves", "legal_plies"):
        if key in meta:
            pushed_moves = meta.get(key)
            break

    if pushed_moves is None:
        moves = output.get("moves", [])
        if isinstance(moves, list):
            pushed_moves = len(moves)

    return {
        "runner_status": "Success",
        "status": output.get("status", "unknown"),
        "stopped_for_review": output.get("stopped_for_review", False),
        "elapsed": elapsed,
        "headers": headers,
        "rows_count": rows_count,
        "pushed_moves": pushed_moves,
        "blocked_row": output.get("blocked_row"),
        "blocked_side": output.get("blocked_side"),
        "raw_token": output.get("raw_token"),
        "ocr": ocr,
        "meta": meta,
        "full_output": output,
    }


def run_pipeline_with_function(image_path: str, func_impl) -> Dict[str, Any]:
    """
    Ejecuta process_initial sustituyendo temporalmente parser.call_gemini_rows.
    Siempre restaura la función original.
    """
    original_call = parser.call_gemini_rows
    t0 = time.time()

    try:
        parser.call_gemini_rows = func_impl
        output = parser.process_initial(image_path)
        elapsed = time.time() - t0
        return extract_summary(output, elapsed)
    except Exception as e:
        elapsed = time.time() - t0
        return {
            "runner_status": f"Failed: {str(e)}",
            "status": "failed",
            "stopped_for_review": False,
            "elapsed": elapsed,
            "headers": {},
            "rows_count": None,
            "pushed_moves": None,
            "blocked_row": None,
            "blocked_side": None,
            "raw_token": None,
            "ocr": {},
            "meta": {},
            "full_output": {},
        }
    finally:
        parser.call_gemini_rows = original_call


def value_for_table(data: Dict[str, Any], key: str, default: str = "N/A") -> str:
    if data.get("runner_status") != "Success":
        if key == "runner_status":
            return data.get("runner_status", "Failed")
        if key == "elapsed":
            return safe_float_str(data.get("elapsed", "N/A"))
        return "-"
    value = data.get(key, default)
    if key == "elapsed":
        return safe_float_str(value)
    return str(value)


def print_comparison_table(v1: Dict[str, Any], v2: Dict[str, Any]) -> None:
    print("\n📊 Results Comparison:")
    print(f"{'Metric':<24} | {'V1 Current':<24} | {'V2 Structured':<24}")
    print("-" * 78)

    blocked_1 = "-"
    blocked_2 = "-"

    if v1.get("runner_status") == "Success":
        blocked_1 = f"{v1.get('blocked_row')} ({v1.get('blocked_side')})"
    if v2.get("runner_status") == "Success":
        blocked_2 = f"{v2.get('blocked_row')} ({v2.get('blocked_side')})"

    print(
        f"{'Runner status':<24} | {value_for_table(v1, 'runner_status'):<24} | {value_for_table(v2, 'runner_status'):<24}"
    )
    print(
        f"{'Pipeline status':<24} | {value_for_table(v1, 'status'):<24} | {value_for_table(v2, 'status'):<24}"
    )
    print(
        f"{'Stopped for review':<24} | {value_for_table(v1, 'stopped_for_review'):<24} | {value_for_table(v2, 'stopped_for_review'):<24}"
    )
    print(
        f"{'Time (s)':<24} | {value_for_table(v1, 'elapsed'):<24} | {value_for_table(v2, 'elapsed'):<24}"
    )
    print(
        f"{'Rows extracted':<24} | {value_for_table(v1, 'rows_count'):<24} | {value_for_table(v2, 'rows_count'):<24}"
    )
    print(
        f"{'Legal plies / moves':<24} | {value_for_table(v1, 'pushed_moves'):<24} | {value_for_table(v2, 'pushed_moves'):<24}"
    )
    print(f"{'First blocked at':<24} | {blocked_1:<24} | {blocked_2:<24}")
    print(
        f"{'Raw token at block':<24} | {value_for_table(v1, 'raw_token'):<24} | {value_for_table(v2, 'raw_token'):<24}"
    )

    print("\n📝 Headers Extracted (V1):")
    print(json.dumps(v1.get("headers", {}), ensure_ascii=False, indent=2))

    print("\n📝 Headers Extracted (V2):")
    print(json.dumps(v2.get("headers", {}), ensure_ascii=False, indent=2))


def save_run_outputs(base_name: str, version_slug: str, result: Dict[str, Any]) -> None:
    version_dir = OUTPUT_DIR / sanitize_name(base_name)
    version_dir.mkdir(parents=True, exist_ok=True)

    summary_path = version_dir / f"{version_slug}_summary.json"
    ocr_path = version_dir / f"{version_slug}_ocr.json"
    output_path = version_dir / f"{version_slug}_full_output.json"

    summary = {
        "runner_status": result.get("runner_status"),
        "status": result.get("status"),
        "stopped_for_review": result.get("stopped_for_review"),
        "elapsed": result.get("elapsed"),
        "headers": result.get("headers"),
        "rows_count": result.get("rows_count"),
        "pushed_moves": result.get("pushed_moves"),
        "blocked_row": result.get("blocked_row"),
        "blocked_side": result.get("blocked_side"),
        "raw_token": result.get("raw_token"),
    }

    save_json(summary_path, summary)
    save_json(ocr_path, result.get("ocr", {}))
    save_json(output_path, result.get("full_output", {}))


def run_evaluation(image_path: str) -> None:
    print(f"\n{'=' * 70}")
    print(f"📄 Testing image: {os.path.basename(image_path)}")
    print(f"{'=' * 70}")

    base_name = Path(image_path).stem

    versions: List[Tuple[str, str, Any]] = [
        ("V1 (Current Text/Repair)", "v1_current", parser.call_gemini_rows),
        ("V2 (Structured Outputs)", "v2_structured", call_gemini_rows_new),
    ]

    results: Dict[str, Dict[str, Any]] = {}

    for version_name, version_slug, func in versions:
        print(f"\n🚀 Running {version_name}...")
        result = run_pipeline_with_function(image_path, func)
        results[version_name] = result
        save_run_outputs(base_name, version_slug, result)

        if result.get("runner_status") == "Success":
            print(
                f"   OK | status={result.get('status')} | "
                f"review={result.get('stopped_for_review')} | "
                f"rows={result.get('rows_count')} | "
                f"moves={result.get('pushed_moves')} | "
                f"time={safe_float_str(result.get('elapsed'))}s"
            )
        else:
            print(f"   FAIL | {result.get('runner_status')}")

    v1 = results.get("V1 (Current Text/Repair)", {})
    v2 = results.get("V2 (Structured Outputs)", {})

    print_comparison_table(v1, v2)
    print(f"\n💾 Results saved in: {OUTPUT_DIR / sanitize_name(base_name)}")


def collect_images(target: str) -> List[str]:
    p = Path(target)

    if p.is_file():
        return [str(p)]

    if p.is_dir():
        patterns = ["*.jpg", "*.jpeg", "*.png", "*.webp"]
        images: List[str] = []
        for pattern in patterns:
            images.extend(str(x) for x in p.glob(pattern))
        return sorted(images)

    return []


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python ab_test_ocr.py <path_to_image>")
        print("  python ab_test_ocr.py <path_to_directory>")
        sys.exit(1)

    ensure_output_dir()

    target = sys.argv[1]
    images = collect_images(target)

    if not images:
        print("No valid image(s) found.")
        sys.exit(1)

    print(f"Found {len(images)} image(s).")
    for image_path in images:
        run_evaluation(image_path)


if __name__ == "__main__":
    main()
