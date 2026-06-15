import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { PgnActions } from "@/components/pgn-actions";
import { TrendingUp, Loader2, RotateCcw } from "lucide-react";
import type { DriveGameFile } from "@/lib/google-drive";
import { Chess } from "chess.js";
import { usePositionAnalysis } from "@/hooks/use-position-analysis";

type AppLanguage = "ca" | "en" | "es";

const ANALYZE_LABEL: Record<AppLanguage, string> = {
  ca: "Analitzar",
  en: "Analyze",
  es: "Analizar",
};

const EXIT_ANALYSIS_LABEL: Record<AppLanguage, string> = {
  ca: "Sortir d'anàlisi",
  en: "Exit analysis",
  es: "Salir del análisis",
};

const RETURN_TO_GAME_LABEL: Record<AppLanguage, string> = {
  ca: "Tornar a la partida",
  en: "Return to game",
  es: "Volver a la partida",
};

// ─── Position-analysis helpers ────────────────────────────────────────────────

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function getFenAtPly(pgn: string, ply: number): string {
  if (!pgn.trim()) return STARTING_FEN;
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const history = game.history() as string[];
    const chess = new Chess();
    for (let i = 0; i < Math.min(ply, history.length); i++) {
      chess.move(history[i]);
    }
    return chess.fen();
  } catch {
    return STARTING_FEN;
  }
}

function pvToSan(fen: string, uciPv: string[]): string {
  if (!uciPv.length) return "";
  try {
    const chess = new Chess();
    chess.load(fen);
    const fenParts = fen.split(" ");
    let side = fenParts[1] === "b" ? "b" : "w";
    let fullMove = parseInt(fenParts[5] ?? "1", 10);
    const parts: string[] = [];
    let first = true;
    for (const uci of uciPv.slice(0, 8)) {
      if (uci.length < 4) break;
      if (side === "w") {
        parts.push(`${fullMove}.`);
      } else if (first) {
        parts.push(`${fullMove}...`);
      }
      first = false;
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? undefined,
      } as any);
      if (!move) break;
      parts.push(move.san);
      if (side === "b") fullMove++;
      side = side === "w" ? "b" : "w";
    }
    return parts.join(" ");
  } catch {
    return uciPv[0] ?? "";
  }
}

function evalToWhitePercent(scoreCpWhite?: number, mateWhite?: number): number {
  if (mateWhite !== undefined) return mateWhite > 0 ? 100 : 0;
  if (scoreCpWhite === undefined) return 50;
  const clamped = Math.max(-1000, Math.min(1000, scoreCpWhite));
  return 50 + (clamped / 1000) * 45;
}

