#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import re
import json
import time

from typing import Any, Dict, List, Optional, Tuple, Set

import chess

from google import genai

T0 = time.time()


def log(msg: str) -> None:
    dt = time.time() - T0
    print(f"[py] +{dt:0.1f}s {msg}", file=sys.stderr, flush=True)


# =========================================================
# Config
# =========================================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

CATALAN_PIECE_MAP = {
    "C": "N",  # Cavall
    "A": "B",  # Alfil
    "T": "R",  # Torre
    "D": "Q",  # Dama
    "R": "K",  # Rei
}

VALID_CATALAN_PIECES = set("CATDR")
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


def guess_mime_type(image_path: str) -> str:
    p = image_path.lower()
    if p.endswith(".png"):
        return "image/png"
    if p.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


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


def call_gemini_rows(image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) env var not set")

    client = genai.Client(api_key=GEMINI_API_KEY)

    prompt = (
        "Strict OCR task for a Catalan chess scoresheet.\n"
        "The scoresheet is handwritten and the move notation is in CATALAN.\n"
        "Return ONLY valid JSON with EXACTLY two top-level keys: headers and rows.\n\n"
        "HEADERS:\n"
        "- headers MUST contain exactly these keys:\n"
        "  Event, Site, Date, Round, White, Black, Result\n"
        "- If unclear, use empty string, but always include the key.\n"
        "- Read ONLY the handwritten top fields.\n"
        "- IMPORTANT: Site must be the handwritten playing site/club if present.\n"
        "- DO NOT use printed federation address as Site.\n\n"
        "ROWS:\n"
        "- The moves table is split into THREE vertical blocks:\n"
        "  Block 1 = moves 1..25 (left)\n"
        "  Block 2 = moves 26..50 (middle)\n"
        "  Block 3 = moves 51..75 (right)\n"
        "- Read blocks STRICTLY in this order: LEFT, then MIDDLE, then RIGHT.\n"
        "- Inside each block, read rows from TOP to BOTTOM.\n"
        "- Each row has move number, white move, black move.\n"
        "- Return rows in final reading order.\n"
        "- For each row return:\n"
        '  {"n": <move_number>, "w": "<exact white cell text>", "b": "<exact black cell text>"}\n'
        "- Read ONLY the handwritten move cell contents.\n"
        "- Keep EXACT OCR text when possible.\n"
        "- Do NOT validate chess legality.\n"
        "- Do NOT normalize notation.\n"
        "- Do NOT translate to English.\n"
        "- Do NOT guess missing moves.\n"
        "- IMPORTANT: If a cell is completely crossed out, heavily scribbled over, empty, or unreadable, return an empty string.\n\n"
        "Return ONLY valid JSON. No markdown. No extra text.\n\n"
        'Schema example: {"headers":{"Event":"","Site":"","Date":"","Round":"","White":"","Black":"","Result":""},"rows":[{"n":1,"w":"","b":""},{"n":2,"w":"","b":""}]}'
    )

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


