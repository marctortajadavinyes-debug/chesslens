/**
 * use-position-analysis.ts — SF.3C (server-side)
 *
 * Hook for single-position analysis via the backend /api/analysis/position.
 * The browser never loads Stockfish WASM/JS.
 * Cancel-safe: stale results are discarded via generation counter.
 * Never touches OCR / parser / reviewState / resume.
 */

import { useState, useCallback, useRef } from "react";
import type { AnalysisLine } from "@/lib/stockfish-worker";

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
  const abortRef = useRef<AbortController | null>(null);

  const analyzePosition = useCallback(
    async (fen: string, { depth = 12 }: { depth?: number } = {}) => {
      const gen = ++genRef.current;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setStatus("analyzing");
      setLines([]);
      setError(null);

      try {
        const resp = await fetch("/api/analysis/position", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fen, depth, multipv: 2 }),
          signal: ctrl.signal,
        });

        if (gen !== genRef.current) return;

        const data = await resp.json();

        if (gen !== genRef.current) return;

        if (!data.ok) {
          setError(data.error ?? "Analysis failed");
          setStatus("error");
          return;
        }

        // Map server response to AnalysisLine shape expected by the UI
        const mapped: AnalysisLine[] = (data.lines ?? []).map((l: {
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

        setLines(mapped);
        setStatus("done");
      } catch (err) {
        if (gen !== genRef.current) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [],
  );

  const stop = useCallback(() => {
    genRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setLines([]);
    setError(null);
  }, []);

  return { status, lines, error, analyzePosition, stop };
}
