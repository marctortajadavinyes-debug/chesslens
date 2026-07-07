#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import re
import json
import time
import tempfile

from typing import Any, Dict, List, Optional, Tuple, Set, NamedTuple

import chess

from google import genai

try:
    from PIL import Image, ImageOps, ImageEnhance
except Exception:
    Image = None
    ImageOps = None
    ImageEnhance = None

T0 = time.time()


def log(msg: str) -> None:
    dt = time.time() - T0
    print(f"[py] +{dt:0.1f}s {msg}", file=sys.stderr, flush=True)


# =========================================================
# Config
# =========================================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

OCR_PREPROCESS_ENABLED = os.environ.get("CHESSLENS_PREPROCESS_OCR", "1") != "0"
OCR_TARGET_LONG_SIDE = int(os.environ.get("CHESSLENS_OCR_TARGET_LONG_SIDE", "2200"))
OCR_MAX_UPSCALE = float(os.environ.get("CHESSLENS_OCR_MAX_UPSCALE", "2.0"))
OCR_CONTRAST = float(os.environ.get("CHESSLENS_OCR_CONTRAST", "1.35"))
OCR_SHARPNESS = float(os.environ.get("CHESSLENS_OCR_SHARPNESS", "1.25"))

OCR_BLOCK_ZOOM_ENABLED = os.environ.get("CHESSLENS_OCR_BLOCK_ZOOM", "0") == "1"
OCR_BLOCK_ZOOM_ONLY_IF_UPSCALED = (
    os.environ.get("CHESSLENS_OCR_BLOCK_ZOOM_ONLY_IF_UPSCALED", "1") != "0"
)
OCR_BLOCK_ZOOM_OVERLAP_RATIO = float(
    os.environ.get("CHESSLENS_OCR_BLOCK_ZOOM_OVERLAP_RATIO", "0.025")
)

DEFAULT_SHEET_FORMAT = "fce_75_3x25"

SHEET_FORMAT_PROFILES = {
    "fce_75_3x25": {
        "name": "FCE",
        "total_rows": 75,
        "blocks": [
            {"label": "Block 1", "from": 1, "to": 25, "position": "LEFT"},
            {"label": "Block 2", "from": 26, "to": 50, "position": "MIDDLE"},
            {"label": "Block 3", "from": 51, "to": 75, "position": "RIGHT"},
        ],
    },
    "fide_60_3x20": {
        "name": "FEDA/FIDE/US",
        "total_rows": 60,
        "blocks": [
            {"label": "Block 1", "from": 1, "to": 20, "position": "LEFT"},
            {"label": "Block 2", "from": 21, "to": 40, "position": "MIDDLE"},
            {"label": "Block 3", "from": 41, "to": 60, "position": "RIGHT"},
        ],
    },
    "standard_60_2x30": {
        "name": "Standard club/school 2-column",
        "total_rows": 60,
        "blocks": [
            {"label": "Block 1", "from": 1, "to": 30, "position": "LEFT"},
            {"label": "Block 2", "from": 31, "to": 60, "position": "RIGHT"},
        ],
    },
    "generic_40_2x20": {
        "name": "Generic 2-column",
        "total_rows": 40,
        "blocks": [
            {"label": "Block 1", "from": 1, "to": 20, "position": "LEFT"},
            {"label": "Block 2", "from": 21, "to": 40, "position": "RIGHT"},
        ],
    },
}


def get_sheet_format_profile(sheet_format: str) -> Dict[str, Any]:
    if sheet_format in SHEET_FORMAT_PROFILES:
        return SHEET_FORMAT_PROFILES[sheet_format]
    return SHEET_FORMAT_PROFILES[DEFAULT_SHEET_FORMAT]


DEFAULT_SCORESHEET_LANGUAGE = "ca"

NOTATION_PROFILE_BY_LANGUAGE = {
    # Català / Español:
    # Las iniciales prácticas son equivalentes en ambas lenguas.
    # C = Cavall/Caballo -> Knight
    # A = Alfil -> Bishop
    # T = Torre -> Rook
    # D = Dama -> Queen
    # R = Rei/Rey -> King
    "ca": "ca_es",
    "es": "ca_es",
    # English:
    # Ya está escrito en SAN internacional.
    # IMPORTANTE: en inglés R = Rook/Torre, no Rei/Rey.
    "en": "en",
}

PIECE_MAP_BY_PROFILE = {
    "ca_es": {
        "C": "N",
        "A": "B",
        "T": "R",
        "D": "Q",
        "R": "K",
    },
    "en": {
        "N": "N",
        "B": "B",
        "R": "R",
        "Q": "Q",
        "K": "K",
    },
}

PROMOTION_PIECE_MAP_BY_PROFILE = {
    "ca_es": {
        # Català / Español
        "D": "Q",
        "T": "R",
        "A": "B",
        "C": "N",
        # SAN internacional / inglés
        "Q": "Q",
        "R": "R",
        "B": "B",
        "N": "N",
    },
    "en": {
        "Q": "Q",
        "R": "R",
        "B": "B",
        "N": "N",
    },
}


def get_notation_profile(scoresheet_language: str = DEFAULT_SCORESHEET_LANGUAGE) -> str:
    lang = (scoresheet_language or DEFAULT_SCORESHEET_LANGUAGE).strip().lower()
    return NOTATION_PROFILE_BY_LANGUAGE.get(lang, "ca_es")


def get_piece_map_for_profile(profile: str) -> Dict[str, str]:
    return PIECE_MAP_BY_PROFILE.get(profile, PIECE_MAP_BY_PROFILE["ca_es"])


def get_promotion_piece_map_for_profile(profile: str) -> Dict[str, str]:
    return PROMOTION_PIECE_MAP_BY_PROFILE.get(
        profile,
        PROMOTION_PIECE_MAP_BY_PROFILE["ca_es"],
    )


# Alias antiguos para mantener el motor exactamente como hasta ahora
# mientras incorporamos el perfil inglés paso a paso.
CATALAN_PIECE_MAP = PIECE_MAP_BY_PROFILE["ca_es"]
PROMOTION_PIECE_MAP = PROMOTION_PIECE_MAP_BY_PROFILE["ca_es"]

VALID_ENGLISH_PIECES = set("KQRBN")
VALID_FILES = set("abcdefgh")
VALID_RANKS = set("12345678")

NOISE_TOKENS = {
    "taul",
    "taula",
    "taules",
    "tabl",
    "tabla",
    "tablas",
    "club",
    "nom",
    "result",
    "resultat",
    "ronda",
    "draw",
    "remis",
    "remi",
}

# =========================================================
# JSON / IO helpers
# =========================================================


def jprint(obj: Dict[str, Any]) -> None:
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def extract_json_object(text: str) -> str:
    text = (text or "").strip()
    text = text.replace("```json", "").replace("```", "").strip()
    i = text.find("{")
    j = text.rfind("}")
    if i != -1 and j != -1 and j > i:
        return text[i : j + 1]
    return text


