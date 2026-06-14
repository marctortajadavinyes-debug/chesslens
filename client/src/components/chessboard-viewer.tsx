import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Play,
  Pause,
  ArrowUpDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AppLanguage = "ca" | "en" | "es";

type ScoresheetLanguage =
  | "ca"
  | "es"
  | "en"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "ru"
  | "tr"
  | "zh"
  | "hi";

type BoardText = {
  illegalBoardMove: string;
  processMovesError: string;
  invalidPgn: string;
  firstProblemMove: string;
  noPgnReceived: string;
  noMovesYet: string;
  rotateBoard: string;
  correctionModeTitle: string;
  playGameTitle: string;
};

const BOARD_TEXT: Record<AppLanguage, BoardText> = {
  ca: {
    illegalBoardMove: "Jugada il·legal al tauler",
    processMovesError: "Error al processar les jugades",
    invalidPgn: "PGN invàlid.",
    firstProblemMove: "Primera jugada problemàtica",
    noPgnReceived: "No s'ha rebut cap PGN",
    noMovesYet: "Cap jugada encara",
    rotateBoard: "Rotar tauler",
    correctionModeTitle:
      "En mode correcció, l'escaneig continua automàticament",
    playGameTitle: "Reproduir partida",
  },
  en: {
    illegalBoardMove: "Illegal move on the board",
    processMovesError: "Error processing moves",
    invalidPgn: "Invalid PGN.",
    firstProblemMove: "First problematic move",
    noPgnReceived: "No PGN received",
    noMovesYet: "No moves yet",
    rotateBoard: "Flip board",
    correctionModeTitle: "In correction mode, the scan continues automatically",
    playGameTitle: "Play game",
  },
  es: {
    illegalBoardMove: "Jugada ilegal en el tablero",
    processMovesError: "Error al procesar las jugadas",
    invalidPgn: "PGN inválido.",
    firstProblemMove: "Primera jugada problemática",
    noPgnReceived: "No se ha recibido ningún PGN",
    noMovesYet: "Sin jugadas todavía",
    rotateBoard: "Girar tablero",
    correctionModeTitle:
      "En modo corrección, el escaneo continúa automáticamente",
    playGameTitle: "Reproducir partida",
  },
};

export type SandboxMovePayload = {
  fen: string;
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string;
};

interface ChessboardViewerProps {
  pgn?: string | null;
  error?: string | null;
  syncToken?: string;
  onMove?: (move: {
    from: string;
    to: string;
    promotion?: string;
    undoIndex?: number;
  }) => void;
  enableInput?: boolean;
  onMoveIndexChange?: (index: number, maxIndex: number) => void;
  boardOrientation: "white" | "black";
  onOrientationChange: (o: "white" | "black") => void;
  appLanguage?: AppLanguage;
  scoresheetLanguage?: ScoresheetLanguage;
  customArrows?: [string, string, string][];
  jumpSignal?: { index: number; counter: number };
  evalBar?: React.ReactNode;
  /** When false, disables the auto-advance-to-final-position behaviour that
   *  fires when enableInput → false. Set to false during analysis mode so the
   *  jumpSignal controls the board position instead. Defaults to true. */
  lockToEnd?: boolean;
  /** When true, piece drops are routed to onSandboxMove instead of onMove.
   *  Set to true whenever analysis mode is active, regardless of sandboxFen. */
  enableAnalysisSandbox?: boolean;
  /** FEN to DISPLAY in analysis sandbox mode (may be null on the first move). */
  sandboxFen?: string | null;
  /** Called with the validated move result after a legal sandbox drop.
   *  ChessboardViewer does all chess.js validation; the handler just sets state. */
  onSandboxMove?: (move: SandboxMovePayload) => void;
}

function isBadPgn(pgn?: string | null) {
  if (!pgn) return true;
  const t = pgn.trim();
  if (!t) return true;
  if (t.startsWith("ERROR:")) return true;
  return false;
}

