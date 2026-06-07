---
name: chess.js v1 quirks
description: Gotchas specific to chess.js v1.x in this codebase
---

**Rule:** `chess.load(fen)` returns `void` (not boolean) in chess.js v1.x. Do NOT test its return value for truthiness — TypeScript error TS1345.

**Why:** v0.x returned boolean success, v1.x changed to void.

**How to apply:** Call `chess.load(fen)` without testing the result; wrap in try/catch instead.

---

**Rule:** `react-chessboard` `customArrows` prop expects `Arrow[]` where Arrow uses the `Square` branded type, not plain `string`. Passing `[string, string, string][]` causes TS2322. Cast with `as any` at the call site.

**Why:** react-chessboard's type system uses a `Square` branded type for board squares.

**How to apply:** In ChessboardViewer, `customArrows={(customArrows ?? []) as any}`.
