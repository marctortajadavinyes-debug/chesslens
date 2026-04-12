#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Lee una planilla de ajedrez con Gemini y devuelve una extracción estructurada JSON.
No genera el PGN final "definitivo"; devuelve:
- metadatos
- movetext PGN tentativo (si Gemini lo puede reconstruir)
- filas con texto bruto y candidatos

Uso:
    python server/vision_extract_gemini.py --image path/a/planilla.jpg
    python server/vision_extract_gemini.py --image path/a/planilla.jpg --out out/extraction.json
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field, ValidationError

try:
    from google import genai
    from google.genai import types
except Exception as e:
    print(
        "ERROR: No se ha podido importar google.genai.\n"
        "Instala dependencias con:\n"
        "  pip install -U google-genai pydantic pillow\n",
        file=sys.stderr,
    )
    raise

# ==========
# SCHEMA
# ==========


class MoveSide(BaseModel):
    raw: Optional[str] = Field(
        default=None,
        description="Texto bruto leído para esa media jugada, por ejemplo 'Ag7' o '0-0'.",
    )
    candidates: List[str] = Field(
        default_factory=list,
        description="Hasta 3 candidatos SAN plausibles para esa media jugada.",
    )
    confidence: Optional[float] = Field(
        default=None,
        description="Confianza aproximada 0..1.",
    )


class MoveRow(BaseModel):
    move_no: Optional[int] = Field(
        default=None,
        description="Número de jugada si se ve en la planilla.",
    )
    white: Optional[MoveSide] = None
    black: Optional[MoveSide] = None
    row_note: Optional[str] = Field(
        default=None,
        description="Comentario breve si la fila es dudosa o está incompleta.",
    )


class Metadata(BaseModel):
    event: Optional[str] = None
    site: Optional[str] = None
    date: Optional[str] = None
    round: Optional[str] = None
    white: Optional[str] = None
    black: Optional[str] = None
    result: Optional[str] = None
    white_elo: Optional[str] = None
    black_elo: Optional[str] = None


class ExtractionResult(BaseModel):
    model: Optional[str] = None
    image_path: Optional[str] = None
    metadata: Metadata = Field(default_factory=Metadata)
    pgn_movetext_guess: Optional[str] = Field(
        default=None,
        description="Movetext PGN tentativo, sin headers si es posible.",
    )
    rows: List[MoveRow] = Field(default_factory=list)
    global_notes: List[str] = Field(default_factory=list)


# ==========
# GEMINI PROMPT
# ==========

SYSTEM_PROMPT = """
Eres un asistente experto en leer planillas manuscritas de ajedrez.

Tu tarea es analizar UNA FOTO de una planilla de ajedrez y devolver UNA ESTRUCTURA JSON exacta.
No expliques nada fuera del JSON.

Objetivo:
1. Extraer metadatos si son legibles.
2. Extraer las jugadas fila por fila.
3. Si puedes reconstruir con bastante confianza el movetext completo, rellena pgn_movetext_guess.
4. Si una jugada es dudosa, NO inventes a ciegas: devuelve raw y hasta 3 candidates plausibles.
5. Usa notación SAN siempre que sea posible en candidates y en pgn_movetext_guess.
6. Si ves enroque, usa O-O u O-O-O, no 0-0.
7. Si el idioma de la pieza parece no inglés, igualmente intenta convertir los candidates a SAN inglesa estándar:
   K,Q,R,B,N y casillas en minúscula.
8. No metas comentarios largos. Sé útil y conservador.
9. No mezcles varias filas.
10. Si una media jugada no se ve, déjala null o vacía.

Importante:
- Esto no es OCR literal puro: intenta entender que es una planilla de ajedrez.
- Si una jugada parece por ejemplo "Ag7" pero visualmente podría ser "Bg7", puedes poner raw="Ag7" y candidates=["Bg7"].
- Si ves que el PGN completo sale bastante claro, rellena pgn_movetext_guess.
"""

USER_PROMPT = """
Analiza esta imagen de una planilla de ajedrez.

Devuelve SOLO JSON con este esquema conceptual:
{
  "metadata": {...},
  "pgn_movetext_guess": "1. e4 c5 2. Nf3 d6 ...",
  "rows": [
    {
      "move_no": 1,
      "white": {"raw": "e4", "candidates": ["e4"], "confidence": 0.98},
      "black": {"raw": "c5", "candidates": ["c5"], "confidence": 0.98},
      "row_note": null
    }
  ],
  "global_notes": []
}

No pongas markdown. No pongas texto extra.
"""


def detect_mime_type(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "image/jpeg"


def extract_with_gemini(
    image_path: Path, model_name: str = "gemini-2.5-flash"
) -> ExtractionResult:
    if not image_path.exists():
        raise FileNotFoundError(f"No existe la imagen: {image_path}")

    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("Falta la variable de entorno GEMINI_API_KEY")

    client = genai.Client()

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    image_part = types.Part.from_bytes(
        data=image_bytes,
        mime_type=detect_mime_type(image_path),
    )

    response = client.models.generate_content(
        model=model_name,
        contents=[
            SYSTEM_PROMPT,
            USER_PROMPT,
            image_part,
        ],
        config={
            "response_mime_type": "application/json",
            "response_json_schema": ExtractionResult.model_json_schema(),
            "temperature": 0.1,
        },
    )

    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Gemini no devolvió texto JSON.")

    try:
        data = ExtractionResult.model_validate_json(text)
    except ValidationError as e:
        raise RuntimeError(
            f"JSON inválido según schema:\n{e}\n\nRespuesta:\n{text}"
        ) from e

    data.model = model_name
    data.image_path = str(image_path)
    return data


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--image", required=True, help="Ruta a la imagen de la planilla"
    )
    parser.add_argument("--out", help="Ruta de salida JSON")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Modelo Gemini")
    args = parser.parse_args()

    image_path = Path(args.image)

    try:
        result = extract_with_gemini(image_path=image_path, model_name=args.model)
    except Exception as e:
        print(f"ERROR en vision_extract_gemini.py: {e}", file=sys.stderr)
        return 1

    payload = json.loads(result.model_dump_json(indent=2, exclude_none=False))

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
