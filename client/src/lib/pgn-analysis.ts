/**
 * pgn-analysis.ts — SF.2 (server-side)
 *
 * Analyses a complete PGN game move-by-move via /api/analysis/position.
 * The browser never loads Stockfish WASM/JS.
 * Always post-PGN: never touches OCR / parser / reviewState / resume.
 *
 * Evaluation convention:
 *   positive  (+) → White is better
 *   negative  (-) → Black is better
 */

import { Chess } from "chess.js";
import { MATE_CP, type AnalysisLine } from "@/lib/stockfish-worker";

// ─── Types ───────────────────────────────────────────────────────────────────

export type { AnalysisLine };

export type MoveQuality =
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MoveAnalysis {
  ply: number;
  moveNumber: number;
  side: "w" | "b";
  san: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCpWhite?: number;
  evalAfterCpWhite?: number;
  evalLossCp?: number;
  label?: MoveQuality;
  bestLinesBefore: AnalysisLine[];
}

export interface AnalysisOptions {
  depth?: number;
  multiPV?: number;
  onProgress?: (progress: number) => void;
  signal?: { aborted: boolean };
}

export interface GameAnalysis {
  moves: MoveAnalysis[];
  positionsAnalysed: number;
  finalPositionLines: AnalysisLine[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function parsePgnPositions(pgn: string): {
  fens: string[];
  moves: { san: string; side: "w" | "b" }[];
} {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = (chess.history({ verbose: true }) as unknown) as {
    san: string;
    color: "w" | "b";
  }[];

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

// ─── Backend fetch helper ─────────────────────────────────────────────────────

async function fetchAnalysis(
  fen: string,
  depth: number,
  multiPV: number,
): Promise<AnalysisLine[]> {
  const resp = await fetch("/api/analysis/position", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fen, depth, multipv: multiPV }),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error ?? "Analysis failed");

  return (data.lines ?? []).map((l: {
    uci: string;
    evalCpWhite?: number;
    mateWhite?: number;
    pvUci: string[];
    depth: number;
  }) => ({
    move: l.uci,
    scoreCpWhite: l.evalCpWhite,
    mateWhite: l.mateWhite,
    pv: l.pvUci,
    depth: l.depth,
  }));
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzePgn(
  pgn: string,
  options: AnalysisOptions = {},
): Promise<GameAnalysis> {
  const { depth = 10, multiPV = 2, onProgress, signal } = options;

  const { fens, moves } = parsePgnPositions(pgn);
  const totalPositions = fens.length;

  const positionLines: AnalysisLine[][] = new Array(totalPositions);

  for (let i = 0; i < totalPositions; i++) {
    if (signal?.aborted) break;

    const lines = await fetchAnalysis(fens[i], depth, multiPV);
    positionLines[i] = lines;

    onProgress?.((i + 1) / totalPositions);
  }

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
      const raw =
        side === "w"
          ? evalBeforeCpWhite - evalAfterCpWhite
          : evalAfterCpWhite - evalBeforeCpWhite;

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
    finalPositionLines: positionLines[fens.length - 1] ?? [],
  };
}
