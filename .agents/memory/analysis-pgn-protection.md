---
name: Analysis mode PGN protection
description: How the original PGN is protected when Stockfish analysis is active
---

**Rule:** When `showAnalysis === true`, set `boardInputEnabled = needsReview && !showAnalysis` (always `false`). Pass this as `enableInput` to ChessboardViewer, NOT the raw `needsReview`.

**Why:** When in analysis mode the user navigates to past positions, `isNavigatingPast` becomes true, which makes `needsReview=true`. Without the `&& !showAnalysis` guard, the board becomes interactive and `handleMoveFromBoard` calls `reviewGame.mutateAsync(...)` which POSTs to the server and modifies/replaces the original scanned game — destroying it permanently.

**How to apply:** Any time `canAnalyze && showAnalysis` is true, the board must be read-only. The analysis mode lock is the single source of truth for this check.

**Also:** `handleMoveFromBoard` itself has a guard `if (!game.reviewState?.fen && !isNavigatingPast) return;` — but this is NOT sufficient protection because `isNavigatingPast` is true during analysis navigation. The prop gate is the correct layer.
