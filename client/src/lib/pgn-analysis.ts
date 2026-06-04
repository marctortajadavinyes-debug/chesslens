/**
 * pgn-analysis.ts — SF.2
 *
 * Analyses a complete PGN game move-by-move using Stockfish.
 * Always post-PGN: never touches OCR / parser / reviewState / resume.
 *
 * Evaluation convention:
 *   positive  (+) → White is better
 *   negative  (-) → Black is better
 *   Example:  +1.1 = White has ~1.1 pawns of advantage
 *             -1.1 = Black has ~1.1 pawns of advantage
 */

import { Chess } from "chess.js";
import {
  getStockfishWorker,
  MATE_CP,
  type AnalysisLine,
} from "@/lib/stockfish-worker";

// ─── Types ───────────────────────────────────────────────────────────────────

export type { AnalysisLine };

export type MoveQuality =
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MoveAnalysis {
  /** Half-move number (1 = White's 1st move, 2 = Black's 1st move, …) */
  ply: number;
  /** Full move number (1, 2, 3, …) */
  moveNumber: number;
  /** Which side played this move */
  side: "w" | "b";
  /** SAN notation of the move played */
  san: string;
  /** FEN before this move was played */
  fenBefore: string;
  /** FEN after this move was played */
  fenAfter: string;
  /** Engine evaluation of `fenBefore`, White's perspective (cp) */
  evalBeforeCpWhite?: number;
  /** Engine evaluation of `fenAfter`, White's perspective (cp) */
  evalAfterCpWhite?: number;
  /**
   * Centipawn loss relative to the engine's best line.
   * Always ≥ 0.  A loss of 0 means the best move was played.
   * undefined if this is the last move (no `fenAfter` analysis available).
   */
  evalLossCp?: number;
  /** Provisional quality label based on evalLossCp */
  label?: MoveQuality;
  /** Top engine lines from the position BEFORE this move */
  bestLinesBefore: AnalysisLine[];
}

export interface AnalysisOptions {
  depth?: number;
  multiPV?: number;
  /** Called after each position is analysed: progress 0..1 */
  onProgress?: (progress: number) => void;
  /** Set this to abort mid-analysis. Check regularly inside the loop. */
  signal?: { aborted: boolean };
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  /** Number of positions analysed */
  positionsAnalysed: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert an AnalysisLine score to a centipawn value capped at ±MATE_CP. */
function lineToCpWhite(line: AnalysisLine): number {
  if (line.mateWhite !== undefined) {
    return line.mateWhite > 0 ? MATE_CP : -MATE_CP;
  }
  return line.scoreCpWhite ?? 0;
}

function classifyLoss(lossCp: number): MoveQuality {
  if (lossCp <= 20) return "excellent";
  if (lossCp <= 50) return "good";
  if (lossCp <= 100) return "inaccuracy";
  if (lossCp <= 200) return "mistake";
  return "blunder";
}

/**
 * Parse a PGN string and return the list of FENs at each position,
 * plus the moves played (SAN) and side to move.
 * positions[0]   = starting FEN (before move 1)
 * positions[N]   = FEN after the Nth half-move
 */
function parsePgnPositions(pgn: string): {
  fens: string[];
  moves: { san: string; side: "w" | "b" }[];
} {
  const chess = new Chess();

  // loadPgn may throw on invalid PGN
  chess.loadPgn(pgn);

  const history = (chess.history({ verbose: true }) as unknown) as {
    san: string;
    color: "w" | "b";
  }[];

  // Replay from the start to capture FEN at each ply
  const replay = new Chess();
  const fens: string[] = [replay.fen()];
  const moves: { san: string; side: "w" | "b" }[] = [];

  for (const mv of history) {
    moves.push({ san: mv.san, side: mv.color });
    replay.move(mv.san);
    fens.push(replay.fen());
  }

  return { fens, moves };
}

// ─── Main analysis function ───────────────────────────────────────────────────

/**
 * Analyse every position in a PGN game with Stockfish.
 *
 * Strategy:
 *   1. Parse PGN → list of N+1 FENs (positions[0..N]).
 *   2. Analyse each FEN once with MultiPV lines.
 *   3. For each half-move i (1..N):
 *      - bestLinesBefore = analysis of positions[i-1]
 *      - evalBeforeCpWhite = bestLinesBefore[0].scoreCpWhite
 *      - evalAfterCpWhite  = analysis of positions[i] → lines[0].scoreCpWhite
 *      - evalLossCp computed from the side that moved.
 *
 * Total Stockfish calls = N+1 (one per unique position).
 */
export async function analyzePgn(
  pgn: string,
  options: AnalysisOptions = {},
): Promise<GameAnalysis> {
  const { depth = 10, multiPV = 2, onProgress, signal } = options;

  const { fens, moves } = parsePgnPositions(pgn);
  const totalPositions = fens.length; // N+1 positions for N moves

  const sf = getStockfishWorker();
  const positionLines: AnalysisLine[][] = new Array(totalPositions);

  // ── Step 1: analyse every position ──────────────────────────────────────────
  for (let i = 0; i < totalPositions; i++) {
    if (signal?.aborted) break;

    const lines = await sf.analyzePosition(fens[i], { depth, multiPV });
    positionLines[i] = lines;

    onProgress?.((i + 1) / totalPositions);
  }

  // ── Step 2: build MoveAnalysis[] ────────────────────────────────────────────
  const result: MoveAnalysis[] = [];

  for (let i = 0; i < moves.length; i++) {
    if (signal?.aborted) break;

    const ply = i + 1;
    const moveNumber = Math.ceil(ply / 2);
    const { san, side } = moves[i];

    const linesBefore = positionLines[i] ?? [];
    const linesAfter = positionLines[i + 1] ?? [];

    const evalBeforeCpWhite =
      linesBefore.length > 0 ? lineToCpWhite(linesBefore[0]) : undefined;

    const evalAfterCpWhite =
      linesAfter.length > 0 ? lineToCpWhite(linesAfter[0]) : undefined;

    let evalLossCp: number | undefined;
    let label: MoveQuality | undefined;

    if (evalBeforeCpWhite !== undefined && evalAfterCpWhite !== undefined) {
      // White prefers higher scores; Black prefers lower scores.
      // Loss = how much worse the played move was vs. the engine's best.
      const raw =
        side === "w"
          ? evalBeforeCpWhite - evalAfterCpWhite   // White: best was higher, actual is lower
          : evalAfterCpWhite - evalBeforeCpWhite;  // Black: best was lower, actual is higher

      evalLossCp = Math.max(0, raw);
      label = classifyLoss(evalLossCp);
    }

    result.push({
      ply,
      moveNumber,
      side,
      san,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      evalBeforeCpWhite,
      evalAfterCpWhite,
      evalLossCp,
      label,
      bestLinesBefore: linesBefore,
    });
  }

  return {
    moves: result,
    positionsAnalysed: positionLines.filter(Boolean).length,
  };
}
