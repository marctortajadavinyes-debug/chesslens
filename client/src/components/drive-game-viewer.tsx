import { useState, useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { PgnActions } from "@/components/pgn-actions";
import {
  TrendingUp,
  Loader2,
  RotateCcw,
  ArrowLeft,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import type { DriveGameFile } from "@/lib/google-drive";
import { Chess } from "chess.js";
import { usePositionAnalysis } from "@/hooks/use-position-analysis";
import { LicensesDialog } from "@/components/licenses-dialog";

type AppLanguage = "ca" | "en" | "es";

// ─── i18n ─────────────────────────────────────────────────────────────────────

const LABEL: Record<
  AppLanguage,
  {
    back: string;
    analyze: string;
    exitAnalysis: string;
    returnToGame: string;
    showArrows: string;
    hideArrows: string;
    analysisWithStockfish: string;
  }
> = {
  ca: {
    back: "Tornar",
    analyze: "Analitzar",
    exitAnalysis: "Sortir d'anàlisi",
    returnToGame: "Tornar a la partida",
    showArrows: "Mostrar fletxes",
    hideArrows: "Amagar fletxes",
    analysisWithStockfish: "Anàlisi amb Stockfish 18",
  },
  en: {
    back: "Back",
    analyze: "Analyze",
    exitAnalysis: "Exit analysis",
    returnToGame: "Return to game",
    showArrows: "Show arrows",
    hideArrows: "Hide arrows",
    analysisWithStockfish: "Analysis with Stockfish 18",
  },
  es: {
    back: "Volver",
    analyze: "Analizar",
    exitAnalysis: "Salir del análisis",
    returnToGame: "Volver a la partida",
    showArrows: "Mostrar flechas",
    hideArrows: "Ocultar flechas",
    analysisWithStockfish: "Análisis con Stockfish 18",
  },
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
  const lbl = LABEL[appLanguage] ?? LABEL.ca;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [file]);

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
  const [showLicenses, setShowLicenses] = useState(false);
  const [boardIndex, setBoardIndex] = useState<number>(0);

  // showArrows — persisted in localStorage
  const [showArrows, setShowArrows] = useState(
    () => localStorage.getItem("chesslens_show_arrows") !== "false",
  );
  useEffect(() => {
    localStorage.setItem("chesslens_show_arrows", showArrows ? "true" : "false");
  }, [showArrows]);

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
    status: posStatus,
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
  const evalString = posLine
    ? evalToString(posLine.scoreCpWhite, posLine.mateWhite)
    : "";

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

  // ─── Eval bar node (same flexGrow pattern as game-detail) ─────────────────
  const evalBarNode = showAnalysis ? (
    <div className="flex items-stretch h-full gap-1">
      <div className="flex items-center justify-center">
        <span className="text-[10px] font-mono font-semibold tabular-nums leading-none w-7 text-center">
          {posStatus === "analyzing" && !evalString ? (
            <Loader2 className="w-3 h-3 animate-spin inline" />
          ) : (
            evalString
          )}
        </span>
      </div>
      <div
        className="w-2 sm:w-3 flex overflow-hidden rounded border border-border/40 shrink-0 h-full"
        style={{
          flexDirection:
            boardOrientation === "white" ? "column-reverse" : "column",
        }}
        data-testid="eval-bar"
        title={evalString || undefined}
      >
        <div
          className="bg-gray-100 dark:bg-gray-300"
          style={{ flexGrow: evalTopPercent, minHeight: 0 }}
        />
        <div
          className="bg-neutral-900 dark:bg-neutral-800"
          style={{ flexGrow: 100 - evalTopPercent, minHeight: 0 }}
        />
      </div>
    </div>
  ) : undefined;

  // ─── Arrows ───────────────────────────────────────────────────────────────
  const customArrows = useMemo<[string, string, string][]>(() => {
    if (!showAnalysis || !showArrows || posLines.length === 0) return [];
    const arrows: [string, string, string][] = [];
    const pv0 = posLines[0]?.pv[0];
    if (pv0 && pv0.length >= 4)
      arrows.push([
        pv0.slice(0, 2),
        pv0.slice(2, 4),
        "rgba(210, 115, 0, 0.90)",
      ]);
    const pv1 = posLines[1]?.pv[0];
    if (pv1 && pv1.length >= 4)
      arrows.push([
        pv1.slice(0, 2),
        pv1.slice(2, 4),
        "rgba(255, 185, 75, 0.80)",
      ]);
    return arrows;
  }, [showAnalysis, showArrows, posLines]);

  const canAnalyze = pgn.trim().length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-white/50 dark:bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div
          className={`relative max-w-7xl mx-auto px-4 flex items-center justify-between transition-all ${
            showAnalysis ? "h-8" : "h-16"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-drive-viewer-back"
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {lbl.back}
            </Button>

            {!showAnalysis && (
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-sm font-semibold truncate"
                  data-testid="drive-viewer-title"
                >
                  {white}{" "}
                  <span className="text-muted-foreground font-normal">vs</span>{" "}
                  {black}
                </span>
                {date && (
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0"
                    data-testid="drive-viewer-date"
                  >
                    {date}
                  </Badge>
                )}
                {result && (
                  <Badge
                    variant="secondary"
                    className="text-xs shrink-0"
                    data-testid="drive-viewer-result"
                  >
                    {result}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {showAnalysis && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <span
                data-testid="badge-analysis-stockfish"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 whitespace-nowrap"
              >
                {lbl.analysisWithStockfish}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pt-2 pb-4 space-y-2 sm:space-y-4">

        {/* Analitzar button — shown above board when not in analysis mode */}
        {canAnalyze && !showAnalysis && (
          <div className="flex items-center justify-center">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                posStop();
                setShowAnalysis(true);
                setJumpSignal({ index: 0, counter: Date.now() });
              }}
              data-testid="button-drive-analyze"
              className="gap-1.5 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <TrendingUp className="w-4 h-4" />
              {lbl.analyze}
            </Button>
          </div>
        )}

        {/* ── Board section ────────────────────────────────────────────────── */}
        <div className="space-y-2">
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
              className="h-[48px] space-y-0.5 bg-muted/30 rounded-lg px-2 sm:px-3 py-1 overflow-hidden w-full"
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
                      className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono"
                      data-testid={`analysis-line-${i}`}
                    >
                      <span className="text-muted-foreground w-9 sm:w-12 shrink-0">
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

          {/* Board + sidebar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-2 lg:gap-3">
            {/* Board column */}
            <div className="flex-1 min-w-0">
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
                customArrows={customArrows}
                enableAnalysisSandbox={showAnalysis}
                sandboxFen={currentSandboxFen ?? undefined}
                sandboxCanPrev={sandboxCanPrev}
                sandboxCanNext={sandboxCanNext}
                onSandboxMove={showAnalysis ? handleSandboxMove : undefined}
                onSandboxPrev={
                  showAnalysis && isSandboxActive
                    ? handleSandboxPrev
                    : undefined
                }
                onSandboxNext={
                  showAnalysis && isSandboxActive
                    ? handleSandboxNext
                    : undefined
                }
              />
            </div>

            {/* Lateral button column — only in analysis mode */}
            {showAnalysis && (
              <div className="grid grid-cols-2 gap-2 w-full lg:shrink-0 lg:flex lg:flex-col lg:justify-between lg:w-[148px] lg:min-h-[460px]">
                {/* Top: toggle arrows */}
                <div className="contents lg:flex lg:flex-col lg:gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full justify-center lg:justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight order-1 lg:order-none"
                    onClick={() => setShowArrows((v) => !v)}
                    data-testid="button-toggle-arrows-sidebar"
                  >
                    {showArrows ? (
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{showArrows ? lbl.hideArrows : lbl.showArrows}</span>
                  </Button>
                </div>

                {/* Middle: Tornar a la partida — only when sandbox active */}
                {isSandboxActive && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full justify-center lg:justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight order-3 col-span-2 lg:order-none lg:col-span-1"
                    onClick={clearSandbox}
                    data-testid="button-return-to-game"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>{lbl.returnToGame}</span>
                  </Button>
                )}

                {/* Bottom: Sortir d'anàlisi */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-center lg:justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight order-2 lg:order-none"
                  onClick={() => {
                    setShowAnalysis(false);
                    posStop();
                  }}
                  data-testid="button-hide-analysis-sidebar"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>{lbl.exitAnalysis}</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* PGN actions */}
        <PgnActions pgn={pgn} gameId={0} appLanguage={appLanguage} />
      </main>

      <LicensesDialog
        open={showLicenses}
        onOpenChange={setShowLicenses}
        t={{
          title: "Llicències i avisos de tercers",
          stockfish: "FotoChess utilitza Stockfish per a l'anàlisi d'escacs. Stockfish és un motor d'escacs lliure i de codi obert sota llicència GPLv3.",
          pythonChess: "FotoChess utilitza python-chess al servidor per validar jugades i generar PGN.",
          openSource: "FotoChess també utilitza biblioteques de codi obert com chess.js, react-chessboard i Lucide Icons per a la interfície i la gestió de posicions.",
          gemini: "Les imatges de planelles pujades per l'usuari poden ser processades mitjançant Gemini API / Google AI Studio per extreure'n les jugades.",
          trademarks: "Chess.com, Lichess.org i ChessBase són marques dels seus respectius titulars. FotoChess no està afiliada, patrocinada ni avalada per aquests serveis.",
          close: "Tancar",
        }}
      />
    </div>
  );
}
