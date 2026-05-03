import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type { Express } from "express";
import { Chess } from "chess.js";
import type { Server } from "http";

type ReviewSide = "w" | "b";

type ReviewState = {
  stoppedForReview: boolean;
  blockedRow: number | null;
  blockedSide: ReviewSide | null;
  blockedSheet: number | null;
  rawToken: string | null;
  candidates: string[];
  fen: string | null;
};

type GameStatus = "processing" | "needs_review" | "completed" | "failed";

type GameError = {
  row?: number;
  side?: ReviewSide;
  raw?: string;
  normalized?: string;
  candidates?: string[];
  reason?: string;
  fen?: string;
  [key: string]: any;
};

type OcrRow = {
  row: number;
  w: string;
  b: string;
  sheet: number;
  originalRow: number | null;
};

type OcrPayload = {
  meta: any;
  rows: OcrRow[];
};

type Game = {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: GameStatus;

  // Compatibilidad antigua
  imageUrl: string | null;
  imagePath: string | null;

  // Nuevo multi-planella
  imageUrls: string[];
  imagePaths: string[];

  pgn: string | null;
  error: string | null;
  moves: string[] | null;
  manualCorrections: { ply: number; san: string }[];
  errors: GameError[] | null;
  meta: any | null;
  ocr: OcrPayload | null;

  reviewState: ReviewState;
};

let nextId = 1;
const games = new Map<number, Game>();

function nowIso() {
  return new Date().toISOString();
}

function emptyReviewState(): ReviewState {
  return {
    stoppedForReview: false,
    blockedRow: null,
    blockedSide: null,
    blockedSheet: null,
    rawToken: null,
    candidates: [],
    fen: null,
  };
}

function saveDataUrlImageToTempFile(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid data URL image format");
  }

  const mimeType = match[1];
  const base64Data = match[2];

  let ext = ".jpg";
  if (mimeType === "image/png") ext = ".png";
  else if (mimeType === "image/webp") ext = ".webp";
  else if (mimeType === "image/jpeg") ext = ".jpg";

  const filePath = path.join(
    os.tmpdir(),
    `chesslens_upload_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}${ext}`,
  );

  fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
  return filePath;
}

function normalizeOcrRows(ocr: any, defaultSheet = 0): OcrPayload | null {
  if (!ocr || !Array.isArray(ocr.rows)) return null;

  return {
    meta: ocr.meta ?? {},
    rows: ocr.rows
      .map((r: any) => ({
        row: typeof r?.row === "number" ? r.row : r?.n,
        w: typeof r?.w === "string" ? r.w : "",
        b: typeof r?.b === "string" ? r.b : "",
        sheet: typeof r?.sheet === "number" ? r.sheet : defaultSheet,
        originalRow:
          typeof r?.originalRow === "number"
            ? r.originalRow
            : typeof r?.row === "number"
              ? r.row
              : typeof r?.n === "number"
                ? r.n
                : null,
      }))
      .filter((r: OcrRow) => typeof r.row === "number"),
  };
}
function extractUsableOcrFromPythonResult(
  parsed: any,
  defaultSheet = 0,
): OcrPayload | null {
  const normalized = normalizeOcrRows(parsed?.ocr, defaultSheet);

  if (
    !normalized ||
    !Array.isArray(normalized.rows) ||
    normalized.rows.length === 0
  ) {
    return null;
  }

  return {
    meta: normalized.meta ?? {},
    rows: normalized.rows.map((row) => ({
      ...row,
      sheet: typeof row.sheet === "number" ? row.sheet : defaultSheet,
      originalRow:
        typeof row.originalRow === "number"
          ? row.originalRow
          : typeof row.row === "number"
            ? row.row
            : null,
    })),
  };
}
function mergeOcrPayloads(payloads: OcrPayload[]): OcrPayload {
  const allRows: OcrRow[] = [];
  let nextRow = 1;

  payloads.forEach((payload, payloadIndex) => {
    for (const row of payload.rows) {
      allRows.push({
        row: nextRow,
        w: row.w ?? "",
        b: row.b ?? "",
        sheet: typeof row.sheet === "number" ? row.sheet : payloadIndex,
        originalRow:
          typeof row.originalRow === "number"
            ? row.originalRow
            : (row.row ?? null),
      });
      nextRow += 1;
    }
  });

  return {
    meta: {
      ...(payloads[0]?.meta ?? {}),
      sheets: payloads.length,
      totalRows: allRows.length,
    },
    rows: allRows,
  };
}

