---
name: ChessboardViewer external control
description: How to control ChessboardViewer navigation from outside the component
---

**Rule:** To jump to a specific ply from outside ChessboardViewer, use the `jumpSignal?: { index: number; counter: number }` prop. The component tracks `handledJumpRef` to avoid double-firing on re-renders.

**Why:** ChessboardViewer owns `currentMoveIndex` state internally; imperative ref would require forwardRef which is heavier. The signal pattern is minimal and cancel-safe.

**How to apply:** In the parent, `setJumpSignal({ index: targetPly, counter: Date.now() })`. The component fires once per unique counter value.

---

**Rule:** `customArrows?: [string, string, string][]` prop passes analysis arrows from Stockfish PV. Cast to `as any` when passing to `<Chessboard>` due to Square branded type mismatch.
