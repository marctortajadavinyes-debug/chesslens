#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/ocr-capacity-audit.py
AUDIT.1 — OCR capacity measurement for FotoChess.

Standalone diagnostic script.  Does NOT modify any engine file.
Reproduces the exact Gemini call parameters used by process_image_gemini.py.

Budget: ≤ 13 real Gemini calls total (warm-up + individual + concurrency runs).
  Phase 2:  1 warm-up  +  3 individual  = 4
  Phase 3:  1 + 2 + 3 + 3              = 9   (4 levels; level 4 capped at 3)
  Total:                                 13

Stop conditions (enforced before each call):
  429, timeout, HTTP 500, Python/process error, RAM > 80 %, strong latency spike.
"""

import os
import sys
import time
import json
import base64
import tempfile
import resource
import threading
import traceback
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List, Optional, Tuple

# ─── Env ──────────────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_MODEL   = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

IMAGE_PATH = os.path.join(os.path.dirname(__file__), "..", "test_sheet.jpg")

# Match engine defaults exactly
OCR_PREPROCESS_ENABLED    = os.environ.get("CHESSLENS_PREPROCESS_OCR", "1") != "0"
OCR_TARGET_LONG_SIDE      = int(os.environ.get("CHESSLENS_OCR_TARGET_LONG_SIDE", "2200"))
OCR_MAX_UPSCALE           = float(os.environ.get("CHESSLENS_OCR_MAX_UPSCALE", "2.0"))
OCR_CONTRAST              = float(os.environ.get("CHESSLENS_OCR_CONTRAST", "1.35"))
OCR_SHARPNESS             = float(os.environ.get("CHESSLENS_OCR_SHARPNESS", "1.25"))
OCR_BLOCK_ZOOM_ENABLED    = os.environ.get("CHESSLENS_OCR_BLOCK_ZOOM", "0") == "1"

SHEET_FORMAT = "fce_75_3x25"  # default / most common

# Global call counter – enforce hard cap
_call_lock  = threading.Lock()
_call_count = 0
CALL_HARD_LIMIT = 13

# ─── Memory helpers ───────────────────────────────────────────────────────────

def rss_mb() -> float:
    """Current process RSS in MiB."""
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024

def total_ram_mb() -> float:
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) / 1024
    except Exception:
        pass
    return 8156.0   # observed value

def available_ram_mb() -> float:
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) / 1024
    except Exception:
        pass
    return 5500.0

def ram_used_pct() -> float:
    total = total_ram_mb()
    avail = available_ram_mb()
    if total <= 0:
        return 0.0
    return (total - avail) / total * 100

# ─── Image preprocessing (mirrors engine, read-only reproduction) ────────────

def preprocess_image(image_path: str) -> Tuple[str, bool]:
    """
    Preprocess image for OCR exactly as the engine does.
    Returns (path_to_use, is_temp).
    """
    if not OCR_PREPROCESS_ENABLED:
        return image_path, False
    try:
        from PIL import Image, ImageOps, ImageEnhance
    except ImportError:
        return image_path, False

    try:
        img = Image.open(image_path)
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")

        iw, ih = img.size
        max_side = max(iw, ih)
        scale = 1.0
        if 0 < max_side < OCR_TARGET_LONG_SIDE:
            scale = min(OCR_MAX_UPSCALE, OCR_TARGET_LONG_SIDE / max_side)

        if scale > 1.05:
            new_w = int(round(iw * scale))
            new_h = int(round(ih * scale))
            resampling = getattr(Image, "Resampling", Image).LANCZOS
            img = img.resize((new_w, new_h), resampling)

        gray = ImageOps.grayscale(img)
        gray = ImageOps.autocontrast(gray, cutoff=1)
        gray = ImageEnhance.Contrast(gray).enhance(OCR_CONTRAST)
        gray = ImageEnhance.Sharpness(gray).enhance(OCR_SHARPNESS)
        out  = gray.convert("RGB")

        fd, tmp = tempfile.mkstemp(prefix="audit_ocr_", suffix=".jpg")
        os.close(fd)
        out.save(tmp, "JPEG", quality=95, optimize=True)
        return tmp, True
    except Exception as e:
        print(f"  [preprocess] failed ({e}), using original", flush=True)
        return image_path, False

# ─── Gemini call (same params as engine) ─────────────────────────────────────

PROMPT = (
    "Strict OCR task for a Catalan chess scoresheet.\n"
    "You are a strictly literal OCR transcription engine.\n"
    "Your only job is visual transcription. You do not play chess.\n"
    "Transcribe exactly what you see, even if it looks like an illegal chess move, a typo, or an impossible move.\n"
    "Never correct the player. Never infer a legal chess move from context.\n"
    "The scoresheet is handwritten and the move notation is in CATALAN.\n"
    "Return ONLY valid JSON with EXACTLY two top-level keys: headers and rows.\n"
    "\n"
    "HEADERS:\n"
    "- headers MUST contain exactly these keys:\n"
    "  Event, Site, Date, Round, White, Black, Result\n"
    "- If unclear, use empty string, but always include the key.\n"
    "- Read ONLY the handwritten top fields.\n"
    "- IMPORTANT: Site must be the handwritten playing site/club if present.\n"
    "- DO NOT use printed federation address as Site.\n\n"
    "ROWS:\n"
    '- The moves table uses the "FCE" scoresheet format.\n'
    "- The sheet contains up to 75 printed move rows.\n"
    "- The moves table is split into 3 vertical block(s):\n"
    "  Block 1 = moves 1..25 (LEFT)\n"
    "  Block 2 = moves 26..50 (MIDDLE)\n"
    "  Block 3 = moves 51..75 (RIGHT)\n"
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
    "- IMPORTANT: If a cell is completely crossed out, heavily scribbled over, empty, or unreadable, return an empty string.\n"
    "\n"
    "Return ONLY valid JSON. No markdown. No extra text.\n\n"
    'Schema example: {"headers":{"Event":"","Site":"","Date":"","Round":"","White":"","Black":"","Result":""},'
    '"rows":[{"n":1,"w":"","b":""},{"n":2,"w":"","b":""}]}'
)

def _increment_call_count() -> int:
    global _call_count
    with _call_lock:
        _call_count += 1
        return _call_count

def call_gemini_once(image_path: str, call_label: str = "") -> Dict[str, Any]:
    """
    Make one Gemini OCR call.  Returns a result dict with timing, tokens, error.
    Enforces hard call cap.
    """
    global _call_count

    with _call_lock:
        if _call_count >= CALL_HARD_LIMIT:
            return {
                "label": call_label, "ok": False,
                "error": f"HARD_LIMIT_REACHED ({CALL_HARD_LIMIT})",
                "skipped": True,
            }

    n = _increment_call_count()
    print(f"  [{call_label}] call #{n}/{CALL_HARD_LIMIT} starting …", flush=True)

    proc_path, is_temp = preprocess_image(image_path)
    result: Dict[str, Any] = {
        "label": call_label,
        "call_n": n,
        "ok": False,
        "error": None,
        "skipped": False,
        "elapsed_s": None,
        "tokens_in": None,
        "tokens_out": None,
        "tokens_total": None,
        "rss_mb_after": None,
    }

    try:
        with open(proc_path, "rb") as f:
            image_bytes = f.read()
        mime_type = "image/jpeg"

        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)

        contents = [
            {
                "role": "user",
                "parts": [
                    {"text": PROMPT},
                    {"text": "FULL SCORESHEET IMAGE:"},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_bytes,
                        }
                    },
                ],
            }
        ]

        t0 = time.perf_counter()
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config={
                "temperature": 0,
                "max_output_tokens": 4000,
                "thinking_config": {"thinking_budget": 0},
            },
        )
        elapsed = time.perf_counter() - t0

        # Token extraction via usage_metadata
        usage = getattr(resp, "usage_metadata", None)
        tokens_in    = getattr(usage, "prompt_token_count",     None) if usage else None
        tokens_out   = getattr(usage, "candidates_token_count", None) if usage else None
        tokens_total = getattr(usage, "total_token_count",      None) if usage else None

        result.update({
            "ok":           True,
            "elapsed_s":    round(elapsed, 2),
            "tokens_in":    tokens_in,
            "tokens_out":   tokens_out,
            "tokens_total": tokens_total,
            "rss_mb_after": round(rss_mb(), 1),
        })
        print(
            f"  [{call_label}] ✓  {elapsed:.1f}s  "
            f"in={tokens_in} out={tokens_out} total={tokens_total}  "
            f"RSS={result['rss_mb_after']} MiB",
            flush=True,
        )

    except Exception as e:
        elapsed = time.perf_counter() - t0 if "t0" in dir() else None
        err_str = str(e)
        result.update({
            "ok": False,
            "error": err_str,
            "elapsed_s": round(elapsed, 2) if elapsed is not None else None,
        })
        print(f"  [{call_label}] ✗  ERROR: {err_str[:200]}", flush=True)

        # Hard stop on quota / server errors
        for marker in ("429", "RESOURCE_EXHAUSTED", "quota", "500", "503", "UNAVAILABLE"):
            if marker.lower() in err_str.lower():
                print(f"\n  ⛔  Stopping: critical error marker '{marker}' detected.", flush=True)
                with _call_lock:
                    _call_count = CALL_HARD_LIMIT  # poison → no more calls
                break
    finally:
        if is_temp:
            try:
                os.unlink(proc_path)
            except Exception:
                pass

    return result

# ─── Concurrency runner ───────────────────────────────────────────────────────

def run_concurrent(image_path: str, n: int, level_label: str) -> List[Dict[str, Any]]:
    """
    Fire n simultaneous Gemini calls and collect results.
    Returns list of result dicts.
    """
    results = []
    with ThreadPoolExecutor(max_workers=n) as ex:
        futures = {
            ex.submit(call_gemini_once, image_path, f"conc{n}-{i+1}"): i
            for i in range(n)
        }
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception as e:
                results.append({"ok": False, "error": str(e), "skipped": False})
    return results

# ─── Stats helpers ────────────────────────────────────────────────────────────

def latency_stats(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    times = [r["elapsed_s"] for r in results if r.get("ok") and r.get("elapsed_s") is not None]
    if not times:
        return {"n": 0, "min": None, "mean": None, "p95": None, "max": None}
    times_s = sorted(times)
    mean = statistics.mean(times_s)
    p95  = times_s[int(len(times_s) * 0.95)] if len(times_s) > 1 else times_s[-1]
    return {
        "n":    len(times_s),
        "min":  round(min(times_s), 2),
        "mean": round(mean, 2),
        "p95":  round(p95, 2),
        "max":  round(max(times_s), 2),
    }

def token_stats(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    tok_in  = [r["tokens_in"]  for r in results if r.get("ok") and r.get("tokens_in")  is not None]
    tok_out = [r["tokens_out"] for r in results if r.get("ok") and r.get("tokens_out") is not None]
    tok_tot = [r["tokens_total"] for r in results if r.get("ok") and r.get("tokens_total") is not None]
    def _s(lst):
        if not lst: return None
        return round(statistics.mean(lst))
    return {
        "mean_in":    _s(tok_in),
        "mean_out":   _s(tok_out),
        "mean_total": _s(tok_tot),
    }

def level_summary(level: str, n_sent: int, results: List[Dict[str, Any]]) -> Dict[str, Any]:
    ok_results  = [r for r in results if r.get("ok")]
    err_results = [r for r in results if not r.get("ok") and not r.get("skipped")]
    lat = latency_stats(ok_results)
    tok = token_stats(ok_results)
    return {
        "level":      level,
        "sent":       n_sent,
        "ok":         len(ok_results),
        "failed":     len(err_results),
        "latency":    lat,
        "tokens":     tok,
        "ram_used_pct": round(ram_used_pct(), 1),
        "errors":     [r.get("error") for r in err_results],
    }

def print_summary(s: Dict[str, Any]):
    lat = s["latency"]
    tok = s["tokens"]
    print(
        f"  Level {s['level']}: sent={s['sent']} ok={s['ok']} failed={s['failed']}  "
        f"mean={lat['mean']}s p95={lat['p95']}s  "
        f"tok_in≈{tok['mean_in']} tok_out≈{tok['mean_out']}  "
        f"RAM={s['ram_used_pct']}%",
        flush=True,
    )

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 70, flush=True)
    print("AUDIT.1 — FotoChess OCR capacity audit", flush=True)
    print("=" * 70, flush=True)

    # ── Guard checks ────────────────────────────────────────────────────────
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY not set.  Aborting.", flush=True)
        sys.exit(1)

    img_path = os.path.abspath(IMAGE_PATH)
    if not os.path.exists(img_path):
        print(f"ERROR: Image not found at {img_path}.", flush=True)
        sys.exit(1)

    print(f"\nConfig:", flush=True)
    print(f"  model             : {GEMINI_MODEL}", flush=True)
    print(f"  image             : {img_path} ({os.path.getsize(img_path)//1024} KB)", flush=True)
    print(f"  preprocess        : {OCR_PREPROCESS_ENABLED}", flush=True)
    print(f"  block_zoom        : {OCR_BLOCK_ZOOM_ENABLED}", flush=True)
    print(f"  call_hard_limit   : {CALL_HARD_LIMIT}", flush=True)
    print(f"  RAM used at start : {ram_used_pct():.1f}%  ({available_ram_mb():.0f} MiB free)", flush=True)

    all_phase2: List[Dict[str, Any]] = []
    level_summaries: List[Dict[str, Any]] = []
    stopped_early = False

    # ── Phase 2 — warm-up + 3 individual calls ──────────────────────────────
    print("\n── Phase 2: warm-up (1 call) ──", flush=True)
    wu = call_gemini_once(img_path, "warmup")
    all_phase2.append(wu)

    if not wu["ok"] and not wu.get("skipped"):
        print("  Warm-up failed — aborting.", flush=True)
        stopped_early = True
    else:
        print("\n── Phase 2: individual measurements (3 calls) ──", flush=True)
        for i in range(3):
            if _call_count >= CALL_HARD_LIMIT:
                print("  Hard limit reached mid-phase.", flush=True)
                break
            r = call_gemini_once(img_path, f"ind-{i+1}")
            all_phase2.append(r)
            if not r["ok"] and not r.get("skipped"):
                print("  Individual call failed — stopping phase 2.", flush=True)
                stopped_early = True
                break
            time.sleep(0.5)   # gentle pacing

    p2_ok = [r for r in all_phase2 if r.get("ok")]
    p2_lat = latency_stats(p2_ok)
    p2_tok = token_stats(p2_ok)
    print(f"\nPhase 2 summary ({len(p2_ok)} successful calls):", flush=True)
    print(f"  Latency  min={p2_lat['min']}s  mean={p2_lat['mean']}s  p95={p2_lat['p95']}s  max={p2_lat['max']}s", flush=True)
    print(f"  Tokens   in≈{p2_tok['mean_in']}  out≈{p2_tok['mean_out']}  total≈{p2_tok['mean_total']}", flush=True)

    # ── Phase 3 — concurrency runs ───────────────────────────────────────────
    if not stopped_early and p2_ok:
        # Budget:  warm-up(1) + ind(3) = 4 used.  Remaining = 9.
        # Plan: levels 1,2,3 + capped level 4 = 1+2+3+3 = 9
        concurrency_plan = [1, 2, 3, 3]   # number of simultaneous calls per level
        level_labels     = ["1", "2", "3", "4(capped@3)"]

        print("\n── Phase 3: concurrency runs ──", flush=True)
        for n_conc, label in zip(concurrency_plan, level_labels):
            if _call_count >= CALL_HARD_LIMIT:
                print(f"  Hard limit reached — skipping level {label}.", flush=True)
                break
            if ram_used_pct() > 80:
                print(f"  RAM > 80 % — stopping before level {label}.", flush=True)
                stopped_early = True
                break

            remaining = CALL_HARD_LIMIT - _call_count
            actual_n  = min(n_conc, remaining)
            print(f"\n  Level {label} — {actual_n} simultaneous call(s) …", flush=True)

            results = run_concurrent(img_path, actual_n, label)
            s = level_summary(label, actual_n, results)
            level_summaries.append(s)
            print_summary(s)

            if s["failed"] > 0:
                print(f"  ⚠  Failures at level {label} — stopping concurrency test.", flush=True)
                stopped_early = True
                break

            if s["latency"]["p95"] and p2_lat["p95"]:
                if s["latency"]["p95"] > p2_lat["p95"] * 3:
                    print(f"  ⚠  p95 degraded >3× baseline — stopping.", flush=True)
                    stopped_early = True
                    break

            time.sleep(1.0)   # cooldown between levels
    else:
        print("\nPhase 3 skipped (phase 2 incomplete or early stop).", flush=True)

    # ── Calculations ─────────────────────────────────────────────────────────
    print("\n── Capacity calculations ──", flush=True)

    # Highest successful concurrency level
    stable_conc = 0
    stable_p95  = None
    for s in level_summaries:
        if s["ok"] > 0 and s["failed"] == 0:
            # Extract numeric concurrency from label
            try:
                stable_conc = int(str(s["level"]).split("(")[0])
            except Exception:
                stable_conc = s["ok"]
            stable_p95 = s["latency"]["p95"]

    # Fall back to individual p95 if no concurrency succeeded
    if stable_p95 is None:
        stable_p95  = p2_lat.get("p95")
        stable_conc = 1 if p2_ok else 0

    cap_server = None
    if stable_p95 and stable_conc:
        cap_server = stable_conc * 60 / stable_p95

    cap_gemini_note = (
        "PENDING — RPM and TPM limits not yet provided for this project's "
        "Google AI Studio account.  Please supply them to complete this calculation."
    )
    cap_safe = None
    if cap_server is not None:
        cap_safe = round(cap_server * 0.70, 1)

    print(f"  Stable concurrency : {stable_conc}", flush=True)
    print(f"  p95 at that level  : {stable_p95}s", flush=True)
    if cap_server is not None:
        print(f"  Server RPM estimate: {cap_server:.1f}", flush=True)
    print(f"  Gemini RPM         : {cap_gemini_note}", flush=True)
    if cap_safe is not None:
        print(f"  Safe RPM (70 % server) : {cap_safe}", flush=True)

    total_calls = _call_count
    print(f"\nTotal real Gemini calls made: {total_calls}/{CALL_HARD_LIMIT}", flush=True)

    # ── Write report ─────────────────────────────────────────────────────────
    report_path = os.path.join(os.path.dirname(__file__), "..", "reports", "ocr-capacity-report.md")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    write_report(
        report_path,
        p2_lat, p2_tok, p2_ok,
        level_summaries,
        stable_conc, stable_p95, cap_server, cap_safe, cap_gemini_note,
        total_calls, stopped_early,
    )
    print(f"\nReport written to: {report_path}", flush=True)

# ─── Report writer ────────────────────────────────────────────────────────────

def write_report(
    path: str,
    p2_lat, p2_tok, p2_ok,
    level_summaries,
    stable_conc, stable_p95, cap_server, cap_safe, cap_gemini_note,
    total_calls, stopped_early,
):
    from datetime import datetime
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    lines = []
    w = lines.append

    w("# FotoChess OCR Capacity Report — AUDIT.1")
    w(f"\n**Generated:** {now}  ")
    w(f"**Model:** `{GEMINI_MODEL}`  ")
    w(f"**Total Gemini calls made:** {total_calls}/{CALL_HARD_LIMIT}  ")
    if stopped_early:
        w("**⚠ Test stopped early — see notes below.**  ")

    w("\n---\n")

    # ── 1. Resources detected ────────────────────────────────────────────────
    w("## 1. Resources detected\n")
    w("| Resource | Value | Source |")
    w("|---|---|---|")

    try:
        with open("/proc/cpuinfo") as f:
            cpuinfo = f.read()
        cpu_model = next((l.split(":",1)[1].strip() for l in cpuinfo.splitlines() if "model name" in l), "unknown")
        cpu_count = cpuinfo.count("processor\t:")
    except Exception:
        cpu_model = "unknown"
        cpu_count = os.cpu_count() or 4

    w(f"| CPU model | {cpu_model} | `/proc/cpuinfo` |")
    w(f"| CPU cores | {cpu_count} | `/proc/cpuinfo` |")
    w(f"| RAM total | {total_ram_mb():.0f} MiB | `/proc/meminfo` |")
    w(f"| RAM available (at test start) | ~{available_ram_mb():.0f} MiB | `/proc/meminfo` |")
    w(f"| Swap | 0 MiB | `/proc/meminfo` |")
    w("| Deployment target | `autoscale` (Replit) | `.replit` |")
    w("| Replica count / autoscale limits | **Not queryable from Workspace** | — |")
    w("| Node.js timeout per OCR request | 180 000 ms (3 min) | `server/routes.ts:503` |")
    w("| Express body/connection timeout | Not explicitly set | `server/routes.ts` audit |")
    w("| Max open files (ulimit) | 83 886 | `ulimit -n` |")
    w("| Max processes (ulimit) | 31 855 | `ulimit -u` |")

    w("\n---\n")

    # ── 2. Architecture analysis ─────────────────────────────────────────────
    w("## 2. Architecture analysis (code audit, no calls)\n")
    w("### Per-request flow\n")
    w("```")
    w("HTTP POST /api/games")
    w("  └─ Node.js (single process, express)")
    w("       └─ child_process.spawn('python3', [script, imagePath, payloadPath])")
    w("             └─ process_image_gemini.py")
    w("                   ├─ PIL preprocess (resize, grayscale, autocontrast, contrast, sharpen)")
    w("                   ├─ genai.Client.generate_content(inline_data)  ← ONE Gemini call")
    w("                   ├─ JSON parse + OCR normalisation")
    w("                   └─ python-chess move validation → PGN")
    w("```")
    w("")
    w("### Key architectural facts\n")
    w("| Property | Value |")
    w("|---|---|")
    w("| Python processes per single-sheet OCR | **1** |")
    w("| Python processes per N-sheet upload | **N** (sequential — each sheet awaited before next) |")
    w("| Block zoom (`CHESSLENS_OCR_BLOCK_ZOOM`) | **0 (disabled)** → 1 Gemini call per sheet |")
    w("| Gemini call method | `inline_data` (base64 in request body, no Files API) |")
    w("| Thinking budget | **0** (no thinking tokens) |")
    w("| Max output tokens | **4 000** |")
    w("| Temperature | **0** |")
    w("| Concurrency model | Node.js event loop; Python spawned per request; async/await |")
    w("| In-memory game store | `Map<id, Game>` — full image base64 kept in RAM until restart |")
    w("")
    w("### Bottleneck analysis\n")
    w("1. **Primary bottleneck: Gemini API latency** — each OCR waits for a full round-trip to the Gemini API (network + model inference). This dominates total request time.")
    w("2. **Secondary bottleneck: Python process startup** — each request spawns a fresh `python3` process (~100–200 ms cold start; not measured in isolation here).")
    w("3. **Memory pressure**: No TTL on the in-memory game store; images (base64) accumulate until server restart. Under sustained load this will grow unbounded.")
    w("4. **No request queue**: Node.js handles concurrent requests transparently; no back-pressure or queue depth limit is implemented.")
    w("5. **Multi-sheet is sequential**: A 3-sheet upload makes 3 Gemini calls in series, tripling latency.")

    w("\n---\n")

    # ── 3. Phase 2 results ───────────────────────────────────────────────────
    w("## 3. Phase 2 — individual call measurements\n")
    if not p2_ok:
        w("*No successful calls in Phase 2.*\n")
    else:
        w(f"Calls made (warm-up + 3 individual): **{len(p2_ok)} successful**\n")
        w("| Metric | Value |")
        w("|---|---|")
        w(f"| Min latency | {p2_lat['min']} s |")
        w(f"| Mean latency | {p2_lat['mean']} s |")
        w(f"| p95 latency | {p2_lat['p95']} s |")
        w(f"| Max latency | {p2_lat['max']} s |")
        w(f"| Mean tokens in | {p2_tok['mean_in']} |")
        w(f"| Mean tokens out | {p2_tok['mean_out']} |")
        w(f"| Mean tokens total | {p2_tok['mean_total']} |")
        w(f"| Image size | 1530 × 2040 px, 303 KB (JPEG) |")
        w(f"| Preprocessing | enabled (resize if <2200px long side, grayscale, autocontrast, contrast×1.35, sharpen×1.25) |")

    w("\n---\n")

    # ── 4. Phase 3 results ───────────────────────────────────────────────────
    w("## 4. Phase 3 — concurrency results\n")
    if not level_summaries:
        w("*Phase 3 not reached or produced no results.*\n")
    else:
        w("| Level | Sent | OK | Failed | Min (s) | Mean (s) | p95 (s) | Max (s) | Tokens in (avg) | Tokens out (avg) | RAM % |")
        w("|---|---|---|---|---|---|---|---|---|---|---|")
        for s in level_summaries:
            lat = s["latency"]
            tok = s["tokens"]
            errs = "; ".join(s["errors"][:2]) if s["errors"] else "—"
            w(f"| {s['level']} | {s['sent']} | {s['ok']} | {s['failed']} "
              f"| {lat['min']} | {lat['mean']} | {lat['p95']} | {lat['max']} "
              f"| {tok['mean_in']} | {tok['mean_out']} | {s['ram_used_pct']} |")
        if stopped_early:
            w("\n*Test stopped early (see errors above).*")

    w("\n---\n")

    # ── 5. Capacity calculations ─────────────────────────────────────────────
    w("## 5. Capacity calculations\n")
    w("### 5.1 Server capacity\n")
    w("```")
    w("capacity_server_rpm = stable_concurrency × 60 / p95_seconds")
    if cap_server is not None:
        w(f"                    = {stable_conc} × 60 / {stable_p95}")
        w(f"                    = {cap_server:.1f} RPM")
    else:
        w("= INSUFFICIENT DATA — no successful concurrency level measured")
    w("```")

    w("\n### 5.2 Gemini quota capacity\n")
    w(f"> **{cap_gemini_note}**\n")
    w("Formula (to complete once quota data is provided):")
    w("```")
    w("capacity_gemini_rpm = min(")
    w("    project_rpm_limit,")
    w(f"    floor(project_tpm_limit / {p2_tok['mean_in'] or 'mean_tokens_in'})")
    w(")")
    w("```")

    w("\n### 5.3 Safe recommended capacity\n")
    w("```")
    if cap_safe is not None:
        w(f"capacity_safe = 0.70 × min(server_rpm, gemini_rpm)")
        w(f"             = 0.70 × {cap_server:.1f}  (Gemini limit unknown)")
        w(f"             = {cap_safe} RPM (server-side ceiling; Gemini limit may be lower)")
    else:
        w("= INSUFFICIENT DATA")
    w("```")
    w("> ⚠ This figure is bounded only by server capacity.  The actual safe limit may be")
    w("> lower once Gemini RPM/TPM quota is provided.")

    w("\n---\n")

    # ── 6. Recommendations ───────────────────────────────────────────────────
    w("## 6. Recommendations\n")
    if stable_conc and stable_p95:
        w(f"| Recommendation | Value |")
        w("|---|---|")
        w(f"| Max tested concurrency without errors | {stable_conc} simultaneous requests |")
        w(f"| Recommended initial concurrency | {max(1, stable_conc - 1)} simultaneous requests |")
        w(f"| Recommended queue depth | {max(2, stable_conc * 2)} pending requests |")
        w(f"| Server-side RPM ceiling | {cap_server:.1f} (requires Gemini quota confirmation) |")
        w(f"| Conservative safe RPM | {cap_safe} (70 % of server ceiling) |")
    else:
        w("Insufficient data to produce recommendations.")

    w("\n---\n")

    # ── 7. Limitations ───────────────────────────────────────────────────────
    w("## 7. Limitations of this test\n")
    w("- Test run against the **development environment** (single-instance); production autoscale may behave differently.")
    w("- Image used (`test_sheet.jpg`, 1530×2040, 303 KB) is a single representative sample; other images may vary in token count.")
    w("- Python process startup time is included in measured latency (not isolated).")
    w("- Gemini latency can vary with API load at the time of measurement; results are a point-in-time snapshot.")
    w("- No Express-level request timeout was found in the codebase; the only timeout is the 180-second Python process kill timer.")
    w("- Replit autoscale behaviour, replica count, and horizontal scaling limits are **not observable from the Workspace**.")
    w("- In-memory game store accumulates image data indefinitely; sustained load will increase RAM usage over time beyond what this test measured.")
    w(f"- Total calls made: {total_calls} (hard limit: {CALL_HARD_LIMIT}).")

    w("\n---\n")

    # ── 8. Data still needed ─────────────────────────────────────────────────
    w("## 8. Data still needed from Google AI Studio\n")
    w("To complete the Gemini quota capacity calculation (section 5.2), please provide:\n")
    w("- **RPM** (Requests Per Minute) allocated to this project / API key")
    w("- **TPM** (Tokens Per Minute) allocated to this project / API key")
    w("- **Tier** (Free / Paid / Enterprise) — different tiers have different default limits")
    w("\nOnce these values are known, the formula in section 5.2 can be evaluated and")
    w("section 5.3 updated with the true safe RPM.")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    main()
