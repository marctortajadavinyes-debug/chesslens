/**
 * server/stockfish.ts
 *
 * Server-side Stockfish UCI wrapper.
 * Spawns stockfish.js (WASM compiled, ships via the `stockfish` npm package)
 * as a child Node.js process and communicates via stdin/stdout UCI protocol.
 *
 * Never imported by the client bundle.
 */

import { spawn, type ChildProcess } from "child_process";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServerAnalysisLine {
  rank: number;
  /** UCI string of the first move in the PV */
  uci: string;
  evalCpWhite?: number;
  mateWhite?: number;
  /** Full PV as UCI moves */
  pvUci: string[];
  depth: number;
}

export interface ServerAnalysisResult {
  ok: true;
  fen: string;
  /** Eval from White's perspective in centipawns (best line) */
  evalCpWhite: number | null;
  lines: ServerAnalysisLine[];
}

export interface ServerAnalysisError {
  ok: false;
  error: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fenSideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

const SF_JS = path.resolve(
  "node_modules/stockfish/bin/stockfish-18-lite-single.js",
);

// ─── Serialised request queue ─────────────────────────────────────────────────
// Stockfish is single-threaded UCI; we serialize requests to avoid interleaving.

let _queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = _queue.then(fn, fn) as Promise<T>;
  _queue = next.then(
    () => {},
    () => {},
  );
  return next;
}

// ─── Core UCI function ────────────────────────────────────────────────────────

function runUciAnalysis(
  fen: string,
  multiPV: number,
  depth: number,
  maxTimeMs: number,
): Promise<ServerAnalysisLine[]> {
  return new Promise((resolve, reject) => {
    let sf: ChildProcess;

    try {
      sf = spawn(process.execPath, [SF_JS], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      reject(new Error(`Failed to spawn Stockfish: ${err}`));
      return;
    }

    const side = fenSideToMove(fen);
    const bestByPV = new Map<
      number,
      {
        depth: number;
        cpWhite?: number;
        mateWhite?: number;
        pv: string[];
      }
    >();

    let settled = false;
    let buffer = "";

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        sf.stdin?.end();
        sf.kill("SIGTERM");
      } catch {}

      const lines: ServerAnalysisLine[] = [];
      for (let i = 1; i <= multiPV; i++) {
        const e = bestByPV.get(i);
        if (e && e.pv.length > 0) {
          lines.push({
            rank: i,
            uci: e.pv[0],
            evalCpWhite: e.cpWhite,
            mateWhite: e.mateWhite,
            pvUci: e.pv,
            depth: e.depth,
          });
        }
      }
      resolve(lines);
    }

    const timer = setTimeout(() => finish(), maxTimeMs + 3000);

    sf.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";

      for (const raw of parts) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith("info") && line.includes("multipv")) {
          const pvIdx = parseInt(line.match(/multipv (\d+)/)?.[1] ?? "1", 10);
          const d = parseInt(line.match(/depth (\d+)/)?.[1] ?? "0", 10);
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          const pvMatch = line.match(/ pv (.+)$/);

          const existing = bestByPV.get(pvIdx);
          if (!existing || d >= existing.depth) {
            let cpWhite: number | undefined;
            let mateWhite: number | undefined;
            if (cpMatch) {
              const raw = parseInt(cpMatch[1], 10);
              cpWhite = side === "b" ? -raw : raw;
            } else if (mateMatch) {
              const raw = parseInt(mateMatch[1], 10);
              mateWhite = side === "b" ? -raw : raw;
            }
            const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];
            bestByPV.set(pvIdx, { depth: d, cpWhite, mateWhite, pv });
          }
        }

        if (line.startsWith("bestmove")) {
          finish();
        }
      }
    });

    sf.stderr?.on("data", () => {});

    sf.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    sf.on("close", () => finish());

    // Send UCI commands
    const stdin = sf.stdin;
    if (!stdin) {
      reject(new Error("No stdin on Stockfish process"));
      return;
    }

    stdin.write("uci\n");
    stdin.write(`setoption name MultiPV value ${multiPV}\n`);
    stdin.write("isready\n");
    stdin.write(`position fen ${fen}\n`);
    stdin.write(`go depth ${depth}\n`);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzePosition(
  fen: string,
  {
    depth = 12,
    multiPV = 2,
    maxTimeMs = 8000,
  }: { depth?: number; multiPV?: number; maxTimeMs?: number } = {},
): Promise<ServerAnalysisResult | ServerAnalysisError> {
  try {
    const lines = await enqueue(() =>
      runUciAnalysis(fen, multiPV, depth, maxTimeMs),
    );

    const evalCpWhite =
      lines.length > 0
        ? (lines[0].evalCpWhite ?? null)
        : null;

    return { ok: true, fen, evalCpWhite, lines };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