def loose_json_repair(s: str) -> str:
    s = (s or "").strip()
    s = s.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s


def load_json_file(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_image_bytes(image_path: str) -> bytes:
    with open(image_path, "rb") as f:
        return f.read()


class OcrImageInput(NamedTuple):
    path: str
    mime_type: str
    label: str
    temporary: bool


def guess_mime_type(image_path: str) -> str:
    p = image_path.lower()
    if p.endswith(".png"):
        return "image/png"
    if p.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def preprocess_image_for_ocr(image_path: str) -> Tuple[str, Dict[str, Any]]:
    meta: Dict[str, Any] = {
        "enabled": False,
        "method": "none",
        "reason": "",
        "input_width": None,
        "input_height": None,
        "output_width": None,
        "output_height": None,
        "scale": 1.0,
        "contrast": None,
        "sharpness": None,
    }

    if not OCR_PREPROCESS_ENABLED:
        meta["reason"] = "disabled_by_env"
        return image_path, meta

    if Image is None or ImageOps is None or ImageEnhance is None:
        meta["reason"] = "pillow_not_available"
        log("OCR preprocessing skipped: Pillow not available")
        return image_path, meta

    try:
        img = Image.open(image_path)
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")

        input_w, input_h = img.size
        meta["input_width"] = input_w
        meta["input_height"] = input_h

        max_side = max(input_w, input_h)
        scale = 1.0

        if max_side > 0 and max_side < OCR_TARGET_LONG_SIDE:
            scale = min(OCR_MAX_UPSCALE, OCR_TARGET_LONG_SIDE / max_side)

        if scale > 1.05:
            new_w = int(round(input_w * scale))
            new_h = int(round(input_h * scale))
            resampling = getattr(Image, "Resampling", Image).LANCZOS
            img = img.resize((new_w, new_h), resampling)
        else:
            scale = 1.0

        # Versión OCR: gris + autocontraste suave + contraste + nitidez.
        # La imagen original se mantiene para mostrarla en frontend.
        gray = ImageOps.grayscale(img)
        gray = ImageOps.autocontrast(gray, cutoff=1)
        gray = ImageEnhance.Contrast(gray).enhance(OCR_CONTRAST)
        gray = ImageEnhance.Sharpness(gray).enhance(OCR_SHARPNESS)

        out_img = gray.convert("RGB")

        fd, tmp_path = tempfile.mkstemp(
            prefix="chesslens_ocr_preprocessed_",
            suffix=".jpg",
        )
        os.close(fd)

        out_img.save(tmp_path, "JPEG", quality=95, optimize=True)

        output_w, output_h = out_img.size

        meta.update(
            {
                "enabled": True,
                "method": "exif_upscale_grayscale_autocontrast_contrast_sharpen",
                "reason": "",
                "output_width": output_w,
                "output_height": output_h,
                "scale": scale,
                "contrast": OCR_CONTRAST,
                "sharpness": OCR_SHARPNESS,
            }
        )

        log(
            "OCR preprocessing enabled: "
            f"{input_w}x{input_h} -> {output_w}x{output_h}, "
            f"scale={scale:0.2f}, contrast={OCR_CONTRAST}, sharpness={OCR_SHARPNESS}"
        )

        return tmp_path, meta

    except Exception as e:
        meta["reason"] = f"preprocess_failed: {e}"
        log(f"OCR preprocessing failed; using original image: {e}")
        return image_path, meta


def build_block_zoom_inputs(
    image_path: str,
    sheet_format: str,
    preprocessing_meta: Dict[str, Any],
) -> Tuple[List[OcrImageInput], Dict[str, Any]]:
    meta: Dict[str, Any] = {
        "enabled": False,
        "reason": "",
        "sheet_format": sheet_format,
        "blocks_count": 0,
        "only_if_upscaled": OCR_BLOCK_ZOOM_ONLY_IF_UPSCALED,
        "crops": [],
    }

    if not OCR_BLOCK_ZOOM_ENABLED:
        meta["reason"] = "disabled_by_env"
        return [], meta

    if Image is None:
        meta["reason"] = "pillow_not_available"
        return [], meta

    if OCR_BLOCK_ZOOM_ONLY_IF_UPSCALED:
        scale = preprocessing_meta.get("scale")
        try:
            scale_value = float(scale)
        except Exception:
            scale_value = 1.0

        if scale_value <= 1.05:
            meta["reason"] = "not_upscaled"
            return [], meta

    profile = get_sheet_format_profile(sheet_format)
    blocks = profile.get("blocks") or []

    if len(blocks) <= 1:
        meta["reason"] = "single_block_format"
        return [], meta

    try:
        img = Image.open(image_path)
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")

        width, height = img.size
        if width <= 0 or height <= 0:
            meta["reason"] = "invalid_image_size"
            return [], meta

        block_count = len(blocks)
        overlap_px = int(round(width * OCR_BLOCK_ZOOM_OVERLAP_RATIO))

        outputs: List[OcrImageInput] = []

        for idx, block in enumerate(blocks):
            raw_x0 = int(round(width * idx / block_count))
            raw_x1 = int(round(width * (idx + 1) / block_count))

            x0 = max(0, raw_x0 - overlap_px)
            x1 = min(width, raw_x1 + overlap_px)

            if x1 <= x0:
                continue

            crop = img.crop((x0, 0, x1, height))

            fd, tmp_path = tempfile.mkstemp(
                prefix=f"chesslens_block_{idx + 1}_",
                suffix=".jpg",
            )
            os.close(fd)

            crop.save(tmp_path, "JPEG", quality=95, optimize=True)

            label = (
                f"{block.get('label', f'Block {idx + 1}')}: "
                f"moves {block.get('from')}..{block.get('to')} "
                f"({block.get('position')})"
            )

            outputs.append(
                OcrImageInput(
                    path=tmp_path,
                    mime_type="image/jpeg",
                    label=label,
                    temporary=True,
                )
            )

            meta["crops"].append(
                {
                    "label": label,
                    "x0": x0,
                    "x1": x1,
                    "y0": 0,
                    "y1": height,
                    "width": x1 - x0,
                    "height": height,
                }
            )

        if not outputs:
            meta["reason"] = "no_valid_crops"
            return [], meta

        meta["enabled"] = True
        meta["reason"] = ""
        meta["blocks_count"] = len(outputs)

        log(
            "OCR block zoom enabled: "
            f"{len(outputs)} crop(s), sheet_format={sheet_format}"
        )

        return outputs, meta

    except Exception as e:
        meta["reason"] = f"block_zoom_failed: {e}"
        log(f"OCR block zoom failed; using full image only: {e}")
        return [], meta


def cleanup_temporary_ocr_inputs(inputs: List[OcrImageInput]) -> None:
    for item in inputs:
        if not item.temporary:
            continue

        try:
            if os.path.exists(item.path):
                os.unlink(item.path)
                log(f"deleted temporary OCR image input: {item.label}")
        except Exception as e:
            log(f"could not delete temporary OCR image input {item.path}: {e}")


def base_result_payload() -> Dict[str, Any]:
    return {
        "ok": False,
        "pgn": None,
        "error": None,
        "moves": [],
        "errors": [],
        "meta": None,
        "ocr": {"meta": {}, "rows": []},
        "stopped_for_review": False,
        "blocked_row": None,
        "blocked_side": None,
        "raw_token": None,
        "candidates": [],
        "fen": None,
    }


def fail(error_message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    payload = base_result_payload()
    payload["error"] = error_message
    if extra:
        payload.update(extra)
    jprint(payload)
    sys.exit(0)


# =========================================================
# Gemini OCR of rows
# =========================================================


def build_sheet_structure_prompt(sheet_format: str) -> str:
    profile = get_sheet_format_profile(sheet_format)
    blocks = profile["blocks"]

    lines = [
        "ROWS:",
        f'- The moves table uses the "{profile["name"]}" scoresheet format.',
        f"- The sheet contains up to {profile['total_rows']} printed move rows.",
        f"- The moves table is split into {len(blocks)} vertical block(s):",
    ]

    for block in blocks:
        lines.append(
            f"  {block['label']} = moves {block['from']}..{block['to']} "
            f"({block['position']})"
        )

    reading_order = ", then ".join(block["position"] for block in blocks)

    lines.extend(
        [
            f"- Read blocks STRICTLY in this order: {reading_order}.",
            "- Inside each block, read rows from TOP to BOTTOM.",
            "- Each row has move number, white move, black move.",
            "- Return rows in final reading order.",
            "- For each row return:",
            '  {"n": <move_number>, "w": "<exact white cell text>", "b": "<exact black cell text>"}',
            "- Read ONLY the handwritten move cell contents.",
            "- Keep EXACT OCR text when possible.",
            "- Do NOT validate chess legality.",
            "- Do NOT normalize notation.",
            "- Do NOT translate to English.",
            "- Do NOT guess missing moves.",
            "- IMPORTANT: If a cell is completely crossed out, heavily scribbled over, empty, or unreadable, return an empty string.",
        ]
    )

    return "\n".join(lines)


def call_gemini_rows(
    image_bytes: bytes,
    mime_type: str,
    sheet_format: str = DEFAULT_SHEET_FORMAT,
    block_inputs: Optional[List[OcrImageInput]] = None,
) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) env var not set")

    client = genai.Client(api_key=GEMINI_API_KEY)
    rows_prompt = build_sheet_structure_prompt(sheet_format)
    block_inputs = block_inputs or []

    zoom_prompt = ""
    if block_inputs:
        zoom_prompt = (
            "\nIMAGE INPUTS:\n"
            "- You will receive the full scoresheet image first.\n"
            "- You will also receive zoomed crop images of the move blocks.\n"
            "- Use the full image to understand the global layout.\n"
            "- Use the zoomed block images only as visual help to read the cells more accurately.\n"
            "- Do NOT duplicate rows from the full image and crop images.\n"
            "- Return one single rows array in the final reading order described below.\n"
        )

    prompt = (
        "Strict OCR task for a Catalan chess scoresheet.\n"
        "You are a strictly literal OCR transcription engine.\n"
        "Your only job is visual transcription. You do not play chess.\n"
        "Transcribe exactly what you see, even if it looks like an illegal chess move, a typo, or an impossible move.\n"
        "Never correct the player. Never infer a legal chess move from context.\n"
        "The scoresheet is handwritten and the move notation is in CATALAN.\n"
        "Return ONLY valid JSON with EXACTLY two top-level keys: headers and rows.\n"
        f"{zoom_prompt}\n"
        "HEADERS:\n"
        "- headers MUST contain exactly these keys:\n"
        "  Event, Site, Date, Round, White, Black, Result\n"
        "- If unclear, use empty string, but always include the key.\n"
        "- Read ONLY the handwritten top fields.\n"
        "- IMPORTANT: Site must be the handwritten playing site/club if present.\n"
        "- DO NOT use printed federation address as Site.\n\n"
        f"{rows_prompt}\n\n"
        "Return ONLY valid JSON. No markdown. No extra text.\n\n"
        'Schema example: {"headers":{"Event":"","Site":"","Date":"","Round":"","White":"","Black":"","Result":""},"rows":[{"n":1,"w":"","b":""},{"n":2,"w":"","b":""}]}'
    )

    parts: List[Dict[str, Any]] = [
        {"text": prompt},
        {"text": "FULL SCORESHEET IMAGE:"},
        {
            "inline_data": {
                "mime_type": mime_type,
                "data": image_bytes,
            }
        },
    ]

    for block_input in block_inputs:
        parts.append({"text": f"ZOOMED BLOCK IMAGE - {block_input.label}:"})
        parts.append(
            {
                "inline_data": {
                    "mime_type": block_input.mime_type,
                    "data": read_image_bytes(block_input.path),
                }
            }
        )

    contents = [
        {
            "role": "user",
            "parts": parts,
        }
    ]
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config={
            "temperature": 0,
            "max_output_tokens": 4000,
            "thinking_config": {"thinking_budget": 0},
        },
    )

    text = getattr(resp, "text", None) or ""
    candidate = extract_json_object(text)

    try:
        raw = json.loads(candidate)
    except Exception:
        raw = json.loads(loose_json_repair(candidate))

    return normalize_ocr_payload(raw)


