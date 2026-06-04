/**
 * use-stockfish-analysis.ts — SF.2
 *
 * React hook that wraps analyzePgn() with status/progress/abort state.
 * Analysis is always on-demand — never triggered automatically.
 */

import { useState, useCallback, useRef } from "react";
import { analyzePgn, type GameAnalysis, type AnalysisOptions } from "@/lib/pgn-analysis";

export type AnalysisStatus = "idle" | "analyzing" | "done" | "error" | "aborted";

export interface UseStockfishAnalysisResult {
  status: AnalysisStatus;
  /** Progress 0–100 */
  progress: number;
  analysis: GameAnalysis | null;
  error: string | null;
  /** Start analysis of the given PGN. Returns false if already running. */
  analyze: (pgn: string, options?: Omit<AnalysisOptions, "onProgress" | "signal">) => boolean;
  /** Abort a running analysis. */
  abort: () => void;
  /** Reset to idle state. */
  reset: () => void;
}

export function useStockfishAnalysis(): UseStockfishAnalysisResult {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const analyze = useCallback(
    (
      pgn: string,
      options: Omit<AnalysisOptions, "onProgress" | "signal"> = {},
    ): boolean => {
      if (status === "analyzing") return false;

      // Create a fresh abort signal for this run
      const signal = { aborted: false };
      abortRef.current = signal;

      setStatus("analyzing");
      setProgress(0);
      setAnalysis(null);
      setError(null);

      analyzePgn(pgn, {
        ...options,
        onProgress: (p) => setProgress(Math.round(p * 100)),
        signal,
      })
        .then((result) => {
          if (signal.aborted) {
            setStatus("aborted");
            return;
          }
          setAnalysis(result);
          setProgress(100);
          setStatus("done");
        })
        .catch((err: unknown) => {
          if (signal.aborted) {
            setStatus("aborted");
            return;
          }
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        });

      return true;
    },
    [status],
  );

  const abort = useCallback(() => {
    abortRef.current.aborted = true;
    setStatus("aborted");
  }, []);

  const reset = useCallback(() => {
    abortRef.current.aborted = true;
    setStatus("idle");
    setProgress(0);
    setAnalysis(null);
    setError(null);
  }, []);

  return { status, progress, analysis, error, analyze, abort, reset };
}