function extractMoveTokensFromPgn(pgn: string): string[] {
  const lines = pgn
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("["));

  const body = lines
    .join(" ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!body) return [];

  const rawTokens = body.split(" ");
  const tokens: string[] = [];

  for (const tok of rawTokens) {
    let t = tok.trim();

    if (["1-0", "0-1", "1/2-1/2", "*"].includes(t)) continue;

    const m = t.match(/^(\d+)\.+([^.]+.*)$/);
    if (m && m[2]) {
      t = m[2];
    }

    t = t.replace(/[–—]/g, "-");
    t = t.replace(/[^a-zA-Z0-9\+\=\-\#]/g, "");

    if (!t) continue;
    if (/^\d+$/.test(t)) continue;

    tokens.push(t);
  }

  return tokens;
}

function buildGameBestEffort(pgn: string): {
  game: Chess;
  firstBad?: { token: string; index: number; message: string };
} {
  const g = new Chess();

  try {
    g.loadPgn(pgn.trim());
    return { game: g };
  } catch {
    const tokens = extractMoveTokensFromPgn(pgn);

    for (let i = 0; i < tokens.length; i++) {
      try {
        g.move(tokens[i]);
      } catch (e: any) {
        return {
          game: g,
          firstBad: {
            token: tokens[i],
            index: i,
            message: String(e?.message || e),
          },
        };
      }
    }

    return { game: g };
  }
}

function fenAtMoveIndex(game: Chess, moveIndex: number): string {
  const verboseMoves = game.history({ verbose: true }) as any[];
  const temp = new Chess();
  const n = Math.max(0, Math.min(moveIndex, verboseMoves.length));

  for (let i = 0; i < n; i++) {
    const mv = verboseMoves[i];
    temp.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
  }

  return temp.fen();
}

function formatSanForScoresheetLanguage(
  san: string,
  scoresheetLanguage?: ScoresheetLanguage,
) {
  // El PGN interno siempre está en SAN internacional.
  // Solo cambiamos la visualización de la lista bajo el tablero.
  if (scoresheetLanguage !== "ca" && scoresheetLanguage !== "es") {
    return san;
  }

  return san
    .replace(/N/g, "C")
    .replace(/B/g, "A")
    .replace(/R/g, "T")
    .replace(/Q/g, "D")
    .replace(/K/g, "R");
}

export function ChessboardViewer({
  pgn,
  error,
  syncToken,
  onMove,
  enableInput,
  onMoveIndexChange,
  boardOrientation,
  onOrientationChange,
  appLanguage = "ca",
  scoresheetLanguage = "ca",
  customArrows,
  jumpSignal,
  evalBar,
  lockToEnd = true,
  enableAnalysisSandbox = false,
  sandboxFen = null,
  onSandboxMove,
}: ChessboardViewerProps) {
  const [game, setGame] = useState(() => new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [tempPosition, setTempPosition] = useState<string | null>(null);
  const handledJumpRef = useRef<number | undefined>(undefined);

  const { toast } = useToast();
  const t = BOARD_TEXT[appLanguage] ?? BOARD_TEXT.ca;

  const movesListRef = useRef<HTMLDivElement | null>(null);
  const activeMoveRef = useRef<HTMLSpanElement | null>(null);

  const historySan = useMemo(() => game.history(), [game]);

  // Jump to a specific move index when signaled from the parent
  useEffect(() => {
    if (!jumpSignal || jumpSignal.counter === handledJumpRef.current) return;
    handledJumpRef.current = jumpSignal.counter;
    setIsPlaying(false);
    setCurrentMoveIndex(
      Math.min(Math.max(0, jumpSignal.index), historySan.length),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpSignal?.counter]);

  useEffect(() => {
    if (onMoveIndexChange) {
      onMoveIndexChange(currentMoveIndex, historySan.length);
    }
  }, [currentMoveIndex, historySan.length, onMoveIndexChange]);

  useEffect(() => {
    const container = movesListRef.current;
    const active = activeMoveRef.current;

    if (!container || !active) return;

    let frame1 = 0;
    let frame2 = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const scrollNow = () => {
      const latestContainer = movesListRef.current;
      const latestActive = activeMoveRef.current;

      if (!latestContainer || !latestActive) return;

      const isAtLatestPosition = currentMoveIndex >= historySan.length;

      if (isAtLatestPosition) {
        latestContainer.scrollTop = latestContainer.scrollHeight;
        return;
      }

      const containerRect = latestContainer.getBoundingClientRect();
      const activeRect = latestActive.getBoundingClientRect();

      const activeOffsetInsideContainer =
        activeRect.top - containerRect.top + latestContainer.scrollTop;

      const targetScrollTop =
        activeOffsetInsideContainer -
        latestContainer.clientHeight / 2 +
        latestActive.clientHeight / 2;

      latestContainer.scrollTop = Math.max(0, targetScrollTop);
    };

    frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        scrollNow();

        // Segundo ajuste pequeño por si el contenido acaba de crecer
        // al llegar una nueva respuesta del backend.
        timeout = setTimeout(scrollNow, 80);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
      if (timeout) clearTimeout(timeout);
    };
  }, [currentMoveIndex, historySan.length, syncToken, enableInput]);

  // Clear the optimistic visual state whenever the real position changes OR
  // whenever the sandbox FEN prop resets to null (clearSandbox / end of variant).
  // Without sandboxFen in the deps, tempPosition would linger after clearSandbox
  // and the board would keep showing the last sandbox position.
  useEffect(() => {
    setTempPosition(null);
  }, [currentMoveIndex, pgn, sandboxFen]);

  useEffect(() => {
    // Only auto-advance to the final position when lockToEnd is not suppressed.
    // During analysis mode lockToEnd=false so jumpSignal controls the index.
    if (!enableInput && lockToEnd !== false) {
      setCurrentMoveIndex(historySan.length);
    }
  }, [enableInput, historySan.length, lockToEnd]);

  const currentPosition = useMemo(() => {
    if (sandboxFen) return sandboxFen;
    if (tempPosition) return tempPosition;
    return fenAtMoveIndex(game, currentMoveIndex);
  }, [sandboxFen, game, currentMoveIndex, tempPosition]);

  const handlePieceDrop = (source: string, target: string, piece: string) => {
    // SANDBOX MODE — user explores a variant in analysis; never touches the real game.
    // Gate is enableAnalysisSandbox (NOT sandboxFen) so the first move also works
    // when sandboxFen is still null.
    if (enableAnalysisSandbox) {
      if (!onSandboxMove) {
        console.warn("[sandbox] enableAnalysisSandbox=true but onSandboxMove is missing!");
        return false;
      }

      const baseFen = sandboxFen ?? fenAtMoveIndex(game, currentMoveIndex);
      console.log("[sandbox viewer drop start]", { source, target, piece, baseFen, currentMoveIndex });

      const sandboxGame = new Chess();
      sandboxGame.load(baseFen);

      // Determine promotion piece only for real pawn-promotion moves.
      // react-chessboard passes the resulting piece type ("wQ", "bR"…) as the
      // third argument; for regular moves it passes the moving piece ("wP", "bN"…).
      const movingPiece = sandboxGame.get(source as any);
      const isPawnPromotion =
        movingPiece?.type === "p" &&
        (target.endsWith("8") || target.endsWith("1"));
      const promotionChar = isPawnPromotion
        ? (piece[1]?.toLowerCase() ?? "q")
        : undefined;

      // Build a minimal move object — do NOT include promotion key at all for
      // non-promotion moves so chess.js cannot accidentally reject it.
      const moveInput = isPawnPromotion
        ? { from: source, to: target, promotion: promotionChar }
        : { from: source, to: target };

      let result: ReturnType<Chess["move"]> | null = null;
      try {
        result = sandboxGame.move(moveInput as any);
      } catch (err) {
        console.warn("[sandbox] chess.move failed", { moveInput, baseFen, err });
        return false;
      }
      if (!result) {
        console.warn("[sandbox] chess.move returned null/false", { moveInput, baseFen });
        return false;
      }

      const nextFen = sandboxGame.fen();
      const payload = {
        fen: nextFen,
        san: result.san,
        uci: result.from + result.to + (result.promotion ?? ""),
        from: result.from,
        to: result.to,
        promotion: result.promotion,
      };
      console.log("[sandbox viewer legal]", payload);

      // Immediate visual update — prevents react-chessboard bounce-back.
      setTempPosition(nextFen);

      console.log("[sandbox viewer callback exists]", true);
      onSandboxMove(payload);
      console.log("[sandbox viewer callback called]", payload);
      return true;
    }

    // CORRECTION MODE — real move review; guarded by enableInput
    if (!enableInput || !onMove) return false;

    const currentGame = new Chess(fenAtMoveIndex(game, currentMoveIndex));
    const movingPiece = currentGame.get(source as any);

    const isPawnPromotion =
      movingPiece?.type === "p" &&
      (target.endsWith("8") || target.endsWith("1"));

    // Capturamos la pieza elegida en el menú de imágenes nativo de react-chessboard
    let promotionChar = undefined;
    if (isPawnPromotion) {
      // 'piece' suele venir como "wQ", "bR", etc. Nos quedamos con la segunda letra en minúscula.
      promotionChar = piece.length === 2 ? piece[1].toLowerCase() : "q";
    }

    try {
      currentGame.move({ from: source, to: target, promotion: promotionChar });
      setTempPosition(currentGame.fen());

      onMove({
        from: source,
        to: target,
        promotion: promotionChar,
        undoIndex: currentMoveIndex,
      });

      return true;
    } catch {
      toast({
        title: t.illegalBoardMove,
        variant: "destructive",
        duration: 2000,
      });
      return false;
    }
  };

  useEffect(() => {
    setTempPosition(null);

    if (error && error.trim()) {
      setUiError(error.trim());
      setGame(new Chess());
      setIsPlaying(false);
      setCurrentMoveIndex(0);
      return;
    }

    if (isBadPgn(pgn)) {
      setUiError(pgn?.trim() ? pgn.trim() : t.noPgnReceived);
      setGame(new Chess());
      setIsPlaying(false);
      setCurrentMoveIndex(0);
      return;
    }

    const { game: newGame, firstBad } = buildGameBestEffort(pgn!.trim());

    setGame(newGame);
    setIsPlaying(false);
    setCurrentMoveIndex(newGame.history().length);

    if (firstBad && newGame.history().length === 0) {
      setUiError(
        `${t.invalidPgn}\n${t.firstProblemMove}: "${firstBad.token}".\n${firstBad.message}`,
      );
    } else {
      setUiError(null);
    }
  }, [pgn, error, syncToken, appLanguage]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMoveIndex((prev) => {
          const len = historySan.length;
          if (prev >= len) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, historySan.length]);

  return (
    <div className="flex flex-col space-y-4">
      {uiError ? (
        <div className="rounded-md border p-3 text-sm bg-destructive/10">
          <div className="font-semibold">{t.processMovesError}</div>
          <pre className="mt-2 whitespace-pre-wrap">{uiError}</pre>
        </div>
      ) : null}

      <div className="flex items-stretch justify-center gap-1.5">
        {evalBar && (
          <div className="shrink-0 self-stretch flex">{evalBar}</div>
        )}
        <div className="relative aspect-square flex-1 min-w-0 max-w-[460px]">
          <div className="shadow-2xl rounded-lg border-4 border-primary/10 bg-white">
            <Chessboard
              position={currentPosition}
              boardOrientation={boardOrientation}
              onPieceDrop={handlePieceDrop}
              arePiecesDraggable={enableInput || enableAnalysisSandbox}
              customDarkSquareStyle={{ backgroundColor: "#779556" }}
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
              animationDuration={200}
              customArrows={(customArrows ?? []) as any}
              customArrowColor="rgb(255,170,0)"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            onOrientationChange(
              boardOrientation === "white" ? "black" : "white",
            )
          }
          title={t.rotateBoard}
        >
          <ArrowUpDown className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setIsPlaying(false);
            setCurrentMoveIndex(0);
          }}
          disabled={currentMoveIndex === 0}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setIsPlaying(false);
            setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1));
          }}
          disabled={currentMoveIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          variant="default"
          size="icon"
          className="w-12 h-12 rounded-full"
          onClick={() => {
            if (enableInput) {
              setIsPlaying(false);
              setCurrentMoveIndex(historySan.length);
              return;
            }

            if (currentMoveIndex >= historySan.length) {
              setCurrentMoveIndex(0);
              setIsPlaying(true);
            } else {
              setIsPlaying(!isPlaying);
            }
          }}
          disabled={historySan.length === 0}
          title={enableInput ? t.correctionModeTitle : t.playGameTitle}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setIsPlaying(false);
            setCurrentMoveIndex(
              Math.min(historySan.length, currentMoveIndex + 1),
            );
          }}
          disabled={currentMoveIndex >= historySan.length}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div
        ref={movesListRef}
        className="bg-muted/30 rounded-lg p-4 h-32 overflow-y-auto text-sm font-mono border border-border"
      >
        {historySan.length === 0 ? (
          <p className="text-muted-foreground text-center pt-8">
            {t.noMovesYet}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {historySan.map((move, i) => (
              <span
                key={i}
                ref={i === currentMoveIndex - 1 ? activeMoveRef : null}
                className={cn(
                  "px-1.5 rounded cursor-pointer transition-colors",
                  i === currentMoveIndex - 1
                    ? "bg-primary text-primary-foreground font-bold"
                    : "hover:bg-primary/10",
                  i >= currentMoveIndex
                    ? "opacity-40 line-through text-muted-foreground decoration-red-400"
                    : "",
                )}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentMoveIndex(i + 1);
                }}
              >
                {i % 2 === 0 && (
                  <span className="text-muted-foreground mr-1">
                    {i / 2 + 1}.
                  </span>
                )}
                {formatSanForScoresheetLanguage(move, scoresheetLanguage)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