function updateGameFromEngineResult(game: Game, parsed: any) {
  game.pgn = typeof parsed?.pgn === "string" ? parsed.pgn : null;
  game.moves = Array.isArray(parsed?.moves) ? parsed.moves : null;
  game.errors = Array.isArray(parsed?.errors) ? parsed.errors : null;
  game.meta = parsed?.meta ?? game.meta ?? null;

  const previousOcr = game.ocr ?? null;
  const parsedOcr = normalizeOcrRows(parsed?.ocr);

  const previousHasMultipleSheets =
    !!previousOcr &&
    Array.isArray(previousOcr.rows) &&
    new Set(previousOcr.rows.map((r) => r.sheet)).size > 1;

  const parsedPreservesAllSheets =
    !!previousOcr &&
    !!parsedOcr &&
    parsedOcr.rows.length === previousOcr.rows.length &&
    parsedOcr.rows.every(
      (r, idx) =>
        typeof previousOcr.rows[idx]?.sheet === "number" &&
        r.sheet === previousOcr.rows[idx].sheet,
    );

  game.ocr =
    previousHasMultipleSheets && !parsedPreservesAllSheets
      ? previousOcr
      : (parsedOcr ?? previousOcr ?? null);

  const blockedRow =
    typeof parsed?.blocked_row === "number" ? parsed.blocked_row : null;

  let blockedSheet: number | null = null;

  if (blockedRow != null && game.ocr?.rows?.length) {
    const blocked = game.ocr.rows.find((r) => r.row === blockedRow);
    if (blocked && typeof blocked.sheet === "number") {
      blockedSheet = blocked.sheet;
    }
  }

  // Fallback práctico
  if (
    blockedSheet == null &&
    blockedRow != null &&
    Array.isArray(game.imageUrls) &&
    game.imageUrls.length > 1
  ) {
    blockedSheet = Math.floor((blockedRow - 1) / 75);
  }

  game.reviewState = {
    stoppedForReview: parsed?.stopped_for_review === true,
    blockedRow,
    blockedSide:
      parsed?.blocked_side === "w" || parsed?.blocked_side === "b"
        ? parsed.blocked_side
        : null,
    blockedSheet,
    rawToken: typeof parsed?.raw_token === "string" ? parsed.raw_token : null,
    candidates: Array.isArray(parsed?.candidates) ? parsed.candidates : [],
    fen: typeof parsed?.fen === "string" ? parsed.fen : null,
  };

  const pyError = parsed?.error ? String(parsed.error) : null;
  game.error = pyError;

  if (parsed?.ok !== true && !game.reviewState.stoppedForReview) {
    game.status = "failed";
    game.error = pyError || "Python returned ok=false";
    game.updatedAt = nowIso();
    return;
  }

  if (game.reviewState.stoppedForReview) {
    game.status = "needs_review";
    game.updatedAt = nowIso();
    return;
  }

  if (!game.pgn) {
    game.status = "failed";
    game.error = pyError || "Python returned no valid PGN";
    game.updatedAt = nowIso();
    return;
  }

  game.status = "completed";
  game.updatedAt = nowIso();
}

function runPythonProcess(
  scriptPath: string,
  imagePath: string,
  payload: any | null,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const cmd = process.env.PYTHON || "python3";

    const tmpPayloadPath = payload
      ? path.join(
          os.tmpdir(),
          `chesslens_payload_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}.json`,
        )
      : null;

    try {
      if (tmpPayloadPath) {
        fs.writeFileSync(
          tmpPayloadPath,
          JSON.stringify(payload, null, 2),
          "utf-8",
        );
      }
    } catch (e) {
      return reject(
        new Error(`Failed to write temp payload file: ${String(e)}`),
      );
    }

    const args = tmpPayloadPath
      ? [scriptPath, imagePath, tmpPayloadPath]
      : [scriptPath, imagePath];

    const py = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

    let out = "";
    let err = "";

    const TIMEOUT_MS = 180_000;

    const killer = setTimeout(() => {
      try {
        py.kill("SIGKILL");
      } catch {}
    }, TIMEOUT_MS);

    py.on("error", (e) => {
      clearTimeout(killer);
      cleanupTmp();
      reject(new Error(`Failed to start python: ${String(e)}`));
    });

    py.stdout.on("data", (d) => {
      out += d.toString();
    });

    py.stderr.on("data", (d) => {
      err += d.toString();
    });

    py.on("close", (code, signal) => {
      clearTimeout(killer);
      cleanupTmp();

      if (code !== 0) {
        return reject(
          new Error(
            (err || out || `Python exit ${code} signal=${signal}`).slice(
              0,
              4000,
            ),
          ),
        );
      }

      try {
        const parsed = JSON.parse(out);
        resolve(parsed);
      } catch (e) {
        reject(
          new Error(`Failed to parse python stdout as JSON: ${String(e)}`),
        );
      }
    });

    function cleanupTmp() {
      if (!tmpPayloadPath) return;
      try {
        if (fs.existsSync(tmpPayloadPath)) {
          fs.unlinkSync(tmpPayloadPath);
        }
      } catch {}
    }
  });
}

