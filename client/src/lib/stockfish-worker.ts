/**
 * stockfish-worker.ts — types only
 *
 * The StockfishWorker class and WASM worker have been moved to the backend.
 * This file is kept for shared type definitions used across the frontend.
 * No Worker, no WASM, no client-side engine.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  bestMove: string;
  scoreCp?: number;
  scoreMate?: number;
  depth: number;
  raw: string[];
}

/** One PV line, evaluation always in White's perspective. */
export interface AnalysisLine {
  /** UCI move string of the first move in the principal variation */
  move: string;
  /** Centipawns from White's perspective (+= White advantage, -= Black advantage) */
  scoreCpWhite?: number;
  /** Mate in N from White's perspective (positive = White mates, negative = Black mates) */
  mateWhite?: number;
  /** Full principal variation as UCI moves */
  pv: string[];
  /** Search depth at which this line was found */
  depth: number;
}

export interface AnalyzePositionOptions {
  depth?: number;
  multiPV?: number;
}

/** Centipawn value assigned to a forced mate (for loss calculations). */
export const MATE_CP = 10_000;

/** Extract side to move from a FEN string ('w' or 'b'). */
export function fenSideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/** Normalise a raw engine score (from side-to-move perspective) to White's perspective. */
export function toWhitePerspective(rawCp: number, fen: string): number {
  return fenSideToMove(fen) === "b" ? -rawCp : rawCp;
}