# =========================================================
# OCR normalization
# =========================================================


def normalize_date_to_pgn(d: str) -> str:
    d = (d or "").strip()
    if not d:
        return ""
    if re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", d):
        return d
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})", d)
    if m:
        dd = int(m.group(1))
        mm = int(m.group(2))
        yy = m.group(3)
        yyyy = int("20" + yy) if len(yy) == 2 else int(yy)
        return f"{yyyy:04d}.{mm:02d}.{dd:02d}"
    return ""


def normalize_result(r: str) -> str:
    r = (r or "").strip()
    if not r:
        return "*"
    r = r.replace("½", "1/2").replace(" ", "")
    if r in {"1-0", "0-1", "*"}:
        return r
    if r in {"1/2", "1/2-1/2"}:
        return "1/2-1/2"
    return "*"


def normalize_headers(headers: Dict[str, Any]) -> Dict[str, str]:
    h = {k: (str(v) if v is not None else "") for k, v in (headers or {}).items()}
    required = ["Event", "Site", "Date", "Round", "White", "Black", "Result"]
    for k in required:
        h[k] = (h.get(k) or "").strip()

    h["Date"] = normalize_date_to_pgn(h["Date"])
    h["Result"] = normalize_result(h["Result"])

    site = h["Site"].upper()
    if "ESCACS.CAT" in site or "BARCELONA" in site or "080" in site or "*" in site:
        h["Site"] = ""
    return h