function resolveIncomingImages(body: any): {
  imagePaths: string[];
  imageUrls: string[];
} {
  const singleImagePath =
    typeof body?.imagePath === "string" ? body.imagePath : null;
  const singleImageUrl =
    typeof body?.imageUrl === "string" ? body.imageUrl : null;

  const arrayImagePaths = Array.isArray(body?.imagePaths)
    ? body.imagePaths.filter((v: any) => typeof v === "string")
    : [];

  const arrayImageUrls = Array.isArray(body?.imageUrls)
    ? body.imageUrls.filter((v: any) => typeof v === "string")
    : [];

  const rawPaths =
    arrayImagePaths.length > 0
      ? arrayImagePaths
      : singleImagePath
        ? [singleImagePath]
        : [];

  const rawUrls =
    arrayImageUrls.length > 0
      ? arrayImageUrls
      : singleImageUrl
        ? [singleImageUrl]
        : [];

  if (rawPaths.length > 0) {
    const validPaths = rawPaths.filter(
      (p) => typeof p === "string" && p.length >= 3,
    );
    return {
      imagePaths: validPaths,
      imageUrls: [],
    };
  }

  if (rawUrls.length > 0) {
    const validUrls = rawUrls.filter(
      (u) => typeof u === "string" && u.startsWith("data:image/"),
    );
    return {
      imagePaths: [],
      imageUrls: validUrls,
    };
  }

  return {
    imagePaths: [],
    imageUrls: [],
  };
}

function materializeImages(input: {
  imagePaths: string[];
  imageUrls: string[];
}): {
  finalImagePaths: string[];
  finalImageUrls: string[];
} {
  if (input.imagePaths.length > 0) {
    for (const p of input.imagePaths) {
      if (!fs.existsSync(p)) {
        throw new Error(`imagePath does not exist on server: ${p}`);
      }
    }

    return {
      finalImagePaths: input.imagePaths,
      finalImageUrls: [],
    };
  }

  if (input.imageUrls.length > 0) {
    const finalImagePaths = input.imageUrls.map((url) =>
      saveDataUrlImageToTempFile(url),
    );

    return {
      finalImagePaths,
      finalImageUrls: input.imageUrls,
    };
  }

  throw new Error("No valid imagePath/imageUrl/imagePaths/imageUrls provided");
}