function evalToString(scoreCpWhite?: number, mateWhite?: number): string {
  if (mateWhite !== undefined) {
    return mateWhite > 0 ? `M${mateWhite}` : `M${-mateWhite}`;
  }
  if (scoreCpWhite === undefined) return "";
  const pawns = scoreCpWhite / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function sanToDisplay(san: string, lang: string): string {
  if (lang !== "ca" && lang !== "es") return san;
  return san
    .replace(/N/g, "C")
    .replace(/B/g, "A")
    .replace(/R/g, "T")
    .replace(/Q/g, "D")
    .replace(/K/g, "R");
}

// ─────────────────────────────────────────────────────────────────────────────

interface DriveGameViewerProps {
  file: DriveGameFile;
  pgn: string;
  appLanguage: AppLanguage;
  onClose: () => void;
}

export function DriveGameViewer({
  file,
  pgn,
  appLanguage,
  onClose,
}: DriveGameViewerProps) {
  const p = file.appProperties;
  const white = p.white || "?";
  const black = p.black || "?";
  const date = p.date || "";
  const result = p.result || "";
  const userColor = p.userColor;

  const defaultOrientation: "white" | "black" =
    userColor === "black" ? "black" : "white";
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    defaultOrientation,
  );
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [boardIndex, setBoardIndex] = useState<number>(0);

  // ─── Sandbox ─────────────────────────────────────────────────────────────
  const [sandboxFens, setSandboxFens] = useState<string[]>([]);
  const [sandboxMoves, setSandboxMoves] = useState<string[]>([]);
  const [sandboxIndex, setSandboxIndex] = useState<number>(-1);
  const [sandboxBasePly, setSandboxBasePly] = useState<number | null>(null);

  const isSandboxActive = sandboxIndex >= 0;
  const currentSandboxFen: string | null = isSandboxActive
    ? sandboxFens[sandboxIndex]
    : null;
  const sandboxCanPrev = isSandboxActive && sandboxIndex > 0;
  const sandboxCanNext =
    isSandboxActive && sandboxIndex < sandboxFens.length - 1;

  const resetSandboxState = () => {
    setSandboxFens([]);
    setSandboxMoves([]);
    setSandboxIndex(-1);
    setSandboxBasePly(null);
  };

  useEffect(() => {
    if (!showAnalysis) resetSandboxState();
  }, [showAnalysis]);

  const prevBoardIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevBoardIndexRef.current;
    prevBoardIndexRef.current = boardIndex;
    if (prev !== null && prev !== boardIndex) {
      resetSandboxState();
    }
  }, [boardIndex]);

  // ─── Position analysis ────────────────────────────────────────────────────
  const {
    lines: posLines,
    analyzePosition: posAnalyze,
    stop: posStop,
  } = usePositionAnalysis();

  const currentFen = useMemo(
    () => getFenAtPly(pgn, boardIndex),
    [pgn, boardIndex],
  );

  const activeFen = isSandboxActive ? currentSandboxFen! : currentFen;

  useEffect(() => {
    if (!showAnalysis) return;
    const timer = setTimeout(() => {
      posAnalyze(activeFen, { depth: 12 });
    }, 350);
    return () => clearTimeout(timer);
    // posAnalyze is stable (useCallback with no deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis, activeFen]);

  const posLine = posLines[0];
  const evalTopPercent = evalToWhitePercent(
    posLine?.scoreCpWhite,
    posLine?.mateWhite,
  );

  // ─── Jump signal ──────────────────────────────────────────────────────────
  const [jumpSignal, setJumpSignal] = useState<
    { index: number; counter: number } | undefined
  >(undefined);

  // ─── Sandbox handlers ─────────────────────────────────────────────────────
  const handleSandboxMove = (payload: {
    fen: string;
    san: string;
    uci: string;
    from: string;
    to: string;
    promotion?: string;
  }) => {
    if (!isSandboxActive) {
      setSandboxBasePly(boardIndex);
    }
    setSandboxFens((prev) => [...prev.slice(0, sandboxIndex + 1), payload.fen]);
    setSandboxMoves((prev) => [
      ...prev.slice(0, sandboxIndex + 1),
      payload.san,
    ]);
    setSandboxIndex((i) => i + 1);
  };

  const handleSandboxPrev = () => {
    setSandboxIndex((i) => Math.max(0, i - 1));
  };

  const handleSandboxNext = () => {
    setSandboxIndex((i) => Math.min(sandboxFens.length - 1, i + 1));
  };

  const clearSandbox = () => {
    const targetPly = sandboxBasePly ?? boardIndex;
    setJumpSignal({ index: targetPly, counter: Date.now() });
    resetSandboxState();
  };

  // ─── Eval bar node ────────────────────────────────────────────────────────
  const evalBarNode = showAnalysis ? (
    <div
      className="w-4 flex flex-col rounded overflow-hidden border border-border/30"
      style={{ minHeight: 0 }}
      data-testid="eval-bar"
    >
      <div
        className="w-full bg-zinc-800"
        style={{
          height: `${100 - evalTopPercent}%`,
          transition: "height 0.6s ease",
        }}
      />
      <div
        className="w-full bg-zinc-100 dark:bg-zinc-200"
        style={{
          height: `${evalTopPercent}%`,
          transition: "height 0.6s ease",
        }}
      />
    </div>
  ) : undefined;

  // ─── Arrows ───────────────────────────────────────────────────────────────
  const customArrows = useMemo<[string, string, string][]>(() => {
    if (!showAnalysis || posLines.length === 0) return [];
    const arrows: [string, string, string][] = [];
    const pv0 = posLines[0]?.pv[0];
    if (pv0 && pv0.length >= 4)
      arrows.push([pv0.slice(0, 2), pv0.slice(2, 4), "rgba(210, 115, 0, 0.90)"]);
    const pv1 = posLines[1]?.pv[0];
    if (pv1 && pv1.length >= 4)
      arrows.push([pv1.slice(0, 2), pv1.slice(2, 4), "rgba(255, 185, 75, 0.80)"]);
    return arrows;
  }, [showAnalysis, posLines]);

  const canAnalyze = pgn.trim().length > 0;

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-base leading-snug"
            data-testid="drive-viewer-title"
          >
            {white}{" "}
            <span className="text-muted-foreground font-normal text-sm">
              vs
            </span>{" "}
            {black}
          </DialogTitle>
          {(date || result) && (
            <div className="flex items-center gap-2 pt-1">
              {date && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  data-testid="drive-viewer-date"
                >
                  {date}
                </Badge>
              )}
              {result && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  data-testid="drive-viewer-result"
                >
                  {result}
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3 pb-2">
          {/* Sandbox variant indicator */}
          {showAnalysis && isSandboxActive && (
            <div
              className="flex items-center gap-1.5 text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded px-2 py-0.5 w-full overflow-x-auto"
              data-testid="sandbox-variant-indicator"
            >
              <span className="shrink-0 font-semibold">Variant</span>
              {sandboxMoves.length > 0 && (
                <span className="whitespace-nowrap">
                  {sandboxMoves.slice(0, sandboxIndex + 1).join(" ")}
                </span>
              )}
            </div>
          )}

          {/* Analysis lines */}
          {showAnalysis && (
            <div
              className="h-[52px] space-y-0.5 bg-muted/30 rounded-lg px-3 py-1.5 overflow-hidden w-full"
              data-testid="analysis-lines"
            >
              {posLines.length > 0 ? (
                posLines.map((line, i) => {
                  const san = pvToSan(activeFen, line.pv);
                  const display = sanToDisplay(san, appLanguage);
                  const ev = evalToString(line.scoreCpWhite, line.mateWhite);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs font-mono"
                      data-testid={`analysis-line-${i}`}
                    >
                      <span className="text-muted-foreground w-12 shrink-0">
                        {ev}
                      </span>
                      <span className="text-foreground/90 truncate">
                        {display || line.move}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-2 h-full">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Analitzant…
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Board */}
          <ChessboardViewer
            pgn={pgn}
            boardOrientation={boardOrientation}
            onOrientationChange={setBoardOrientation}
            appLanguage={appLanguage}
            scoresheetLanguage={appLanguage}
            enableInput={false}
            lockToEnd={!showAnalysis}
            onMoveIndexChange={(idx) => {
              setBoardIndex(idx);
            }}
            jumpSignal={jumpSignal}
            evalBar={evalBarNode}
            customArrows={showAnalysis ? customArrows : []}
            enableAnalysisSandbox={showAnalysis}
            sandboxFen={currentSandboxFen ?? undefined}
            sandboxCanPrev={sandboxCanPrev}
            sandboxCanNext={sandboxCanNext}
            onSandboxMove={showAnalysis ? handleSandboxMove : undefined}
            onSandboxPrev={
              showAnalysis && isSandboxActive ? handleSandboxPrev : undefined
            }
            onSandboxNext={
              showAnalysis && isSandboxActive ? handleSandboxNext : undefined
            }
          />

          <PgnActions pgn={pgn} gameId={0} appLanguage={appLanguage} />

          {/* Tornar a la partida — only when sandbox is active */}
          {showAnalysis && isSandboxActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSandbox}
              data-testid="button-return-to-game"
              className="text-xs gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {RETURN_TO_GAME_LABEL[appLanguage]}
            </Button>
          )}

          {/* Analitzar / Sortir d'anàlisi */}
          {canAnalyze && (
            <div className="flex items-center gap-2">
              {!showAnalysis ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    posStop();
                    setShowAnalysis(true);
                    setJumpSignal({ index: 0, counter: Date.now() });
                  }}
                  data-testid="button-drive-analyze"
                  className="gap-1.5"
                >
                  <TrendingUp className="w-4 h-4" />
                  {ANALYZE_LABEL[appLanguage]}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    posStop();
                    setShowAnalysis(false);
                  }}
                  data-testid="button-drive-exit-analysis"
                  className="text-xs gap-1.5 text-muted-foreground"
                >
                  {EXIT_ANALYSIS_LABEL[appLanguage]}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