def normalize_ocr_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    headers_raw = data.get("headers") or {}
    rows_raw = data.get("rows") or []
    headers_norm = normalize_headers(headers_raw)
    rows_out: List[Dict[str, Any]] = []

    for item in rows_raw:
        if not isinstance(item, dict):
            continue
        n = item.get("n", item.get("row"))
        try:
            n = int(n)
        except Exception:
            continue
        rows_out.append(
            {
                "row": n,
                "w": str(item.get("w") or "").strip(),
                "b": str(item.get("b") or "").strip(),
            }
        )
    rows_out.sort(key=lambda x: x["row"])
    return {
        "meta": {
            "event": headers_norm.get("Event", ""),
            "site": headers_norm.get("Site", ""),
            "date": headers_norm.get("Date", ""),
            "round": headers_norm.get("Round", ""),
            "white": headers_norm.get("White", ""),
            "black": headers_norm.get("Black", ""),
            "result": headers_norm.get("Result", "*"),
            "headers_raw": headers_raw,
            "headers_normalized": headers_norm,
        },
        "rows": rows_out,
    }


def normalize_meta_from_payload(meta: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(meta, dict):
        meta = {}
    return {
        "event": str(meta.get("event") or ""),
        "site": str(meta.get("site") or ""),
        "date": normalize_date_to_pgn(str(meta.get("date") or "")),
        "round": str(meta.get("round") or ""),
        "white": str(meta.get("white") or ""),
        "black": str(meta.get("black") or ""),
        "result": normalize_result(str(meta.get("result") or "*")),
        "headers_raw": meta.get("headers_raw")
        if isinstance(meta.get("headers_raw"), dict)
        else {},
        "headers_normalized": meta.get("headers_normalized")
        if isinstance(meta.get("headers_normalized"), dict)
        else {},
    }


# =========================================================
# PGN builder
# =========================================================
def final_result_from_board(board: chess.Board, fallback: str) -> str:
    if board.is_checkmate():
        # Si hay mate, gana el lado que acaba de mover.
        return "0-1" if board.turn == chess.WHITE else "1-0"

    if board.is_stalemate():
        return "1/2-1/2"

    if board.is_insufficient_material():
        return "1/2-1/2"

    if board.can_claim_threefold_repetition():
        return "1/2-1/2"

    if board.can_claim_fifty_moves():
        return "1/2-1/2"

    return fallback or "*"


def build_pgn(meta: Dict[str, Any], moves: List[str]) -> str:
    def esc(x: str) -> str:
        return (x or "").replace('"', '\\"')

    temp_board = chess.Board()
    for mv in moves:
        try:
            temp_board.push_san(mv)
        except Exception:
            break

    resolved_result = final_result_from_board(temp_board, meta.get("result", "*"))

    lines = [
        f'[Event "{esc(meta.get("event", ""))}"]',
        f'[Site "{esc(meta.get("site", ""))}"]',
        f'[Date "{esc(meta.get("date", ""))}"]',
        f'[Round "{esc(meta.get("round", ""))}"]',
        f'[White "{esc(meta.get("white", ""))}"]',
        f'[Black "{esc(meta.get("black", ""))}"]',
        f'[Result "{esc(resolved_result)}"]',
        "",
    ]
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

    body = " ".join(out).strip()
    if body:
        body = f"{body} {resolved_result}".strip()
    else:
        body = resolved_result

    lines.append(body)
    return "\n".join(lines).strip()


# =========================================================
# OCR / notation helpers
# =========================================================


def looks_like_noise_cell(s: str) -> bool:
    t = clean_spacing(s)
    if not t:
        return True

    tl = t.lower()
    if tl in NOISE_TOKENS:
        return True

    # Restos típicos de una celda tachada o incompleta.
    # Ejemplo real: fila saltada leída como "Nx".
    # "Nx" / "Bx" / "Rx" / "Qx" / "Kx" no son SAN completas
    # porque falta la casilla de destino.
    if re.fullmatch(r"[KQRBNCATDkqrbncatd]x[+#]?", t):
        return True

    return False


def clean_spacing(token: str) -> str:
    t = (token or "").strip()
    t = t.replace(" ", "")
    t = t.replace("—", "-").replace("–", "-").replace("−", "-")
    t = t.replace("×", "x").replace("X", "x")
    t = t.replace("0-0-0", "O-O-O").replace("0-0", "O-O")
    t = t.replace("o-o-o", "O-O-O").replace("o-o", "O-O")
    t = re.sub(r"[!?]+$", "", t)
    t = t.replace(":", "")
    t = t.replace(";", "")
    t = t.replace(",", "")
    return t


def translate_catalan_piece_letters(token: str) -> str:
    t = clean_spacing(token)
    if not t:
        return t
    if t[0] in CATALAN_PIECE_MAP:
        t = CATALAN_PIECE_MAP[t[0]] + t[1:]
    return t


def translate_english_piece_letters(token: str) -> str:
    """
    English scoresheets are normally already written in SAN.

    Safe behavior:
    - Keep N, B, R, Q, K unchanged.
    - Convert lowercase n/r/q/k to uppercase if the player wrote them small.
    - Do NOT auto-convert lowercase b, because "b" is also a pawn file.
      Example: b4 / bxa5 must stay pawn notation.
    """
    t = clean_spacing(token)
    if not t:
        return t

    if t in {"O-O", "O-O-O"}:
        return t

    first = t[0]

    if first in {"N", "B", "R", "Q", "K"}:
        return t

    if first in {"n", "r", "q", "k"}:
        return first.upper() + t[1:]

    return t


def is_valid_square(file_char: str, rank_char: str) -> bool:
    return file_char.lower() in VALID_FILES and rank_char in VALID_RANKS


def square_micro_variants(file_char: str, rank_char: str) -> List[Tuple[str, str]]:
    file_char = file_char.lower()
    file_opts = [file_char]
    rank_opts = [rank_char]

    if file_char == "9":
        file_opts.append("g")
    if file_char == "6":
        file_opts.append("b")
    if file_char == "h":
        file_opts.append("b")
    if file_char == "b":
        file_opts.append("h")

    if rank_char == "7":
        rank_opts.append("2")
    if rank_char == "2":
        rank_opts.append("7")
    if rank_char == "f":
        rank_opts.append("7")
    if rank_char == "6":
        rank_opts.append("8")

    out = []
    seen = set()
    for f in file_opts:
        for r in rank_opts:
            key = (f, r)
            if key not in seen:
                seen.add(key)
                out.append(key)
    return out


def expand_embedded_squares(token: str) -> List[str]:
    t = clean_spacing(token)
    if not t:
        return []
    suffix = ""
    if t.endswith("+") or t.endswith("#"):
        suffix = t[-1]
        core = t[:-1]
    else:
        core = t

    out: Set[str] = set()

    patterns = [
        r"^([KQRBN])([a-zA-Z0-9])([a-zA-Z0-9])$",
        r"^([KQRBN])x([a-zA-Z0-9])([a-zA-Z0-9])$",
        r"^([KQRBN])([a-zA-Z0-9])x([a-zA-Z0-9])([a-zA-Z0-9])$",
        r"^([KQRBN])([1-8])([a-zA-Z0-9])([a-zA-Z0-9])$",
        r"^([a-zA-Z0-9])x([a-zA-Z0-9])([a-zA-Z0-9])$",
        r"^([a-zA-Z0-9])([a-zA-Z0-9])$",
    ]

    for pat in patterns:
        m = re.fullmatch(pat, core)
        if not m:
            continue
        g = m.groups()

        if pat == r"^([KQRBN])([a-zA-Z0-9])([a-zA-Z0-9])$":
            p, f, r = g
            for ff, rr in square_micro_variants(f, r):
                if is_valid_square(ff, rr):
                    out.add(f"{p}{ff}{rr}{suffix}")
        elif pat == r"^([KQRBN])x([a-zA-Z0-9])([a-zA-Z0-9])$":
            p, f, r = g
            for ff, rr in square_micro_variants(f, r):
                if is_valid_square(ff, rr):
                    out.add(f"{p}x{ff}{rr}{suffix}")
        elif pat == r"^([KQRBN])([a-zA-Z0-9])x([a-zA-Z0-9])([a-zA-Z0-9])$":
            p, dis, f, r = g
            if dis.lower() in VALID_FILES:
                for ff, rr in square_micro_variants(f, r):
                    if is_valid_square(ff, rr):
                        out.add(f"{p}{dis.lower()}x{ff}{rr}{suffix}")
        elif pat == r"^([KQRBN])([1-8])([a-zA-Z0-9])([a-zA-Z0-9])$":
            p, dis, f, r = g
            for ff, rr in square_micro_variants(f, r):
                if is_valid_square(ff, rr):
                    out.add(f"{p}{dis}{ff}{rr}{suffix}")
        elif pat == r"^([a-zA-Z0-9])x([a-zA-Z0-9])([a-zA-Z0-9])$":
            from_file, f, r = g
            from_opts = [from_file.lower()]
            if from_file.lower() == "9":
                from_opts.append("g")
            if from_file.lower() == "6":
                from_opts.append("b")
            if from_file.lower() == "h":
                from_opts.append("b")
            if from_file.lower() == "b":
                from_opts.append("h")
            for ff0 in from_opts:
                if ff0 not in VALID_FILES:
                    continue
                for ff, rr in square_micro_variants(f, r):
                    if is_valid_square(ff, rr):
                        out.add(f"{ff0}x{ff}{rr}{suffix}")
        elif pat == r"^([a-zA-Z0-9])([a-zA-Z0-9])$":
            f, r = g
            for ff, rr in square_micro_variants(f, r):
                if is_valid_square(ff, rr):
                    out.add(f"{ff}{rr}{suffix}")

    return list(out)


def normalize_square_case(token: str) -> str:
    t = clean_spacing(token)
    if not t:
        return t
    if t in {"O-O", "O-O-O"}:
        return t

    m = re.fullmatch(r"([A-Za-z])([1-8])([+#]?)", t)
    if m:
        file_, rank_, suf = m.groups()
        return file_.lower() + rank_ + suf
    m = re.fullmatch(r"([KQRBN])([A-Za-z])([A-Za-z])([1-8])([+#]?)", t)
    if m:
        piece, disamb, file_, rank_, suf = m.groups()
        if disamb.lower() in VALID_FILES and file_.lower() in VALID_FILES:
            return piece + disamb.lower() + file_.lower() + rank_ + suf
        return t
    m = re.fullmatch(r"([KQRBN])([1-8])([A-Za-z])([1-8])([+#]?)", t)
    if m:
        piece, disamb, file_, rank_, suf = m.groups()
        if file_.lower() in VALID_FILES:
            return piece + disamb + file_.lower() + rank_ + suf
        return t
    m = re.fullmatch(r"([KQRBN])([A-Za-z])x([A-Za-z])([1-8])([+#]?)", t)
    if m:
        piece, disamb, file_, rank_, suf = m.groups()
        if disamb.lower() in VALID_FILES and file_.lower() in VALID_FILES:
            return piece + disamb.lower() + "x" + file_.lower() + rank_ + suf
        return t
    m = re.fullmatch(r"([KQRBN])([1-8])x([A-Za-z])([1-8])([+#]?)", t)
    if m:
        piece, disamb, file_, rank_, suf = m.groups()
        if file_.lower() in VALID_FILES:
            return piece + disamb + "x" + file_.lower() + rank_ + suf
        return t
    m = re.fullmatch(r"([KQRBN])([A-Za-z])([1-8])([+#]?)", t)
    if m:
        piece, file_, rank_, suf = m.groups()
        if file_.lower() in VALID_FILES:
            return piece + file_.lower() + rank_ + suf
        return t
    m = re.fullmatch(r"([KQRBN])x([A-Za-z])([1-8])([+#]?)", t)
    if m:
        piece, file_, rank_, suf = m.groups()
        if file_.lower() in VALID_FILES:
            return piece + "x" + file_.lower() + rank_ + suf
        return t
    m = re.fullmatch(r"([A-Za-z])x([A-Za-z])([1-8])([+#]?)", t)
    if m:
        from_file, to_file, rank_, suf = m.groups()
        if from_file.lower() in VALID_FILES and to_file.lower() in VALID_FILES:
            return from_file.lower() + "x" + to_file.lower() + rank_ + suf
        return t

    m = re.fullmatch(r"([a-hA-H](?:x[a-hA-H])?[18])=([CATDNBRQcatdnbrq])([+#]?)", t)
    if m:
        base, promo, suf = m.groups()
        promo = promo.upper()
        promo = PROMOTION_PIECE_MAP.get(promo, promo)
        return base.lower() + "=" + promo + suf

    return t


def ocr_fixes(token: str) -> str:
    t = clean_spacing(token)
    if not t:
        return t
    if re.fullmatch(r"9[1-8]", t):
        return "g" + t[1]
    t = normalize_square_case(t)
    return t


def dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for x in items:
        x = clean_spacing(x)
        x = normalize_square_case(x)
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def candidate_tokens(raw: str) -> List[str]:
    base = clean_spacing(raw)
    if not base or looks_like_noise_cell(base):
        return []

    out: List[str] = []

    c1 = translate_catalan_piece_letters(base)
    c1 = ocr_fixes(c1)
    out.append(c1)

    m = re.fullmatch(r"([A-Za-z0-9])([A-Za-z0-9])([+#]?)", base)
    if m:
        a, b, suf = m.groups()
        for ff, rr in square_micro_variants(a, b):
            if is_valid_square(ff, rr):
                out.append(ff + rr + suf)

    c2 = ocr_fixes(base)
    out.append(c2)

    m = re.fullmatch(r"[aA](x[a-zA-Z0-9][a-zA-Z0-9][+#]?)", base)
    if m:
        out.append("B" + m.group(1).lower())

    translated = translate_catalan_piece_letters(base)
    out.extend(expand_embedded_squares(translated))
    out.extend(expand_embedded_squares(base))

    return dedupe_keep_order(out)


def candidate_tokens_for_profile(raw: str, profile: str = "ca_es") -> List[str]:
    """
    Profile-aware candidate generation.

    Safety rule:
    - ca_es keeps using the existing stable candidate_tokens(raw).
    - en uses English/SAN piece letters without Catalan translation.
    """
    if profile != "en":
        return candidate_tokens(raw)

    base = clean_spacing(raw)
    if not base or looks_like_noise_cell(base):
        return []

    out: List[str] = []

    c1 = translate_english_piece_letters(base)
    c1 = ocr_fixes(c1)
    out.append(c1)

    m = re.fullmatch(r"([A-Za-z0-9])([A-Za-z0-9])([+#]?)", base)
    if m:
        a, b, suf = m.groups()
        for ff, rr in square_micro_variants(a, b):
            if is_valid_square(ff, rr):
                out.append(ff + rr + suf)

    c2 = ocr_fixes(base)
    out.append(c2)

    translated = translate_english_piece_letters(base)
    out.extend(expand_embedded_squares(translated))
    out.extend(expand_embedded_squares(base))

    return dedupe_keep_order(out)


# =========================================================
# Validation helpers
# =========================================================


def san_capture_semantics_ok(board: chess.Board, san: str, move: chess.Move) -> bool:
    san_upper = san.upper()

    # Enroques: no aplicar esta regla
    if san_upper in ("O-O", "O-O-O"):
        return True

    expects_capture = "X" in san_upper
    is_capture = board.is_capture(move)

    return expects_capture == is_capture


def try_push_san(
    board: chess.Board,
    raw: str,
    profile: str = "ca_es",
) -> Tuple[bool, Optional[str], Optional[str], List[str]]:
    cands = candidate_tokens_for_profile(raw, profile)
    legal: List[str] = []

    last_err: Optional[str] = None

    for cand in cands:
        tmp = board.copy(stack=True)

        try:
            move = tmp.parse_san(cand)
        except Exception as e:
            last_err = f"invalid san: {cand!r}"
            continue

        # ✅ Regla crítica: la semántica de captura debe coincidir
        if not san_capture_semantics_ok(board, cand, move):
            last_err = f"capture mismatch: {cand!r} in {board.fen()}"
            continue

        try:
            tmp.push(move)
            legal.append(cand)
        except Exception as e:
            last_err = f"illegal san: {cand!r} in {board.fen()}"
            continue

    if not legal:
        return False, None, last_err or f"invalid san: {raw!r}", []

    chosen = legal[0]

    move = board.parse_san(chosen)
    board.push(move)

    return True, chosen, None, legal


def canonicalize_user_move_for_match_variants(token: str) -> List[str]:
    t = clean_spacing(token)
    if not t:
        return []

    variants: List[str] = []

    # Variante 1: tratarlo como SAN inglesa ya correcta
    # (esto es lo normal cuando viene del tablero / chess.js)
    v1 = normalize_square_case(t)
    v1 = re.sub(r"[+#]+$", "", v1)
    if v1:
        variants.append(v1)

    # Solo intentamos traducción catalana si NO parece ya una SAN inglesa
    # de pieza. Esto evita ambigüedades como:
    #   Rg3+  -> rook move correcto
    #   Rg3+  -> mal reinterpretado como Kg3 por "R = Rei"
    first = t[0].upper() if t else ""

    looks_like_english_piece_san = first in VALID_ENGLISH_PIECES

    if not looks_like_english_piece_san:
        v2 = translate_catalan_piece_letters(t)
        v2 = normalize_square_case(v2)
        v2 = re.sub(r"[+#]+$", "", v2)
        if v2 and v2 not in variants:
            variants.append(v2)

    return variants


def try_accept_user_correction(
    board: chess.Board, corrected_move: str
) -> Tuple[bool, Optional[str], Optional[str], List[str]]:
    wanted_variants = canonicalize_user_move_for_match_variants(corrected_move)

    if not wanted_variants:
        return False, None, "empty/filtered", []

    legal_matches: List[Tuple[chess.Move, str]] = []

    for mv in board.legal_moves:
        try:
            san = board.san(mv)
        except Exception:
            continue

        san_match = re.sub(r"[+#]+$", "", clean_spacing(san))

        if san_match in wanted_variants:
            legal_matches.append((mv, san))

    if not legal_matches:
        return False, None, "no_matching_legal_move", wanted_variants[:20]

    if len(legal_matches) > 1:
        return (
            False,
            None,
            "ambiguous_multiple_legal_matches",
            [san for _, san in legal_matches[:20]],
        )

    chosen_move, chosen_san = legal_matches[0]
    board.push(chosen_move)

    return True, chosen_san, None, [chosen_san]


def flatten_rows(rows: List[Dict[str, Any]]) -> List[Tuple[int, str, str]]:
    seq: List[Tuple[int, str, str]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        row = r.get("row", r.get("n"))
        try:
            row = int(row)
        except Exception:
            continue

        w = str(r.get("w") or "").strip()
        b = str(r.get("b") or "").strip()

        if w and not looks_like_noise_cell(w):
            seq.append((row, "w", w))
        if b and not looks_like_noise_cell(b):
            seq.append((row, "b", b))
    return seq


def find_resume_next_index(
    seq: List[Tuple[int, str, str]], blocked_row: int, blocked_side: str
) -> int:
    # 👉 NUEVA LÓGICA: Buscar temporalmente el turno posterior
    # aunque el OCR haya omitido la celda que acabamos de corregir.
    for i, (row, side, _raw) in enumerate(seq):
        if row > blocked_row:
            return i
        if row == blocked_row:
            if blocked_side == "w" and side == "b":
                return i
            if side == blocked_side:
                # Encontramos la celda exacta, seguimos en la siguiente
                return i + 1

    return len(seq)  # Si hemos llegado al final, terminamos.


def get_manual_correction_for_ply(
    manual_corrections: List[Dict[str, Any]], ply_index: int
) -> Optional[str]:
    for item in manual_corrections:
        if not isinstance(item, dict):
            continue

        try:
            ply = int(item.get("ply"))
        except Exception:
            continue

        if ply != ply_index:
            continue

        san = str(item.get("san") or "").strip()
        if san:
            return san

    return None


def compute_stats(
    rows: List[Dict[str, Any]], moves: List[str], errors: List[Dict[str, Any]]
) -> Dict[str, Any]:
    sample_rows = []
    for r in rows[:20]:
        sample_rows.append(
            {
                "row": r.get("row"),
                "w": r.get("w"),
                "b": r.get("b"),
            }
        )
    return {
        "rows_count": len(rows),
        "raw_moves_count": len(rows) * 2,
        "valid_moves_count": len(moves),
        "errors_count": len(errors),
        "sample_rows": sample_rows,
    }


# =========================================================
# Core parser
# =========================================================


def parse_rows_stop_on_first_conflict(
    rows: List[Dict[str, Any]],
    meta: Dict[str, Any],
    board: chess.Board,
    accepted_prefix_moves: List[str],
    start_index: int = 0,
    manual_corrections: Optional[List[Dict[str, Any]]] = None,
    profile: str = "ca_es",
) -> Dict[str, Any]:
    accepted_moves = list(accepted_prefix_moves)
    manual_corrections = manual_corrections or []
    errors: List[Dict[str, Any]] = []
    seq = flatten_rows(rows)
    seq = seq[start_index:]
    considered = 0
    pushed = 0

    for row_num, side, raw in seq:
        expected_turn = "w" if board.turn == chess.WHITE else "b"

        if side != expected_turn:
            stopped = {
                "row": row_num,
                "side": side,
                "raw": raw,
                "normalized": "",
                "candidates": [],
                "reason": f"out_of_turn_{side}",
                "fen": board.fen(),
            }
            errors.append(stopped)
            pgn = build_pgn(meta, accepted_moves)
            meta_out = build_meta_out(
                meta, rows, accepted_moves, errors, considered, pushed
            )
            return {
                "ok": True,
                "pgn": pgn,
                "error": None,
                "moves": accepted_moves,
                "errors": errors,
                "meta": meta_out,
                "ocr": {"meta": meta, "rows": rows},
                "stopped_for_review": True,
                "blocked_row": row_num,
                "blocked_side": side,
                "raw_token": raw,
                "candidates": [],
                "fen": board.fen(),
            }

        considered += 1
        current_ply = len(accepted_moves)
        stored_manual = get_manual_correction_for_ply(manual_corrections, current_ply)

        if stored_manual:
            ok, chosen, err, cands = try_accept_user_correction(board, stored_manual)
            normalized = cands[0] if cands else ""

            if ok and chosen:
                accepted_moves.append(chosen)
                pushed += 1
                continue

            stopped = {
                "row": row_num,
                "side": side,
                "raw": stored_manual,
                "normalized": normalized,
                "candidates": cands[:20],
                "reason": f"stored_manual_correction_invalid: {err}",
                "fen": board.fen(),
            }
            errors.append(stopped)
            pgn = build_pgn(meta, accepted_moves)
            meta_out = build_meta_out(
                meta, rows, accepted_moves, errors, considered, pushed
            )

            return {
                "ok": True,
                "pgn": pgn,
                "error": None,
                "moves": accepted_moves,
                "errors": errors,
                "meta": meta_out,
                "ocr": {"meta": meta, "rows": rows},
                "stopped_for_review": True,
                "blocked_row": row_num,
                "blocked_side": side,
                "raw_token": stored_manual,
                "candidates": cands[:20],
                "fen": board.fen(),
            }

        ok, chosen, err, cands = try_push_san(
            board,
            raw,
            profile=profile,
        )
        normalized = cands[0] if cands else ""

        if ok and chosen:
            accepted_moves.append(chosen)
            pushed += 1
            continue

        stopped = {
            "row": row_num,
            "side": side,
            "raw": raw,
            "normalized": normalized,
            "candidates": cands[:20],
            "reason": err,
            "fen": board.fen(),
        }
        errors.append(stopped)
        pgn = build_pgn(meta, accepted_moves)
        meta_out = build_meta_out(
            meta, rows, accepted_moves, errors, considered, pushed
        )

        return {
            "ok": True,
            "pgn": pgn,
            "error": None,
            "moves": accepted_moves,
            "errors": errors,
            "meta": meta_out,
            "ocr": {"meta": meta, "rows": rows},
            "stopped_for_review": True,
            "blocked_row": row_num,
            "blocked_side": side,
            "raw_token": raw,
            "candidates": cands[:20],
            "fen": board.fen(),
        }

    pgn = build_pgn(meta, accepted_moves)
    meta_out = build_meta_out(meta, rows, accepted_moves, errors, considered, pushed)

    return {
        "ok": True,
        "pgn": pgn,
        "error": None,
        "moves": accepted_moves,
        "errors": errors,
        "meta": meta_out,
        "ocr": {"meta": meta, "rows": rows},
        "stopped_for_review": False,
        "blocked_row": None,
        "blocked_side": None,
        "raw_token": None,
        "candidates": [],
        "fen": None,
    }


def build_meta_out(
    meta: Dict[str, Any],
    rows: List[Dict[str, Any]],
    moves: List[str],
    errors: List[Dict[str, Any]],
    considered: int,
    pushed: int,
) -> Dict[str, Any]:
    stats = compute_stats(rows, moves, errors)
    out = dict(meta)
    out["engine"] = "gemini"
    out["parse_mode"] = "json_rows_a3_resumeable"
    out["rows_count"] = stats["rows_count"]
    out["raw_moves_count"] = stats["raw_moves_count"]
    out["valid_moves_count"] = len(moves)
    out["errors_count"] = len(errors)
    out["considered_cells"] = considered
    out["pushed_moves"] = pushed
    out["sample_rows"] = stats["sample_rows"]
    return out


# =========================================================
# Initial / parse_rows / resume modes
# =========================================================


def process_initial(
    image_path: str,
    sheet_format: str = DEFAULT_SHEET_FORMAT,
    scoresheet_language: str = DEFAULT_SCORESHEET_LANGUAGE,
) -> Dict[str, Any]:
    ocr_image_path, preprocessing_meta = preprocess_image_for_ocr(image_path)
    block_inputs: List[OcrImageInput] = []
    block_zoom_meta: Dict[str, Any] = {
        "enabled": False,
        "reason": "not_initialized",
    }

    try:
        sheet_profile = get_sheet_format_profile(sheet_format)
        notation_profile = get_notation_profile(scoresheet_language)

        block_inputs, block_zoom_meta = build_block_zoom_inputs(
            image_path=ocr_image_path,
            sheet_format=sheet_format,
            preprocessing_meta=preprocessing_meta,
        )

        image_bytes = read_image_bytes(ocr_image_path)
        mime_type = guess_mime_type(ocr_image_path)

        log("calling gemini rows OCR...")
        ocr = call_gemini_rows(
            image_bytes,
            mime_type,
            sheet_format=sheet_format,
            block_inputs=block_inputs,
        )
        log("gemini returned")

        meta = ocr["meta"]
        meta["scoresheetLanguage"] = scoresheet_language
        meta["notation_profile"] = notation_profile
        rows = ocr["rows"]
        board = chess.Board()

        result = parse_rows_stop_on_first_conflict(
            rows=rows,
            meta=meta,
            board=board,
            accepted_prefix_moves=[],
            start_index=0,
            manual_corrections=[],
            profile=notation_profile,
        )

        sheet_format_profile_meta = {
            "sheet_format": sheet_format,
            "name": sheet_profile["name"],
            "total_rows": sheet_profile["total_rows"],
        }

        if isinstance(result.get("meta"), dict):
            result["meta"]["ocr_preprocessing"] = preprocessing_meta
            result["meta"]["ocr_block_zoom"] = block_zoom_meta
            result["meta"]["sheet_format_profile"] = sheet_format_profile_meta

        if isinstance(result.get("ocr"), dict) and isinstance(
            result["ocr"].get("meta"), dict
        ):
            result["ocr"]["meta"]["ocr_preprocessing"] = preprocessing_meta
            result["ocr"]["meta"]["ocr_block_zoom"] = block_zoom_meta
            result["ocr"]["meta"]["sheet_format_profile"] = sheet_format_profile_meta

        return result

    finally:
        cleanup_temporary_ocr_inputs(block_inputs)

        if ocr_image_path != image_path:
            try:
                if os.path.exists(ocr_image_path):
                    os.unlink(ocr_image_path)
                    log("deleted temporary OCR preprocessed image")
            except Exception as e:
                log(f"could not delete temporary OCR image: {e}")


def process_parse_rows(payload: Dict[str, Any]) -> Dict[str, Any]:
    rows = payload.get("rows") or []
    meta = payload.get("meta") or {}

    if not isinstance(rows, list):
        raise RuntimeError("payload.rows must be a list")
    if not isinstance(meta, dict):
        raise RuntimeError("payload.meta must be an object")

    scoresheet_language = str(
        payload.get("scoresheetLanguage")
        or meta.get("scoresheetLanguage")
        or DEFAULT_SCORESHEET_LANGUAGE
    )
    notation_profile = get_notation_profile(scoresheet_language)

    meta_norm = normalize_meta_from_payload(meta)
    meta_norm["scoresheetLanguage"] = scoresheet_language
    meta_norm["notation_profile"] = notation_profile
    board = chess.Board()

    return parse_rows_stop_on_first_conflict(
        rows=rows,
        meta=meta_norm,
        board=board,
        accepted_prefix_moves=[],
        start_index=0,
        manual_corrections=[],
        profile=notation_profile,
    )


def process_resume(payload: Dict[str, Any]) -> Dict[str, Any]:
    rows = payload.get("rows") or []
    meta = payload.get("meta") or {}
    start_fen = str(payload.get("start_fen") or "").strip()
    start_row = payload.get("start_row")
    start_side = payload.get("start_side")
    corrected_move = str(payload.get("corrected_move") or "").strip()
    accepted_prefix_moves = payload.get("accepted_prefix_moves") or []
    manual_corrections = payload.get("manual_corrections") or []

    if not isinstance(rows, list):
        raise RuntimeError("payload.rows must be a list")
    if not isinstance(meta, dict):
        raise RuntimeError("payload.meta must be an object")
    if not start_fen:
        raise RuntimeError("payload.start_fen missing")
    if start_side not in ("w", "b"):
        raise RuntimeError("payload.start_side must be 'w' or 'b'")
    if corrected_move == "":
        raise RuntimeError("payload.corrected_move missing/invalid")
    if not isinstance(accepted_prefix_moves, list):
        raise RuntimeError("payload.accepted_prefix_moves must be a list")
    if not isinstance(manual_corrections, list):
        raise RuntimeError("payload.manual_corrections must be a list")

    scoresheet_language = str(
        payload.get("scoresheetLanguage")
        or meta.get("scoresheetLanguage")
        or DEFAULT_SCORESHEET_LANGUAGE
    )
    notation_profile = get_notation_profile(scoresheet_language)

    meta_norm = normalize_meta_from_payload(meta)
    meta_norm["scoresheetLanguage"] = scoresheet_language
    meta_norm["notation_profile"] = notation_profile
    seq = flatten_rows(rows)

    try:
        board = chess.Board(start_fen)
    except Exception as e:
        raise RuntimeError(f"Invalid start_fen: {e}")

    ok, chosen, err, cands = try_accept_user_correction(board, corrected_move)

    if not ok or not chosen:
        meta_out = build_meta_out(
            meta_norm, rows, list(accepted_prefix_moves), [], 0, 0
        )

        return {
            "ok": True,
            "pgn": build_pgn(meta_norm, list(accepted_prefix_moves)),
            "error": None,
            "moves": list(accepted_prefix_moves),
            "errors": [
                {
                    "row": start_row,
                    "side": start_side,
                    "raw": corrected_move,
                    "normalized": cands[0] if cands else "",
                    "candidates": cands[:20],
                    "reason": f"corrected_move_invalid: {err}",
                    "fen": start_fen,
                }
            ],
            "meta": meta_out,
            "ocr": {"meta": meta_norm, "rows": rows},
            "stopped_for_review": True,
            "blocked_row": start_row,
            "blocked_side": start_side,
            "raw_token": corrected_move,
            "candidates": cands[:20],
            "fen": start_fen,
        }

    prefix = list(accepted_prefix_moves) + [chosen]

    # IMPORTANTE:
    # Para reanudar, avanzamos desde la celda física OCR corregida
    # (start_row/start_side), no desde el número lógico de jugada.
    # Esto evita romper los saltos de fila: una jugada lógica 78 puede estar
    # escrita físicamente en la fila 79 de la planilla.
    next_index = find_resume_next_index(seq, int(start_row), start_side)

    return parse_rows_stop_on_first_conflict(
        rows=rows,
        meta=meta_norm,
        board=board,
        accepted_prefix_moves=prefix,
        start_index=next_index,
        manual_corrections=manual_corrections,
        profile=notation_profile,
    )


# =========================================================
# Main
# =========================================================


def main() -> None:
    log("starting process_image_gemini.py")

    if len(sys.argv) < 2:
        fail("Usage: process_image_gemini.py <image_path> [payload_json_path]")

    image_path = sys.argv[1]
    payload_path = sys.argv[2] if len(sys.argv) >= 3 else None

    if not os.path.exists(image_path):
        fail(f"Image not found: {image_path}")

    try:
        if payload_path:
            if not os.path.exists(payload_path):
                fail(f"Payload JSON not found: {payload_path}")

            payload = load_json_file(payload_path)
            mode = str(payload.get("mode") or "").strip()

            if mode == "initial":
                sheet_format = str(payload.get("sheetFormat") or DEFAULT_SHEET_FORMAT)
                scoresheet_language = str(
                    payload.get("scoresheetLanguage") or DEFAULT_SCORESHEET_LANGUAGE
                )
                result = process_initial(
                    image_path,
                    sheet_format=sheet_format,
                    scoresheet_language=scoresheet_language,
                )
                jprint(result)
                return

            if mode == "resume":
                result = process_resume(payload)
                jprint(result)
                return

            if mode == "parse_rows":
                result = process_parse_rows(payload)
                jprint(result)
                return

            fail("Unsupported payload mode", {"payload_mode": mode})

        result = process_initial(image_path)
        jprint(result)
    except Exception as e:
        fail(str(e))


if __name__ == "__main__":
    main()
