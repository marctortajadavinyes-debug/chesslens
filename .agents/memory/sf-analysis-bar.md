---
name: SF analysis eval bar orientation
description: How the eval bar flex direction maps to board orientation
---

**Rule:** The eval bar in game-detail.tsx uses `flex-col-reverse` when `boardOrientation === "white"` and `flex-col` when `boardOrientation === "black"`. The white segment always has `height: evalTopPercent%` and the black segment is `flex-1`.

**Why:** With `flex-col-reverse`, the white (first child) appears at the BOTTOM (matching white pieces at the bottom of the board). With `flex-col`, white appears at the TOP.

**How to apply:** `evalTopPercent` = percentage of white advantage (50=equal, 95=white winning). Always the first child (white segment). Direction controls which physical end it occupies.