def build_pgn(meta: Dict[str, Any], moves: List[str]) -> str:
    def esc(x: str) -> str:
        return (x or "").replace('"', '\\"')

    lines = [
        f'[Event "{esc(meta.get("event", ""))}"]',
        f'[Site "{esc(meta.get("site", ""))}"]',
        f'[Date "{esc(meta.get("date", ""))}"]',
        f'[Round "{esc(meta.get("round", ""))}"]',
        f'[White "{esc(meta.get("white", ""))}"]',
        f'[Black "{esc(meta.get("black", ""))}"]',
        f'[Result "{esc(meta.get("result", "*"))}"]',
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
        body = f"{body} {meta.get('result', '*')}".strip()
    else:
        body = meta.get("result", "*")
    lines.append(body)
    return "\n".join(lines).strip()


# =========================================================
# OCR / notation helpers
# =========================================================


def looks_like_noise_cell(s: str) -> bool:
    t = (s or "").strip()
    if not t:
        return True
    tl = t.lower()
    return tl in NOISE_TOKENS


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
        promo = CATALAN_PIECE_MAP.get(promo, promo)
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


# =========================================================
# Validation helpers
# =========================================================


def legal_candidates(
    board: chess.Board, raw: str
) -> Tuple[List[str], List[str], Optional[str]]:
    candidates = candidate_tokens(raw)
    if not candidates:
        return [], [], "empty/filtered"

    legal = []
    last_err = None
    for c in candidates:
        try:
            tmp = board.copy(stack=True)
            tmp.push_san(c)
            legal.append(c)
        except Exception as e:
            last_err = str(e)
    return candidates, legal, last_err


def try_push_san(
    board: chess.Board, raw: str
) -> Tuple[bool, Optional[str], Optional[str], List[str]]:
    candidates, legal, last_err = legal_candidates(board, raw)
    if not candidates:
        return False, None, "empty/filtered", []
    if not legal:
        return False, None, last_err or "invalid", []
    if candidates[0] in legal:
        board.push_san(candidates[0])
        return True, candidates[0], None, legal
    if len(legal) == 1:
        board.push_san(legal[0])
        return True, legal[0], None, legal
    return False, None, "ambiguous_multiple_legal_candidates", legal


def canonicalize_user_move_for_match_variants(token: str) -> List[str]:
    t = clean_spacing(token)
    if not t:
        return []

    variants: List[str] = []

    # Variante 1: tratarlo como SAN ya correcta (lo normal si viene del tablero)
    v1 = normalize_square_case(t)
    v1 = re.sub(r"[+#]+$", "", v1)
    if v1:
        variants.append(v1)

    # Variante 2: tratarlo como entrada catalana y traducirla
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


def row_side_from_ply_index(ply_index: int) -> Tuple[int, str]:
    return (ply_index // 2) + 1, ("w" if ply_index % 2 == 0 else "b")


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


def auto_apply_manual_corrections(
    board: chess.Board,
    accepted_moves: List[str],
    manual_corrections: List[Dict[str, Any]],
) -> Tuple[List[str], Optional[Dict[str, Any]]]:
    applied_moves = list(accepted_moves)

    for item in manual_corrections:
        if not isinstance(item, dict):
            continue

        ply = item.get("ply")
        san = str(item.get("san") or "").strip()

        try:
            ply = int(ply)
        except Exception:
            continue

        if not san:
            continue

        expected_ply = len(applied_moves)

        # Solo reaplicamos correcciones futuras; si no cuadran, paramos
        if ply != expected_ply:
            break

        ok, chosen, err, cands = try_accept_user_correction(board, san)

        if not ok or not chosen:
            row_num, side = row_side_from_ply_index(expected_ply)
            return applied_moves, {
                "row": row_num,
                "side": side,
                "raw": san,
                "normalized": cands[0] if cands else "",
                "candidates": cands[:20],
                "reason": f"stored_manual_correction_invalid: {err}",
                "fen": board.fen(),
            }

        applied_moves.append(chosen)

    return applied_moves, None


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

        ok, chosen, err, cands = try_push_san(board, raw)
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


def process_initial(image_path: str) -> Dict[str, Any]:
    image_bytes = read_image_bytes(image_path)
    mime_type = guess_mime_type(image_path)
    log("calling gemini rows OCR...")
    ocr = call_gemini_rows(image_bytes, mime_type)
    log("gemini returned")
    meta = ocr["meta"]
    rows = ocr["rows"]
    board = chess.Board()

    return parse_rows_stop_on_first_conflict(
        rows=rows,
        meta=meta,
        board=board,
        accepted_prefix_moves=[],
        start_index=0,
        manual_corrections=[],
    )


def process_parse_rows(payload: Dict[str, Any]) -> Dict[str, Any]:
    rows = payload.get("rows") or []
    meta = payload.get("meta") or {}

    if not isinstance(rows, list):
        raise RuntimeError("payload.rows must be a list")
    if not isinstance(meta, dict):
        raise RuntimeError("payload.meta must be an object")

    meta_norm = normalize_meta_from_payload(meta)
    board = chess.Board()

    return parse_rows_stop_on_first_conflict(
        rows=rows,
        meta=meta_norm,
        board=board,
        accepted_prefix_moves=[],
        start_index=0,
        manual_corrections=[],
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

    meta_norm = normalize_meta_from_payload(meta)
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

    last_applied_ply = len(prefix) - 1
    last_row, last_side = row_side_from_ply_index(last_applied_ply)
    next_index = find_resume_next_index(seq, last_row, last_side)

    return parse_rows_stop_on_first_conflict(
        rows=rows,
        meta=meta_norm,
        board=board,
        accepted_prefix_moves=prefix,
        start_index=next_index,
        manual_corrections=manual_corrections,
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
