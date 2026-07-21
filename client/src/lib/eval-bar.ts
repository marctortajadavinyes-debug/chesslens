/**
 * eval-bar.ts — shared visual scale for the Stockfish evaluation bar.
 *
 * Used by game-detail.tsx and drive-game-viewer.tsx.
 * Pure functions — no React, no side effects.
 */

/**
 * Convert a centipawn / mate evaluation (White's perspective) to a percentage
 * of the bar that should be "White".
 *
 * Scale anchor points (symmetric for negative values):
 *   0 cp  → 50 %     ±140 cp → 62.5 / 37.5 %
 *   ±300 cp → 75 / 25 %     ±500 cp → 87.5 / 12.5 %
 *   |cp| > 500 → smoothed asymptote toward 96 / 4 %
 *
 * Mate: 100 % (White mates) or 0 % (Black mates).
 * Non-mate result is clamped to [4, 96].
 */
export function evalToWhitePercent(
  scoreCpWhite?: number,
  mateWhite?: number,
): number {
  if (mateWhite !== undefined) return mateWhite > 0 ? 100 : 0;
  if (scoreCpWhite === undefined) return 50;

  const absCp = Math.abs(scoreCpWhite);
  const sign = scoreCpWhite >= 0 ? 1 : -1;

  let half: number;
  if (absCp <= 140) {
    half = (absCp / 140) * 12.5;
  } else if (absCp <= 300) {
    half = 12.5 + ((absCp - 140) / 160) * 12.5;
  } else if (absCp <= 500) {
    half = 25 + ((absCp - 300) / 200) * 12.5;
  } else {
    const excess = absCp - 500;
    const smoothing = 220;
    half = 37.5 + 8.5 * (1 - smoothing / (excess + smoothing));
  }

  return Math.max(4, Math.min(96, 50 + sign * half));
}
