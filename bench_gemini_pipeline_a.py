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
import chess.pgn


TIMEOUT_SECONDS = 90
OUTPUT_DIR = Path("bench_a_outputs")


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


CATALAN_MAP = {
    "C": "N",
    "A": "B",
    "T": "R",
    "D": "Q",
    "R": "K",
}

FILES = set("abcdefgh")


def normalize_token(token: str) -> str:
    t = (token or "").strip()
    if not t:
        return ""

    t = t.replace("0-0-0", "O-O-O").replace("0-0", "O-O")
    t = t.replace("—", "-").replace("–", "-")
    t = t.replace("×", "x").replace("X", "x")
    t = re.sub(r"[!?]+$", "", t)

    # Catalán -> inglés
    if t and t[0] in CATALAN_MAP:
        t = CATALAN_MAP[t[0]] + t[1:]

    # fichero inicial minúscula si parece peón
    if len(t) >= 2 and t[0] in "ABCDEFGH":
        t = t[0].lower() + t[1:]

    # pieza + casilla
    m = re.fullmatch(r"([KQRBN])([A-Ha-h])([1-8])([+#]?)", t)
    if m:
        t = m.group(1) + m.group(2).lower() + m.group(3) + m.group(4)

    # pieza x casilla
    m = re.fullmatch(r"([KQRBN])x([A-Ha-h])([1-8])([+#]?)", t)
    if m:
        t = m.group(1) + "x" + m.group(2).lower() + m.group(3) + m.group(4)

    # peón captura
    m = re.fullmatch(r"([A-Ha-h])x([A-Ha-h])([1-8])([+#]?)", t)
    if m:
        t = m.group(1).lower() + "x" + m.group(2).lower() + m.group(3) + m.group(4)

    # peón avanza
    m = re.fullmatch(r"([A-Ha-h])([1-8])([+#]?)", t)
    if m:
        t = m.group(1).lower() + m.group(2) + m.group(3)

    # error OCR típico 96 -> g6
    if re.fullmatch(r"9[1-8]", t):
        t = "g" + t[1]

    return t


def validate_tokens(tokens: List[str]) -> Dict[str, Any]:
    board = chess.Board()
    ok_moves: List[str] = []
    normalized_tokens: List[str] = []
    failed: Optional[Dict[str, Any]] = None

    for idx, raw in enumerate(tokens, start=1):
        norm = normalize_token(raw)
        normalized_tokens.append(norm)

        if not norm:
            failed = {
                "ply": idx,
                "raw": raw,
                "normalized": norm,
                "reason": "empty_after_normalization",
                "fen": board.fen(),
            }
            break

        try:
            move = board.parse_san(norm)
            board.push(move)
            ok_moves.append(norm)
        except Exception as e:
            failed = {
                "ply": idx,
                "raw": raw,
                "normalized": norm,
                "reason": str(e),
                "fen": board.fen(),
            }
            break

    return {
        "ok_moves": ok_moves,
        "normalized_tokens": normalized_tokens,
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
        print("Uso: python bench_gemini_pipeline_a.py planella_II.jpg")
        return 1

    image_path = Path(sys.argv[1]).expanduser().resolve()
    if not image_path.exists():
        print(f"No existe la imagen: {image_path}")
        return 1

    ensure_output_dir()

    t0 = time.perf_counter()
    model, raw_text = call_gemini(image_path)
    elapsed = time.perf_counter() - t0

    save_text(OUTPUT_DIR / "gemini_raw.txt", raw_text)

    obj = extract_first_json_object(raw_text)
    if not obj:
        result = {
            "provider": "gemini",
            "model": model,
            "elapsed_sec": elapsed,
            "json_ok": False,
            "error": "No se pudo extraer JSON",
        }
        save_text(
            OUTPUT_DIR / "summary.json",
            json.dumps(result, ensure_ascii=False, indent=2),
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    pgn_text = obj.get("pgn", "")
    tokens = strip_move_numbers_and_results(pgn_text)
    validation = validate_tokens(tokens)
    normalized_movetext = build_movetext(validation["ok_moves"])

    result = {
        "provider": "gemini",
        "model": model,
        "elapsed_sec": elapsed,
        "json_ok": True,
        "raw_pgn_present": bool(pgn_text.strip()),
        "legal_plies": validation["legal_plies"],
        "total_plies": validation["total_plies"],
        "failed": validation["failed"],
        "normalized_movetext": normalized_movetext,
    }

    save_text(
        OUTPUT_DIR / "gemini_parsed.json", json.dumps(obj, ensure_ascii=False, indent=2)
    )
    save_text(
        OUTPUT_DIR / "summary.json", json.dumps(result, ensure_ascii=False, indent=2)
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
