/**
 * stockfish-worker.ts
 * Wrapper around Stockfish JS (lite single-threaded WASM) running as a Web Worker.
 * No COOP/COEP headers needed — safe alongside Google OAuth.
 *
 * Protocol: UCI (Universal Chess Interface)
 *   → send text commands via postMessage
 *   ← receive text lines via onmessage
 */

export interface AnalysisResult {
  bestMove: string;
  /** centipawns from the side to move (positive = advantage for side to move) */
  scoreCp?: number;
  /** mate in N (positive = side to move mates, negative = side to move is mated) */
  scoreMate?: number;
  depth: number;
  raw: string[];
}

type MessageHandler = (line: string) => void;

const WORKER_PATH = "/stockfish.js";

export class StockfishWorker {
  private worker: Worker | null = null;
  private listeners: MessageHandler[] = [];
  private ready = false;
  private destroyed = false;

  /** Lazy creation of the Worker. Throws if the script cannot be loaded. */
  private getWorker(): Worker {
    if (this.worker) return this.worker;

    try {
      this.worker = new Worker(WORKER_PATH);
    } catch (err) {
      throw new Error(`[StockfishWorker] Failed to create Worker from ${WORKER_PATH}: ${err}`);
    }

    this.worker.onmessage = (event: MessageEvent) => {
      const line: string =
        typeof event.data === "string" ? event.data : String(event.data ?? "");
      for (const handler of this.listeners) {
        handler(line);
      }
    };

    this.worker.onerror = (err) => {
      console.error("[StockfishWorker] Worker error:", err.message ?? err);
    };

    return this.worker;
  }

  /** Send a raw UCI command to the engine. */
  private send(cmd: string): void {
    this.getWorker().postMessage(cmd);
  }

  /** Register a one-time line listener. Returns a remove function. */
  private addListener(handler: MessageHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  /** Wait for a line matching a predicate with an optional timeout (ms). */
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

  /**
   * Initialize the UCI handshake.
   * Sends "uci" → waits for "uciok", then "isready" → waits for "readyok".
   * Idempotent — safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.destroyed) throw new Error("[StockfishWorker] Worker has been destroyed");

    this.send("uci");
    await this.waitForLine((l) => l.trim() === "uciok", 15_000);

    this.send("isready");
    await this.waitForLine((l) => l.trim() === "readyok", 15_000);

    this.ready = true;
  }

  /**
   * Analyse a FEN position to the given depth.
   * Returns the best move and score (cp or mate) from the deepest completed iteration.
   */
  async analyze(fen: string, depth = 12): Promise<AnalysisResult> {
    if (this.destroyed) throw new Error("[StockfishWorker] Worker has been destroyed");
    await this.init();

    this.send("stop");
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

        // Parse info lines for score at each depth
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

        // bestmove signals end of search
        if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          removeListener();

          const parts = line.split(" ");
          const bestMove = parts[1] ?? "(none)";

          resolve({
            bestMove,
            scoreCp: bestScoreCp,
            scoreMate: bestScoreMate,
            depth: bestDepth,
            raw,
          });
        }
      });
    });
  }

  /** Send stop to the engine (does not destroy the worker). */
  stop(): void {
    if (this.worker) this.send("stop");
  }

  /** Terminate the Worker and release resources. */
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

/** Singleton instance — lazy, shared across the app. */
let _instance: StockfishWorker | null = null;

export function getStockfishWorker(): StockfishWorker {
  if (!_instance || (_instance as any).destroyed) {
    _instance = new StockfishWorker();
  }
  return _instance;
}
