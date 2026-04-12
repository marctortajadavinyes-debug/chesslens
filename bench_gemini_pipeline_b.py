#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import json
import time
import base64
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
import chess


TIMEOUT_SECONDS = 90
OUTPUT_DIR = Path("bench_b_outputs")


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def guess_mime_type(image_path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(image_path))
    return mime or "image/jpeg"


def read_image_b64(image_path: Path) -> Tuple[str, str]:
    mime_type = guess_mime_type(image_path)
    data = base64.b64encode(image_path.read_bytes()).decode("utf-8")
    return mime_type, data


def save_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def extract_first_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    stripped = text.strip()
    try:
        obj = json.loads(stripped)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    start_positions = [m.start() for m in re.finditer(r"\{", text)]
    for start in start_positions:
        depth = 0
        in_string = False
        escape = False

        for i in range(start, len(text)):
            ch = text[i]

            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        obj = json.loads(candidate)
                        if isinstance(obj, dict):
                            return obj
                    except Exception:
                        break
    return None


def call_gemini(image_path: Path) -> Tuple[str, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta GEMINI_API_KEY")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    mime_type, b64 = read_image_b64(image_path)

    prompt = """Read this handwritten chess scoresheet and return ONLY valid JSON:

{
  "pgn": "..."
}

Rules:
- No markdown
- No explanations
- Keep exactly what you read from the scoresheet
- Use O-O and O-O-O for castling
- Return only the movetext in pgn
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": mime_type, "data": b64}},
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 4000,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
    resp.raise_for_status()
    data = resp.json()

    save_text(
        OUTPUT_DIR / "gemini_response_raw.json",
        json.dumps(data, ensure_ascii=False, indent=2),
    )

    text_parts = []
    for cand in data.get("candidates", []):
        content = cand.get("content", {})
        for part in content.get("parts", []):
            if "text" in part and part["text"]:
                text_parts.append(part["text"])

    text = "\n".join(text_parts).strip()
    if not text:
        text = json.dumps(data, ensure_ascii=False)

    return model, text


def call_openai_reconstruct(gemini_pgn: str) -> Tuple[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta OPENAI_API_KEY")

    model = os.getenv("OPENAI_MODEL", "gpt-4o")

    prompt = f"""You are repairing a handwritten chess scoresheet transcription.

The following movetext was read from the scoresheet by a vision model.
It may contain Catalan piece letters and OCR mistakes.

Source transcription:
{gemini_pgn}

Your task:
- Reconstruct the game as faithfully as possible to the source transcription.
- Translate Catalan piece letters to English SAN:
  C->N, A->B, T->R, D->Q, R->K
- Preserve the intended moves from the source as much as possible.
- Do NOT invent a different plausible game.
- If the source strongly suggests a move, prefer that move.
- If uncertain, choose the most conservative correction.

Return ONLY valid JSON with this format:
{{
  "pgn": "...",
  "confidence": 0.0
}}
"""

    url = "https://api.openai.com/v1/responses"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                ],
            }
        ],
        "max_output_tokens": 2000,
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
    resp.raise_for_status()
    data = resp.json()

    save_text(
        OUTPUT_DIR / "openai_response_raw.json",
        json.dumps(data, ensure_ascii=False, indent=2),
    )

    text = data.get("output_text", "")
    if not text:
        chunks = []
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in ("output_text", "text"):
                    chunks.append(content.get("text", ""))
        text = "\n".join(chunks).strip()

    return model, text


def strip_move_numbers_and_results(pgn_text: str) -> List[str]:
    text = (pgn_text or "").strip()
    if not text:
        return []

    text = text.replace("\n", " ")
    parts = text.split()

    out = []
    for token in parts:
        token = token.strip()
        if not token:
            continue
        if re.fullmatch(r"\d+\.", token):
            continue
        if re.fullmatch(r"\d+\.\.\.", token):
            continue
        if token in {"1-0", "0-1", "1/2-1/2", "*"}:
            continue
        out.append(token)

    return out


def validate_tokens(tokens: List[str]) -> Dict[str, Any]:
    board = chess.Board()
    ok_moves: List[str] = []
    failed: Optional[Dict[str, Any]] = None

    for idx, san in enumerate(tokens, start=1):
        try:
            move = board.parse_san(san)
            board.push(move)
            ok_moves.append(san)
        except Exception as e:
            failed = {
                "ply": idx,
                "raw": san,
                "reason": str(e),
                "fen": board.fen(),
            }
            break

    return {
        "ok_moves": ok_moves,
        "failed": failed,
        "legal_plies": len(ok_moves),
        "total_plies": len(tokens),
    }


def build_movetext(moves: List[str]) -> str:
    out = []
    move_no = 1
    i = 0
    while i < len(moves):
        w = moves[i]
        b = moves[i + 1] if i + 1 < len(moves) else None
        if b:
            out.append(f"{move_no}. {w} {b}")
        else:
            out.append(f"{move_no}. {w}")
        move_no += 1
        i += 2
    return " ".join(out)


def main() -> int:
    import sys

    if len(sys.argv) < 2:
        print("Uso: python bench_gemini_pipeline_b.py planella_II.jpg")
        return 1

    image_path = Path(sys.argv[1]).expanduser().resolve()
    if not image_path.exists():
        print(f"No existe la imagen: {image_path}")
        return 1

    ensure_output_dir()

    # 1) Gemini read
    t0 = time.perf_counter()
    gemini_model, gemini_raw_text = call_gemini(image_path)
    gemini_elapsed = time.perf_counter() - t0
    save_text(OUTPUT_DIR / "gemini_raw.txt", gemini_raw_text)

    gemini_obj = extract_first_json_object(gemini_raw_text)
    if not gemini_obj or not gemini_obj.get("pgn"):
        result = {
            "stage": "gemini_read",
            "provider": "gemini->openai",
            "gemini_model": gemini_model,
            "gemini_elapsed_sec": gemini_elapsed,
            "json_ok": False,
            "error": "Gemini no devolvió pgn usable",
        }
        save_text(
            OUTPUT_DIR / "summary.json",
            json.dumps(result, ensure_ascii=False, indent=2),
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    gemini_pgn = gemini_obj.get("pgn", "")

    # 2) OpenAI reconstruct
    t1 = time.perf_counter()
    openai_model, openai_raw_text = call_openai_reconstruct(gemini_pgn)
    openai_elapsed = time.perf_counter() - t1
    save_text(OUTPUT_DIR / "openai_raw.txt", openai_raw_text)

    openai_obj = extract_first_json_object(openai_raw_text)
    if not openai_obj or not openai_obj.get("pgn"):
        result = {
            "stage": "openai_reconstruct",
            "provider": "gemini->openai",
            "gemini_model": gemini_model,
            "openai_model": openai_model,
            "gemini_elapsed_sec": gemini_elapsed,
            "openai_elapsed_sec": openai_elapsed,
            "total_elapsed_sec": gemini_elapsed + openai_elapsed,
            "json_ok": False,
            "error": "OpenAI no devolvió pgn usable",
        }
        save_text(
            OUTPUT_DIR / "summary.json",
            json.dumps(result, ensure_ascii=False, indent=2),
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    repaired_pgn = openai_obj.get("pgn", "")
    tokens = strip_move_numbers_and_results(repaired_pgn)
    validation = validate_tokens(tokens)
    valid_movetext = build_movetext(validation["ok_moves"])

    result = {
        "provider": "gemini->openai",
        "gemini_model": gemini_model,
        "openai_model": openai_model,
        "gemini_elapsed_sec": gemini_elapsed,
        "openai_elapsed_sec": openai_elapsed,
        "total_elapsed_sec": gemini_elapsed + openai_elapsed,
        "json_ok": True,
        "gemini_pgn_present": bool(gemini_pgn.strip()),
        "repaired_pgn_present": bool(repaired_pgn.strip()),
        "legal_plies": validation["legal_plies"],
        "total_plies": validation["total_plies"],
        "failed": validation["failed"],
        "valid_movetext": valid_movetext,
    }

    save_text(
        OUTPUT_DIR / "gemini_parsed.json",
        json.dumps(gemini_obj, ensure_ascii=False, indent=2),
    )
    save_text(
        OUTPUT_DIR / "openai_parsed.json",
        json.dumps(openai_obj, ensure_ascii=False, indent=2),
    )
    save_text(
        OUTPUT_DIR / "summary.json", json.dumps(result, ensure_ascii=False, indent=2)
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
