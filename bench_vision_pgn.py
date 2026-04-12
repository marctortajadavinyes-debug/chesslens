#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
bench_vision_pgn.py

Benchmark rápido para comparar OpenAI / Gemini / Claude
leyendo una planilla de ajedrez desde una imagen.

Uso:
    python bench_vision_pgn.py /ruta/a/planilla.jpg

Variables de entorno:
    OPENAI_API_KEY=...
    GEMINI_API_KEY=...
    ANTHROPIC_API_KEY=...

Opcionales:
    OPENAI_MODEL=...
    GEMINI_MODEL=...
    ANTHROPIC_MODEL=...
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# pip install python-chess
import chess
import chess.pgn


PROMPT = """Esta imagen es una planilla manuscrita de ajedrez.

Tu tarea:
1. Leer la planilla completa.
2. Reconstruir la partida en orden.
3. Corregir errores visuales obvios usando contexto ajedrecístico.
4. Devolver SOLO JSON válido con este formato:

{
  "pgn": "...",
  "moves": ["e4", "e5", "..."],
  "doubts": [
    {
      "ply": 17,
      "raw": "Ag7",
      "guess": "Bg7",
      "confidence": 0.63
    }
  ],
  "confidence": 0.0
}

Reglas:
- No expliques nada fuera del JSON.
- Si una jugada no es segura, añádela a doubts.
- Intenta devolver el mejor PGN posible.
"""

OUTPUT_DIR = Path("bench_outputs")
TIMEOUT_SECONDS = 90


@dataclass
class EvalResult:
    provider: str
    model: str
    ok_http: bool
    elapsed_sec: float
    raw_text_len: int
    json_ok: bool
    pgn_present: bool
    moves_present: bool
    legal_moves: int
    total_moves_checked: int
    parse_source: str
    error: Optional[str] = None


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def guess_mime_type(image_path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(image_path))
    return mime or "image/jpeg"


def read_image_b64(image_path: Path) -> Tuple[str, str]:
    mime_type = guess_mime_type(image_path)
    data = base64.b64encode(image_path.read_bytes()).decode("utf-8")
    return mime_type, data


def data_url_from_file(image_path: Path) -> str:
    mime_type, b64 = read_image_b64(image_path)
    return f"data:{mime_type};base64,{b64}"


def save_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def extract_first_json_object(text: str) -> Optional[Dict[str, Any]]:
    """
    Intenta sacar el primer objeto JSON bien balanceado del texto.
    Útil cuando el modelo mete basura antes/después.
    """
    if not text:
        return None
        # Si viene un JSON serializado completo con claves útiles, probar directo
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                if "pgn" in obj or "moves" in obj or "candidates" in obj:
                    return obj
        except Exception:
            pass

    # Caso ideal: todo el texto ya es JSON
    stripped = text.strip()
    try:
        obj = json.loads(stripped)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # Buscar primer bloque { ... } balanceado
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


def parse_game_from_pgn(pgn_text: str) -> Tuple[int, int]:
    """
    Devuelve (legal_moves, total_moves_checked)
    """
    import io

    pgn_text = (pgn_text or "").strip()
    if not pgn_text:
        return 0, 0

    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
        if game is None:
            return 0, 0

        board = game.board()
        legal = 0
        total = 0
        for move in game.mainline_moves():
            total += 1
            if move in board.legal_moves:
                legal += 1
                board.push(move)
            else:
                break
        return legal, total
    except Exception:
        return 0, 0


def parse_game_from_san_moves(moves: List[str]) -> Tuple[int, int]:
    board = chess.Board()
    legal = 0
    total = 0

    for san in moves:
        if not isinstance(san, str):
            continue
        san = san.strip()
        if not san:
            continue

        total += 1
        try:
            move = board.parse_san(san)
            if move in board.legal_moves:
                legal += 1
                board.push(move)
            else:
                break
        except Exception:
            break

    return legal, total


