/**
 * use-position-analysis.ts — SF.3C
 *
 * Hook for single-position Stockfish analysis (MultiPV=2, fast).
 * On-demand only — never triggers automatically.
 * Cancel-safe: stale results are discarded via generation counter.
 * Never touches OCR / parser / reviewState / resume.
 */

import { useState, useCallback, useRef } from "react";
import { getStockfishWorker, type AnalysisLine } from "@/lib/stockfish-worker";

export type PositionAnalysisStatus = "idle" | "analyzing" | "done" | "error";

export interface UsePositionAnalysisResult {
  status: PositionAnalysisStatus;
  lines: AnalysisLine[];
  error: string | null;
  analyzePosition: (fen: string, options?: { depth?: number }) => void;
  stop: () => void;
}

export function usePositionAnalysis(): UsePositionAnalysisResult {
  const [status, setStatus] = useState<PositionAnalysisStatus>("idle");
  const [lines, setLines] = useState<AnalysisLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const analyzePosition = useCallback(
    async (fen: string, { depth = 12 }: { depth?: number } = {}) => {
      const gen = ++genRef.current;
      setStatus("analyzing");
      setLines([]);
      setError(null);

      try {
        const worker = getStockfishWorker();
        const result = await worker.analyzePosition(fen, { depth, multiPV: 2 });
        if (gen !== genRef.current) return; // stale — newer request won
        setLines(result);
        setStatus("done");
      } catch (err) {
        if (gen !== genRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [],
  );

  const stop = useCallback(() => {
    genRef.current++;
    try { getStockfishWorker().stop(); } catch { /* ignore */ }
    setStatus("idle");
    setLines([]);
    setError(null);
  }, []);

  return { status, lines, error, analyzePosition, stop };
}
