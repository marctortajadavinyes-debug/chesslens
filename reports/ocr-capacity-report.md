# FotoChess OCR Capacity Report — AUDIT.1

**Generated:** 2026-07-28 11:06 UTC  
**Model:** `gemini-3.5-flash`  
**Total Gemini calls made:** 13/13  

---

## 1. Resources detected

| Resource | Value | Source |
|---|---|---|
| CPU model | INTEL(R) XEON(R) PLATINUM 8581C CPU @ 2.30GHz | `/proc/cpuinfo` |
| CPU cores | 4 | `/proc/cpuinfo` |
| RAM total | 7966 MiB | `/proc/meminfo` |
| RAM available (at test start) | ~5478 MiB | `/proc/meminfo` |
| Swap | 0 MiB | `/proc/meminfo` |
| Deployment target | `autoscale` (Replit) | `.replit` |
| Replica count / autoscale limits | **Not queryable from Workspace** | — |
| Node.js timeout per OCR request | 180 000 ms (3 min) | `server/routes.ts:503` |
| Express body/connection timeout | Not explicitly set | `server/routes.ts` audit |
| Max open files (ulimit) | 83 886 | `ulimit -n` |
| Max processes (ulimit) | 31 855 | `ulimit -u` |

---

## 2. Architecture analysis (code audit, no calls)

### Per-request flow

```
HTTP POST /api/games
  └─ Node.js (single process, express)
       └─ child_process.spawn('python3', [script, imagePath, payloadPath])
             └─ process_image_gemini.py
                   ├─ PIL preprocess (resize, grayscale, autocontrast, contrast, sharpen)
                   ├─ genai.Client.generate_content(inline_data)  ← ONE Gemini call
                   ├─ JSON parse + OCR normalisation
                   └─ python-chess move validation → PGN
```

### Key architectural facts

| Property | Value |
|---|---|
| Python processes per single-sheet OCR | **1** |
| Python processes per N-sheet upload | **N** (sequential — each sheet awaited before next) |
| Block zoom (`CHESSLENS_OCR_BLOCK_ZOOM`) | **0 (disabled)** → 1 Gemini call per sheet |
| Gemini call method | `inline_data` (base64 in request body, no Files API) |
| Thinking budget | **0** (no thinking tokens) |
| Max output tokens | **4 000** |
| Temperature | **0** |
| Concurrency model | Node.js event loop; Python spawned per request; async/await |
| In-memory game store | `Map<id, Game>` — full image base64 kept in RAM until restart |

### Bottleneck analysis

1. **Primary bottleneck: Gemini API latency** — each OCR waits for a full round-trip to the Gemini API (network + model inference). This dominates total request time.
2. **Secondary bottleneck: Python process startup** — each request spawns a fresh `python3` process (~100–200 ms cold start; not measured in isolation here).
3. **Memory pressure**: No TTL on the in-memory game store; images (base64) accumulate until server restart. Under sustained load this will grow unbounded.
4. **No request queue**: Node.js handles concurrent requests transparently; no back-pressure or queue depth limit is implemented.
5. **Multi-sheet is sequential**: A 3-sheet upload makes 3 Gemini calls in series, tripling latency.

---

## 3. Phase 2 — individual call measurements

Calls made (warm-up + 3 individual): **4 successful**

| Metric | Value |
|---|---|
| Min latency | 6.45 s |
| Mean latency | 6.71 s |
| p95 latency | 7.41 s |
| Max latency | 7.41 s |
| Mean tokens in | 1579 |
| Mean tokens out | 1773 |
| Mean tokens total | 3352 |
| Image size | 1530 × 2040 px, 303 KB (JPEG) |
| Preprocessing | enabled (resize if <2200px long side, grayscale, autocontrast, contrast×1.35, sharpen×1.25) |

---

## 4. Phase 3 — concurrency results

| Level | Sent | OK | Failed | Min (s) | Mean (s) | p95 (s) | Max (s) | Tokens in (avg) | Tokens out (avg) | RAM % |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 0 | 6.31 | 6.31 | 6.31 | 6.31 | 1579 | 1773 | 30.4 |
| 2 | 2 | 2 | 0 | 7.02 | 7.9 | 8.78 | 8.78 | 1579 | 1773 | 30.8 |
| 3 | 3 | 3 | 0 | 6.13 | 6.44 | 6.89 | 6.89 | 1579 | 1773 | 31.1 |
| 4(capped@3) | 3 | 3 | 0 | 6.02 | 6.19 | 6.31 | 6.31 | 1579 | 1773 | 31.2 |

---

## 5. Capacity calculations

### 5.1 Server capacity

```
capacity_server_rpm = stable_concurrency × 60 / p95_seconds
                    = 4 × 60 / 6.31
                    = 38.0 RPM
```

### 5.2 Gemini quota capacity

> **PENDING — RPM and TPM limits not yet provided for this project's Google AI Studio account.  Please supply them to complete this calculation.**

Formula (to complete once quota data is provided):
```
capacity_gemini_rpm = min(
    project_rpm_limit,
    floor(project_tpm_limit / 1579)
)
```

### 5.3 Safe recommended capacity

```
capacity_safe = 0.70 × min(server_rpm, gemini_rpm)
             = 0.70 × 38.0  (Gemini limit unknown)
             = 26.6 RPM (server-side ceiling; Gemini limit may be lower)
```
> ⚠ This figure is bounded only by server capacity.  The actual safe limit may be
> lower once Gemini RPM/TPM quota is provided.

---

## 6. Recommendations

| Recommendation | Value |
|---|---|
| Max tested concurrency without errors | 4 simultaneous requests |
| Recommended initial concurrency | 3 simultaneous requests |
| Recommended queue depth | 8 pending requests |
| Server-side RPM ceiling | 38.0 (requires Gemini quota confirmation) |
| Conservative safe RPM | 26.6 (70 % of server ceiling) |

---

## 7. Limitations of this test

- Test run against the **development environment** (single-instance); production autoscale may behave differently.
- Image used (`test_sheet.jpg`, 1530×2040, 303 KB) is a single representative sample; other images may vary in token count.
- Python process startup time is included in measured latency (not isolated).
- Gemini latency can vary with API load at the time of measurement; results are a point-in-time snapshot.
- No Express-level request timeout was found in the codebase; the only timeout is the 180-second Python process kill timer.
- Replit autoscale behaviour, replica count, and horizontal scaling limits are **not observable from the Workspace**.
- In-memory game store accumulates image data indefinitely; sustained load will increase RAM usage over time beyond what this test measured.
- Total calls made: 13 (hard limit: 13).

---

## 8. Data still needed from Google AI Studio

To complete the Gemini quota capacity calculation (section 5.2), please provide:

- **RPM** (Requests Per Minute) allocated to this project / API key
- **TPM** (Tokens Per Minute) allocated to this project / API key
- **Tier** (Free / Paid / Enterprise) — different tiers have different default limits

Once these values are known, the formula in section 5.2 can be evaluated and
section 5.3 updated with the true safe RPM.