def evaluate_json_payload(obj: Dict[str, Any]) -> Tuple[int, int, str]:
    """
    Prioriza validar por PGN; si falla, prueba con moves.
    """
    pgn_text = obj.get("pgn")
    moves = obj.get("moves")

    if isinstance(pgn_text, str) and pgn_text.strip():
        legal, total = parse_game_from_pgn(pgn_text)
        if total > 0:
            return legal, total, "pgn"

    if isinstance(moves, list):
        legal, total = parse_game_from_san_moves(moves)
        return legal, total, "moves"

    return 0, 0, "none"


def call_openai(image_path: Path) -> Tuple[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta OPENAI_API_KEY")

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    data_url = data_url_from_file(image_path)

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
                    {"type": "input_text", "text": PROMPT},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
        "max_output_tokens": 2000,
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
    resp.raise_for_status()
    data = resp.json()

    text = data.get("output_text", "")
    if not text:
        # fallback por si cambia la forma de salida
        chunks = []
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in ("output_text", "text"):
                    chunks.append(content.get("text", ""))
        text = "\n".join(chunks).strip()

    return model, text


def call_gemini(image_path: Path) -> Tuple[str, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta GEMINI_API_KEY")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    mime_type, b64 = read_image_b64(image_path)

    # Prompt simplificado para Gemini
    gemini_prompt = """Read this handwritten chess scoresheet and return ONLY valid JSON:

    {
      "pgn": "..."
    }

    Rules:
    - No markdown
    - No explanations
    - Use standard English SAN notation
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
                    {"text": gemini_prompt},
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

    # Guardamos el bruto de Gemini para inspección
    save_text(
        OUTPUT_DIR / "gemini_response_raw.json",
        json.dumps(data, ensure_ascii=False, indent=2),
    )

    text_parts = []

    # Ruta 1: candidatos normales
    for cand in data.get("candidates", []):
        content = cand.get("content", {})
        for part in content.get("parts", []):
            if "text" in part and part["text"]:
                text_parts.append(part["text"])

    text = "\n".join(text_parts).strip()

    # Ruta 2: fallback defensivo si no apareció texto en candidates
    if not text:
        try:
            text = json.dumps(data, ensure_ascii=False)
        except Exception:
            text = ""

    return model, text


def call_anthropic(image_path: Path) -> Tuple[str, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Falta ANTHROPIC_API_KEY")

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    mime_type, b64 = read_image_b64(image_path)

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 2000,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": PROMPT,
                    },
                ],
            }
        ],
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT_SECONDS)
    resp.raise_for_status()
    data = resp.json()

    text_parts = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))

    text = "\n".join(text_parts).strip()
    return model, text


def bench_one(provider: str, image_path: Path) -> EvalResult:
    ensure_output_dir()
    t0 = time.perf_counter()

    try:
        if provider == "openai":
            model, raw_text = call_openai(image_path)
        elif provider == "gemini":
            model, raw_text = call_gemini(image_path)
        elif provider == "anthropic":
            model, raw_text = call_anthropic(image_path)
        else:
            raise ValueError(f"Proveedor no soportado: {provider}")

        elapsed = time.perf_counter() - t0

        raw_path = OUTPUT_DIR / f"{provider}_raw.txt"
        save_text(raw_path, raw_text)

        obj = extract_first_json_object(raw_text)
        json_ok = obj is not None

        legal, total, parse_source = (0, 0, "none")
        pgn_present = False
        moves_present = False

        if obj:
            json_path = OUTPUT_DIR / f"{provider}_parsed.json"
            save_text(json_path, json.dumps(obj, ensure_ascii=False, indent=2))

            pgn_present = isinstance(obj.get("pgn"), str) and bool(
                obj.get("pgn", "").strip()
            )
            moves_present = (
                isinstance(obj.get("moves"), list) and len(obj.get("moves", [])) > 0
            )
            legal, total, parse_source = evaluate_json_payload(obj)

        return EvalResult(
            provider=provider,
            model=model,
            ok_http=True,
            elapsed_sec=elapsed,
            raw_text_len=len(raw_text),
            json_ok=json_ok,
            pgn_present=pgn_present,
            moves_present=moves_present,
            legal_moves=legal,
            total_moves_checked=total,
            parse_source=parse_source,
            error=None,
        )

    except requests.HTTPError as e:
        elapsed = time.perf_counter() - t0
        body = ""
        try:
            body = e.response.text[:1500]
        except Exception:
            pass

        return EvalResult(
            provider=provider,
            model="?",
            ok_http=False,
            elapsed_sec=elapsed,
            raw_text_len=0,
            json_ok=False,
            pgn_present=False,
            moves_present=False,
            legal_moves=0,
            total_moves_checked=0,
            parse_source="none",
            error=f"HTTPError: {e} | body={body}",
        )

    except Exception as e:
        elapsed = time.perf_counter() - t0
        return EvalResult(
            provider=provider,
            model="?",
            ok_http=False,
            elapsed_sec=elapsed,
            raw_text_len=0,
            json_ok=False,
            pgn_present=False,
            moves_present=False,
            legal_moves=0,
            total_moves_checked=0,
            parse_source="none",
            error=f"{type(e).__name__}: {e}",
        )


def print_summary(results: List[EvalResult]) -> None:
    print("\n=== RESUMEN ===")
    headers = [
        "provider",
        "model",
        "sec",
        "http_ok",
        "json_ok",
        "pgn",
        "moves",
        "legal",
        "checked",
        "source",
        "error",
    ]
    print(" | ".join(headers))
    print("-" * 140)

    for r in results:
        row = [
            r.provider,
            r.model,
            f"{r.elapsed_sec:.2f}",
            str(r.ok_http),
            str(r.json_ok),
            str(r.pgn_present),
            str(r.moves_present),
            str(r.legal_moves),
            str(r.total_moves_checked),
            r.parse_source,
            (r.error or "")[:70],
        ]
        print(" | ".join(row))

    best = sorted(
        results,
        key=lambda x: (
            x.ok_http,
            x.json_ok,
            x.legal_moves,
            -x.elapsed_sec,
        ),
        reverse=True,
    )
    if best:
        winner = best[0]
        print("\nPosible ganador de esta ronda:")
        print(
            f"- {winner.provider} ({winner.model}) | "
            f"{winner.legal_moves}/{winner.total_moves_checked} jugadas legales | "
            f"{winner.elapsed_sec:.2f}s"
        )


def save_summary_json(results: List[EvalResult]) -> None:
    ensure_output_dir()
    path = OUTPUT_DIR / "summary.json"
    payload = [asdict(r) for r in results]
    save_text(path, json.dumps(payload, ensure_ascii=False, indent=2))


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: python bench_vision_pgn.py /ruta/a/planilla.jpg")
        return 1

    image_path = Path(sys.argv[1]).expanduser().resolve()
    if not image_path.exists():
        print(f"No existe la imagen: {image_path}")
        return 1

    ensure_output_dir()

    providers = ["openai", "gemini", "anthropic"]
    results: List[EvalResult] = []

    print(f"Imagen: {image_path}")
    print(f"Salida en: {OUTPUT_DIR.resolve()}\n")

    for provider in providers:
        print(f"Probando {provider}...")
        result = bench_one(provider, image_path)
        results.append(result)

        status = "OK" if result.ok_http else "ERROR"
        print(
            f"  {status} | {result.model} | {result.elapsed_sec:.2f}s | "
            f"json={result.json_ok} | legal={result.legal_moves}/{result.total_moves_checked}"
        )
        if result.error:
            print(f"  error: {result.error[:300]}")

    save_summary_json(results)
    print_summary(results)
    print("\nFicheros generados:")
    print("- bench_outputs/openai_raw.txt")
    print("- bench_outputs/gemini_raw.txt")
    print("- bench_outputs/anthropic_raw.txt")
    print("- bench_outputs/*_parsed.json")
    print("- bench_outputs/summary.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