export async function registerRoutes(_httpServer: Server, app: Express) {
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });
  function getOcrCellForPly(
    rows: OcrRow[],
    plyIndex: number,
  ): { row: number; side: ReviewSide } | null {
    const cells: { row: number; side: ReviewSide }[] = [];

    for (const r of rows) {
      if (typeof r.row !== "number") continue;

      if (typeof r.w === "string" && r.w.trim() !== "") {
        cells.push({ row: r.row, side: "w" });
      }

      if (typeof r.b === "string" && r.b.trim() !== "") {
        cells.push({ row: r.row, side: "b" });
      }
    }

    return cells[plyIndex] ?? null;
  }
  app.get("/api/games", (_req, res) => {
    const list = Array.from(games.values()).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    res.json(list);
  });

  app.get("/api/games/:id", (req, res) => {
    const id = Number(req.params.id);
    const g = games.get(id);

    if (!g) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json(g);
  });

  app.post("/api/games", async (req, res) => {
    try {
      const incoming = resolveIncomingImages(req.body ?? {});

      if (incoming.imagePaths.length === 0 && incoming.imageUrls.length === 0) {
        return res.status(400).json({
          message: "imagePath/imageUrl/imagePaths/imageUrls missing or invalid",
        });
      }

      let finalImagePaths: string[] = [];
      let finalImageUrls: string[] = [];

      try {
        const materialized = materializeImages(incoming);
        finalImagePaths = materialized.finalImagePaths;
        finalImageUrls = materialized.finalImageUrls;
      } catch (e) {
        return res.status(400).json({
          message: `Invalid image input: ${String(e)}`,
        });
      }

      const id = nextId++;
      const game: Game = {
        id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: "processing",

        imageUrl: finalImageUrls[0] ?? null,
        imagePath: finalImagePaths[0] ?? null,

        imageUrls: finalImageUrls,
        imagePaths: finalImagePaths,

        pgn: null,
        error: null,
        moves: null,
        manualCorrections: [],
        errors: null,
        meta: null,
        ocr: null,

        reviewState: emptyReviewState(),
      };

      games.set(id, game);

      const scriptPath = path.join(
        process.cwd(),
        "server",
        "process_image_gemini.py",
      );

      try {
        if (finalImagePaths.length === 1) {
          const parsed = await runPythonProcess(
            scriptPath,
            finalImagePaths[0],
            null,
          );
          updateGameFromEngineResult(game, parsed);
          return res.json(game);
        }

        // Processament seqüencial robust per a múltiples planelles.
        // Per a cada imatge només necessitem OCR usable.
        const ocrPayloads: OcrPayload[] = [];
        let mergedMeta: any = null;

        for (let i = 0; i < finalImagePaths.length; i++) {
          const imgPath = finalImagePaths[i];
          let success = false;
          let lastError = "Unknown OCR error";

          const maxAttempts = 3;

          for (let attempt = 1; attempt <= maxAttempts && !success; attempt++) {
            try {
              // Petita pausa entre planelles i reintents per reduir errors intermitents / 429
              if (i > 0 || attempt > 1) {
                const waitMs = attempt === 1 ? 4000 : 12000;
                await new Promise((r) => setTimeout(r, waitMs));
              }

              const parsed = await runPythonProcess(scriptPath, imgPath, null);
              const usableOcr = extractUsableOcrFromPythonResult(parsed, i);

              if (!usableOcr) {
                lastError = parsed?.error
                  ? String(parsed.error)
                  : "La IA ha retornat OCR buit o invàlid";
                continue;
              }

              if (
                !mergedMeta &&
                usableOcr.meta &&
                typeof usableOcr.meta === "object"
              ) {
                mergedMeta = usableOcr.meta;
              }

              ocrPayloads.push(usableOcr);
              success = true;
            } catch (err: any) {
              lastError =
                err instanceof Error
                  ? err.message
                  : String(err || "Unknown error");
            }
          }

          if (!success) {
            game.status = "failed";
            game.error = `No s'ha pogut llegir la planella ${i + 1}. ${lastError}`;
            game.updatedAt = nowIso();
            return res.status(500).json(game);
          }
        }

        const mergedOcr = mergeOcrPayloads(
          ocrPayloads.map((payload, idx) => ({
            meta:
              idx === 0
                ? {
                    ...(mergedMeta ?? payload.meta ?? {}),
                    sheets: finalImagePaths.length,
                  }
                : payload.meta,
            rows: payload.rows.map((row) => ({
              ...row,
              sheet: typeof row.sheet === "number" ? row.sheet : idx,
              originalRow:
                typeof row.originalRow === "number" ? row.originalRow : row.row,
            })),
          })),
        );

        game.ocr = mergedOcr;
        game.meta = mergedOcr.meta ?? mergedMeta ?? null;

        const finalPayload = {
          mode: "parse_rows",
          rows: mergedOcr.rows,
          meta: mergedOcr.meta ?? mergedMeta ?? {},
        };

        const parsedFinal = await runPythonProcess(
          scriptPath,
          finalImagePaths[0],
          finalPayload,
        );

        updateGameFromEngineResult(game, parsedFinal);
        return res.json(game);
      } catch (e) {
        game.status = "failed";
        game.error = String(e);
        game.updatedAt = nowIso();
        return res.status(500).json(game);
      }
    } catch (e) {
      return res.status(500).json({
        message: String(e),
      });
    }
  });

  app.patch("/api/games/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const game = games.get(id);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const { pgn, status, error } = req.body ?? {};

      if (typeof pgn === "string") {
        game.pgn = pgn;
      }
      if (
        status === "processing" ||
        status === "needs_review" ||
        status === "completed" ||
        status === "failed"
      ) {
        game.status = status;
      }
      if (typeof error === "string" || error === null) {
        game.error = error;
      }

      game.updatedAt = nowIso();
      return res.json(game);
    } catch (e) {
      return res.status(500).json({ message: String(e) });
    }
  });

  app.post("/api/games/:id/review", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const game = games.get(id);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const { correctedMove, moveFrom, moveTo, promotion, undoIndex } =
        req.body ?? {};

      const isTimeTravelReview =
        typeof undoIndex === "number" &&
        undoIndex >= 0 &&
        !!game.ocr &&
        Array.isArray(game.ocr.rows);

      if (game.status !== "needs_review" && !isTimeTravelReview) {
        return res.status(400).json({
          message: "Game is not waiting for review",
        });
      }
      let finalMove = correctedMove;

      // 👉 LÓGICA DE REBOBINADO (TIME TRAVEL)
      let safeMoves = Array.isArray(game.moves) ? game.moves : [];
      let startFen = game.reviewState.fen;
      let startRow = game.reviewState.blockedRow;
      let startSide = game.reviewState.blockedSide;

      if (
        typeof undoIndex === "number" &&
        undoIndex >= 0 &&
        undoIndex < safeMoves.length
      ) {
        safeMoves = safeMoves.slice(0, undoIndex);
        const tempBoard = new Chess();
        for (const move of safeMoves) {
          tempBoard.move(move);
        }
        startFen = tempBoard.fen();
        const physicalCell = game.ocr?.rows
          ? getOcrCellForPly(game.ocr.rows, undoIndex)
          : null;

        if (physicalCell) {
          startRow = physicalCell.row;
          startSide = physicalCell.side;
        } else {
          startRow = Math.floor(undoIndex / 2) + 1;
          startSide = undoIndex % 2 === 0 ? "w" : "b";
        }
      }

      if (!finalMove && moveFrom && moveTo) {
        const board = new Chess(startFen!);

        try {
          const move = board.move({
            from: moveFrom,
            to: moveTo,
            promotion: promotion || "q",
          });

          if (!move) {
            return res.status(400).json({
              message: "Invalid move from board",
            });
          }

          finalMove = move.san;
        } catch (_e) {
          return res.status(400).json({
            message: "Invalid move",
          });
        }
      }

      if (!finalMove || typeof finalMove !== "string") {
        return res.status(400).json({
          message: "correctedMove missing/invalid",
        });
      }

      const correctionPly = safeMoves.length;

      game.manualCorrections = [
        ...game.manualCorrections.filter((c) => c.ply !== correctionPly),
        { ply: correctionPly, san: finalMove },
      ].sort((a, b) => a.ply - b.ply);

      const engineImagePath = game.imagePaths?.[0] ?? game.imagePath;

      if (!engineImagePath || !fs.existsSync(engineImagePath)) {
        return res.status(400).json({
          message: "Original imagePath is missing or no longer exists",
        });
      }

      if (
        !game.ocr ||
        !Array.isArray(game.ocr.rows) ||
        !startFen ||
        startRow == null ||
        startSide == null
      ) {
        return res.status(400).json({
          message: "Game does not contain enough review context to resume",
        });
      }

      game.error = null;
      game.status = "processing";
      game.updatedAt = nowIso();

      const payload = {
        mode: "resume",
        rows: game.ocr.rows,
        meta: game.ocr.meta ?? game.meta ?? {},
        start_fen: startFen,
        start_row: startRow,
        start_side: startSide,
        corrected_move: finalMove,
        accepted_prefix_moves: safeMoves,
        manual_corrections: game.manualCorrections.filter(
          (c) => c.ply > correctionPly,
        ),
      };

      const scriptPath = path.join(
        process.cwd(),
        "server",
        "process_image_gemini.py",
      );

      try {
        const parsed = await runPythonProcess(
          scriptPath,
          engineImagePath,
          payload,
        );
        updateGameFromEngineResult(game, parsed);

        console.log(
          "[review-debug]",
          JSON.stringify(
            {
              id: game.id,
              status: game.status,
              updatedAt: game.updatedAt,
              reviewState: game.reviewState,
              lastError: Array.isArray(game.errors)
                ? game.errors.slice(-1)[0]
                : null,
              lastMoves: Array.isArray(game.moves)
                ? game.moves.slice(-10)
                : null,
              pgnTail:
                typeof game.pgn === "string"
                  ? game.pgn.split(" ").slice(-40).join(" ")
                  : null,
            },
            null,
            2,
          ),
        );

        return res.json(game);
      } catch (e) {
        game.status = "failed";
        game.error = String(e);
        game.updatedAt = nowIso();
        return res.status(500).json(game);
      }
    } catch (e) {
      return res.status(500).json({
        message: String(e),
      });
    }
  });
}
