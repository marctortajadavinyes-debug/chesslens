/**
 * stockfish-worker.ts
 * Wrapper around Stockfish JS (lite single-threaded WASM) as a Web Worker.
 * No COOP/COEP needed — safe alongside Google OAuth.
 *
 * SF.1  analyze(fen, depth)          → AnalysisResult  (single PV, backward-compat)
 * SF.2  analyzePosition(fen, opts)   → AnalysisLine[]  (MultiPV, white-normalised)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  bestMove: string;
  /** centipawns from the side to move (positive = advantage for side to move) */
  scoreCp?: number;
  /** mate in N from the side to move */
  scoreMate?: number;
  depth: number;
  raw: string[];
}

/** One PV line from MultiPV output, evaluation always in White's perspective. */
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

type MessageHandler = (line: string) => void;

const WORKER_PATH = "/stockfish.js";
/** Centipawn value assigned to a forced mate (for loss calculations). */
export const MATE_CP = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract side to move from a FEN string ('w' or 'b'). */
export function fenSideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/** Normalise a raw engine score (from side-to-move perspective) to White's perspective. */
export function toWhitePerspective(rawCp: number, fen: string): number {
  return fenSideToMove(fen) === "b" ? -rawCp : rawCp;
}

// ─── Worker class ─────────────────────────────────────────────────────────────

export class StockfishWorker {
  private worker: Worker | null = null;
  private listeners: MessageHandler[] = [];
  private ready = false;
  private destroyed = false;

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    try {
      this.worker = new Worker(WORKER_PATH);
    } catch (err) {
      throw new Error(
        `[StockfishWorker] Failed to create Worker from ${WORKER_PATH}: ${err}`,
      );
    }

    this.worker.onmessage = (event: MessageEvent) => {
      const line: string =
        typeof event.data === "string" ? event.data : String(event.data ?? "");
      for (const handler of this.listeners) handler(line);
    };

    this.worker.onerror = (err) => {
      console.error("[StockfishWorker] Worker error:", err.message ?? err);
    };

    return this.worker;
  }

  private send(cmd: string): void {
    this.getWorker().postMessage(cmd);
  }

  private addListener(handler: MessageHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs = 10_000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        remove();
        reject(new Error("[StockfishWorker] Timeout waiting for engine response"));
      }, timeoutMs);

      const remove = this.addListener((line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          remove();
          resolve(line);
        }
      });
    });
  }

  /** UCI handshake — idempotent. */
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.destroyed) throw new Error("[StockfishWorker] Worker destroyed");

    this.send("uci");
    await this.waitForLine((l) => l.trim() === "uciok", 15_000);

    this.send("isready");
    await this.waitForLine((l) => l.trim() === "readyok", 15_000);

    this.ready = true;
  }

  // ─── SF.1: single-PV (backward-compatible) ────────────────────────────────

  async analyze(fen: string, depth = 12): Promise<AnalysisResult> {
    if (this.destroyed) throw new Error("[StockfishWorker] Worker destroyed");
    await this.init();

    this.send("stop");
    this.send("setoption name MultiPV value 1");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    const raw: string[] = [];
    let bestScoreCp: number | undefined;
    let bestScoreMate: number | undefined;
    let bestDepth = 0;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        removeListener();
        reject(new Error("[StockfishWorker] Timeout waiting for bestmove"));
      }, 30_000);

      const removeListener = this.addListener((line) => {
        raw.push(line);

        if (line.startsWith("info") && line.includes("depth")) {
          const depthMatch = line.match(/depth (\d+)/);
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);

          if (depthMatch) {
            const d = parseInt(depthMatch[1], 10);
            if (d >= bestDepth) {
              bestDepth = d;
              if (cpMatch) {
                bestScoreCp = parseInt(cpMatch[1], 10);
                bestScoreMate = undefined;
              } else if (mateMatch) {
                bestScoreMate = parseInt(mateMatch[1], 10);
                bestScoreCp = undefined;
              }
            }
          }
        }

        if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          removeListener();
          resolve({
            bestMove: line.split(" ")[1] ?? "(none)",
            scoreCp: bestScoreCp,
            scoreMate: bestScoreMate,
            depth: bestDepth,
            raw,
          });
        }
      });
    });
  }

  // ─── SF.2: multi-PV, white-normalised ─────────────────────────────────────

  /**
   * Analyse a FEN position and return up to `multiPV` principal variations.
   * All scores are normalised to White's perspective:
   *   positive  → White is better
   *   negative  → Black is better
   */
  async analyzePosition(
    fen: string,
    { depth = 10, multiPV = 2 }: AnalyzePositionOptions = {},
  ): Promise<AnalysisLine[]> {
    if (this.destroyed) throw new Error("[StockfishWorker] Worker destroyed");
    await this.init();

    const side = fenSideToMove(fen);

    this.send("stop");
    this.send(`setoption name MultiPV value ${multiPV}`);
    this.send("isready");
    await this.waitForLine((l) => l.trim() === "readyok", 10_000);

    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    // Map multipv-index → best info seen so far (at highest depth for that line)
    const bestByPV = new Map<
      number,
      { depth: number; scoreCpWhite?: number; mateWhite?: number; pv: string[] }
    >();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        removeListener();
        reject(new Error("[StockfishWorker] Timeout in analyzePosition"));
      }, 30_000);

      const removeListener = this.addListener((line) => {
        if (line.startsWith("info") && line.includes("multipv")) {
          const pvIdx = parseInt(line.match(/multipv (\d+)/)?.[1] ?? "1", 10);
          const d = parseInt(line.match(/depth (\d+)/)?.[1] ?? "0", 10);
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          const pvMatch = line.match(/ pv (.+)$/);

          const existing = bestByPV.get(pvIdx);
          if (!existing || d >= existing.depth) {
            let scoreCpWhite: number | undefined;
            let mateWhite: number | undefined;

            if (cpMatch) {
              const raw = parseInt(cpMatch[1], 10);
              scoreCpWhite = side === "b" ? -raw : raw;
            } else if (mateMatch) {
              const raw = parseInt(mateMatch[1], 10);
              mateWhite = side === "b" ? -raw : raw;
            }

            const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];
            bestByPV.set(pvIdx, { depth: d, scoreCpWhite, mateWhite, pv });
          }
        }

        if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          removeListener();

          const lines: AnalysisLine[] = [];
          for (let i = 1; i <= multiPV; i++) {
            const entry = bestByPV.get(i);
            if (entry && entry.pv.length > 0) {
              lines.push({
                move: entry.pv[0],
                scoreCpWhite: entry.scoreCpWhite,
                mateWhite: entry.mateWhite,
                pv: entry.pv,
                depth: entry.depth,
              });
            }
          }
          resolve(lines);
        }
      });
    });
  }

  stop(): void {
    if (this.worker) this.send("stop");
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ready = false;
    this.listeners = [];
    if (this.worker) {
      this.send("quit");
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: StockfishWorker | null = null;

export function getStockfishWorker(): StockfishWorker {
  if (!_instance || (_instance as any).destroyed) {
    _instance = new StockfishWorker();
  }
  return _instance;
}
