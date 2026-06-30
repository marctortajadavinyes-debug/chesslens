import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGame, useReviewGame, useUpdateGame } from "@/hooks/use-games";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { PgnActions } from "@/components/pgn-actions";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  RotateCcw,
  Undo2,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppLanguage } from "@shared/schema";
import { usePositionAnalysis } from "@/hooks/use-position-analysis";
import { LicensesDialog } from "@/components/licenses-dialog";
import { Chess } from "chess.js";

type ReviewSide = "w" | "b";

type GameDetailText = {
  gameNotFound: string;
  gameTitle: (id: number) => string;
  originalScoresheet: string;
  imageUnavailable: string;
  showingSheet: (sheetNumber: number) => string;
  continuing: string;
  statusLabels: Record<string, string>;
  processingTitle: string;
  validatingMoves: string;
  nextExpectedMove: (moveNumber: number, side: ReviewSide) => string;
  white: string;
  black: string;
  makeCorrectMoveOnBoard: string;
  reviewSheetRow: (sheetNumber: number, rowNumber: number | null) => string;
  reviewingBeforeMove: (moveNumber: number, side: ReviewSide) => string;
  reviewingHelp: string;
  pgnTitle: string;
  editPgn: string;
  cancel: string;
  save: string;
  changesSavedTitle: string;
  changesSavedDescription: string;
  genericErrorTitle: string;
  moveAppliedTitle: string;
  moveAppliedDescription: string;
  applyMoveErrorTitle: string;
  resumeErrorFallback: string;
  showScoresheet: string;
  hideScoresheet: string;
  pgnActionsTitle: string;
  pgnNotReady: string;
  sheetCounter: (current: number, total: number) => string;
  previousSheet: string;
  nextSheet: string;
  analyze: string;
  hideAnalysis: string;
  showArrows: string;
  hideArrows: string;
  returnToGame: string;
  analysisWithStockfish: string;
  licensesTitle: string;
  licensesClose: string;
  licensesStockfish: string;
  licensesPythonChess: string;
  licensesOpenSource: string;
  licensesGemini: string;
  licensesTrademarks: string;
  licensesTrigger: string;
};

const GAME_DETAIL_TEXT: Record<AppLanguage, GameDetailText> = {
  ca: {
    gameNotFound: "Partida no trobada",
    gameTitle: (id: number) => `Partida #${id}`,
    originalScoresheet: "Planella original",
    imageUnavailable: "Imatge no disponible",
    showingSheet: (sheetNumber: number) => `Mostrant planella ${sheetNumber}`,
    continuing: "Continuant...",
    statusLabels: {
      processing: "Processant",
      needs_review: "Revisió necessària",
      completed: "Completada",
      failed: "Error",
    },
    processingTitle: "Processant",
    validatingMoves: "Validant jugades...",
    nextExpectedMove: (moveNumber: number, side: ReviewSide) =>
      `Següent jugada esperada: ${moveNumber} ${
        side === "w" ? "blanques" : "negres"
      }`,
    white: "blanques",
    black: "negres",
    makeCorrectMoveOnBoard:
      "Fes la jugada correcta directament sobre el tauler per continuar l'escaneig.",
    reviewSheetRow: (sheetNumber: number, rowNumber: number | null) =>
      rowNumber != null
        ? `Revisa la planella ${sheetNumber} · fila ${rowNumber}.`
        : `Revisa la planella ${sheetNumber}.`,
    reviewingBeforeMove: (moveNumber: number, side: ReviewSide) =>
      `Estàs revisant la posició abans de la jugada ${moveNumber} ${
        side === "w" ? "blanques" : "negres"
      }.`,
    reviewingHelp:
      "Fes ara la jugada correcta al tauler i FotoChess continuarà l'escaneig des d'aquí.",
    pgnTitle: "PGN",
    editPgn: "Editar PGN",
    cancel: "Cancel·lar",
    save: "Desar",
    changesSavedTitle: "Canvis desats",
    changesSavedDescription: "El PGN s'ha actualitzat.",
    genericErrorTitle: "Error",
    moveAppliedTitle: "Jugada aplicada",
    moveAppliedDescription: "Continuem l'escaneig des d'aquesta posició.",
    applyMoveErrorTitle: "Error en aplicar la jugada",
    resumeErrorFallback: "No s'ha pogut reprendre",
    showScoresheet: "Veure planella",
    hideScoresheet: "Amagar planella",
    pgnActionsTitle: "Accions del PGN",
    pgnNotReady: "El PGN encara s'està generant",
    sheetCounter: (current, total) => `Planella ${current} / ${total}`,
    previousSheet: "Planella anterior",
    nextSheet: "Planella següent",
    analyze: "Analitzar",
    hideAnalysis: "Sortir d'anàlisi",
    showArrows: "Mostrar fletxes",
    hideArrows: "Amagar fletxes",
    returnToGame: "Tornar a la partida",
    analysisWithStockfish: "Anàlisi amb Stockfish 18",
    licensesTitle: "Llicències i avisos de tercers",
    licensesClose: "Tancar",
    licensesStockfish: "FotoChess utilitza Stockfish per a l'anàlisi d'escacs. Stockfish és un motor d'escacs lliure i de codi obert sota llicència GPLv3.",
    licensesPythonChess: "FotoChess utilitza python-chess al servidor per validar jugades i generar PGN.",
    licensesOpenSource: "FotoChess també utilitza biblioteques de codi obert com chess.js, react-chessboard i Lucide Icons per a la interfície i la gestió de posicions.",
    licensesGemini: "Les imatges de planelles pujades per l'usuari poden ser processades mitjançant Gemini API / Google AI Studio per extreure'n les jugades.",
    licensesTrademarks: "Chess.com, Lichess.org i ChessBase són marques dels seus respectius titulars. FotoChess no està afiliada, patrocinada ni avalada per aquests serveis.",
    licensesTrigger: "Llicències i avisos de tercers",
  },
  en: {
    gameNotFound: "Game not found",
    gameTitle: (id: number) => `Game #${id}`,
    originalScoresheet: "Original scoresheet",
    imageUnavailable: "Image unavailable",
    showingSheet: (sheetNumber: number) => `Showing scoresheet ${sheetNumber}`,
    continuing: "Continuing...",
    statusLabels: {
      processing: "Processing",
      needs_review: "Review needed",
      completed: "Completed",
      failed: "Error",
    },
    processingTitle: "Processing",
    validatingMoves: "Validating moves...",
    nextExpectedMove: (moveNumber: number, side: ReviewSide) =>
      `Next expected move: ${moveNumber} ${side === "w" ? "White" : "Black"}`,
    white: "White",
    black: "Black",
    makeCorrectMoveOnBoard:
      "Make the correct move directly on the board to continue the scan.",
    reviewSheetRow: (sheetNumber: number, rowNumber: number | null) =>
      rowNumber != null
        ? `Check scoresheet ${sheetNumber} · row ${rowNumber}.`
        : `Check scoresheet ${sheetNumber}.`,
    reviewingBeforeMove: (moveNumber: number, side: ReviewSide) =>
      `You are reviewing the position before move ${moveNumber} ${
        side === "w" ? "White" : "Black"
      }.`,
    reviewingHelp:
      "Now make the correct move on the board and FotoChess will continue the scan from here.",
    pgnTitle: "PGN",
    editPgn: "Edit PGN",
    cancel: "Cancel",
    save: "Save",
    changesSavedTitle: "Changes saved",
    changesSavedDescription: "The PGN has been updated.",
    genericErrorTitle: "Error",
    moveAppliedTitle: "Move applied",
    moveAppliedDescription: "Continuing the scan from this position.",
    applyMoveErrorTitle: "Error applying move",
    resumeErrorFallback: "Could not resume",
    showScoresheet: "Show scoresheet",
    hideScoresheet: "Hide scoresheet",
    pgnActionsTitle: "PGN actions",
    pgnNotReady: "PGN is still being generated",
    sheetCounter: (current, total) => `Scoresheet ${current} / ${total}`,
    previousSheet: "Previous scoresheet",
    nextSheet: "Next scoresheet",
    analyze: "Analyze",
    hideAnalysis: "Exit analysis",
    showArrows: "Show arrows",
    hideArrows: "Hide arrows",
    returnToGame: "Return to game",
    analysisWithStockfish: "Analysis with Stockfish 18",
    licensesTitle: "Licences and third-party notices",
    licensesClose: "Close",
    licensesStockfish: "FotoChess uses Stockfish for chess analysis. Stockfish is a free and open-source chess engine licensed under GPLv3.",
    licensesPythonChess: "FotoChess uses python-chess on the server to validate moves and generate PGN.",
    licensesOpenSource: "FotoChess also uses open-source libraries such as chess.js, react-chessboard, and Lucide Icons for the interface and position management.",
    licensesGemini: "Images of scoresheets uploaded by the user may be processed via Gemini API / Google AI Studio to extract the moves.",
    licensesTrademarks: "Chess.com, Lichess.org and ChessBase are trademarks of their respective owners. FotoChess is not affiliated with, sponsored by, or endorsed by these services.",
    licensesTrigger: "Licences and third-party notices",
  },
  es: {
    gameNotFound: "Partida no encontrada",
    gameTitle: (id: number) => `Partida #${id}`,
    originalScoresheet: "Planilla original",
    imageUnavailable: "Imagen no disponible",
    showingSheet: (sheetNumber: number) => `Mostrando planilla ${sheetNumber}`,
    continuing: "Continuando...",
    statusLabels: {
      processing: "Procesando",
      needs_review: "Revisión necesaria",
      completed: "Completada",
      failed: "Error",
    },
    processingTitle: "Procesando",
    validatingMoves: "Validando jugadas...",
    nextExpectedMove: (moveNumber: number, side: ReviewSide) =>
      `Siguiente jugada esperada: ${moveNumber} ${
        side === "w" ? "blancas" : "negras"
      }`,
    white: "blancas",
    black: "negras",
    makeCorrectMoveOnBoard:
      "Haz la jugada correcta directamente sobre el tablero para continuar el escaneo.",
    reviewSheetRow: (sheetNumber: number, rowNumber: number | null) =>
      rowNumber != null
        ? `Revisa la planilla ${sheetNumber} · fila ${rowNumber}.`
        : `Revisa la planilla ${sheetNumber}.`,
    reviewingBeforeMove: (moveNumber: number, side: ReviewSide) =>
      `Estás revisando la posición antes de la jugada ${moveNumber} ${
        side === "w" ? "blancas" : "negras"
      }.`,
    reviewingHelp:
      "Haz ahora la jugada correcta en el tablero y FotoChess continuará el escaneo desde aquí.",
    pgnTitle: "PGN",
    editPgn: "Editar PGN",
    cancel: "Cancelar",
    save: "Guardar",
    changesSavedTitle: "Cambios guardados",
    changesSavedDescription: "El PGN se ha actualizado.",
    genericErrorTitle: "Error",
    moveAppliedTitle: "Jugada aplicada",
    moveAppliedDescription: "Continuamos el escaneo desde esta posición.",
    applyMoveErrorTitle: "Error al aplicar la jugada",
    resumeErrorFallback: "No se ha podido reanudar",
    showScoresheet: "Ver planilla",
    hideScoresheet: "Ocultar planilla",
    pgnActionsTitle: "Acciones del PGN",
    pgnNotReady: "El PGN se está generando",
    sheetCounter: (current, total) => `Planilla ${current} / ${total}`,
    previousSheet: "Planilla anterior",
    nextSheet: "Planilla siguiente",
    analyze: "Analizar",
    hideAnalysis: "Salir del análisis",
    showArrows: "Mostrar flechas",
    hideArrows: "Ocultar flechas",
    returnToGame: "Volver a la partida",
    analysisWithStockfish: "Análisis con Stockfish 18",
    licensesTitle: "Licencias y avisos de terceros",
    licensesClose: "Cerrar",
    licensesStockfish: "FotoChess utiliza Stockfish para el análisis de ajedrez. Stockfish es un motor de ajedrez libre y de código abierto bajo licencia GPLv3.",
    licensesPythonChess: "FotoChess utiliza python-chess en el servidor para validar jugadas y generar PGN.",
    licensesOpenSource: "FotoChess también utiliza bibliotecas de código abierto como chess.js, react-chessboard y Lucide Icons para la interfaz y la gestión de posiciones.",
    licensesGemini: "Las imágenes de planillas subidas por el usuario pueden ser procesadas mediante Gemini API / Google AI Studio para extraer las jugadas.",
    licensesTrademarks: "Chess.com, Lichess.org y ChessBase son marcas de sus respectivos titulares. FotoChess no está afiliada, patrocinada ni avalada por estos servicios.",
    licensesTrigger: "Licencias y avisos de terceros",
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
  // Mate → the winning side takes the entire bar (100 or 0).
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

function getAppLanguageFromGame(game: any): AppLanguage {
  const lang = game?.meta?.appLanguage;

  if (lang === "ca" || lang === "en" || lang === "es") {
    return lang;
  }

  return "ca";
}
function getScoresheetLanguageFromGame(game: any) {
  const lang = game?.meta?.scoresheetLanguage;

  if (lang === "ca" || lang === "en" || lang === "es") {
    return lang;
  }

  return "ca";
}

function getDisplayedSheetIndex(game: any, needsReview: boolean) {
  const blockedSheet =
    typeof game?.reviewState?.blockedSheet === "number"
      ? game.reviewState.blockedSheet
      : null;

  if (
    needsReview &&
    blockedSheet != null &&
    Array.isArray(game?.imageUrls) &&
    game.imageUrls[blockedSheet]
  ) {
    return blockedSheet;
  }

  return 0;
}

function getExpectedTurnFromPlyCount(plyCount: number) {
  return {
    moveNumber: Math.floor(plyCount / 2) + 1,
    side: plyCount % 2 === 0 ? "w" : "b",
  } as const;
}

function getRowsPerSheetFromGame(game: any) {
  const sheetFormat =
    typeof game?.meta?.sheetFormat === "string"
      ? game.meta.sheetFormat
      : "fce_75_3x25";

  if (sheetFormat === "fide_60_3x20") return 60;
  if (sheetFormat === "standard_60_2x30") return 60;
  if (sheetFormat === "generic_40_2x20") return 40;
  return 75;
}

export default function GameDetail() {
  const [, params] = useRoute("/games/:id");
  const id = parseInt(params?.id || "0", 10);

  const { data: game, isLoading, error } = useGame(id);
  const updateGame = useUpdateGame();
  const reviewGame = useReviewGame();
  const { toast } = useToast();

  const appLanguage = getAppLanguageFromGame(game);
  const scoresheetLanguage = getScoresheetLanguageFromGame(game);
  const t = GAME_DETAIL_TEXT[appLanguage] ?? GAME_DETAIL_TEXT.ca;

  const [pgnText, setPgnText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [hideQuestionUI, setHideQuestionUI] = useState(false);

  const [boardIndex, setBoardIndex] = useState<number>(0);
  const [maxBoardIndex, setMaxBoardIndex] = useState<number>(0);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white",
  );
  const [showSheetMobile, setShowSheetMobile] = useState(false);
  const [sheetOverride, setSheetOverride] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);

  // ─── Analysis sandbox ────────────────────────────────────────────────────────
  // Gate verbose sandbox tracing behind this flag.
  const DEBUG_SANDBOX = false;

  // History of FENs and SANs accumulated in the current variant.
  // sandboxIndex is the cursor (-1 = no active sandbox).
  const [sandboxFens, setSandboxFens] = useState<string[]>([]);
  const [sandboxMoves, setSandboxMoves] = useState<string[]>([]);
  const [sandboxIndex, setSandboxIndex] = useState<number>(-1);
  // Real-game ply the user was on when the variant started.
  const [sandboxBasePly, setSandboxBasePly] = useState<number | null>(null);

  const isSandboxActive = sandboxIndex >= 0;
  // Current FEN to display / feed to Stockfish during a variant.
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

  // Clear sandbox whenever analysis mode is turned off
  useEffect(() => {
    if (!showAnalysis) resetSandboxState();
  }, [showAnalysis]);

  // Clear sandbox only when the user ACTUALLY navigates (boardIndex changes).
  // We use a ref to distinguish a real navigation from a spurious render that
  // calls onMoveIndexChange with the same idx (which would otherwise wipe the
  // sandbox immediately after it was just activated).
  const prevBoardIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevBoardIndexRef.current;
    prevBoardIndexRef.current = boardIndex;
    if (prev !== null && prev !== boardIndex) {
      // User navigated to a different ply — discard any active sandbox variant
      resetSandboxState();
      DEBUG_SANDBOX && console.log("[sandbox cleared] boardIndex changed", prev, "→", boardIndex);
    }
  }, [boardIndex]);

  // ─── Position analysis ──────────────────────────────────────────────────────
  const {
    status: posStatus,
    lines: posLines,
    analyzePosition: posAnalyze,
    stop: posStop,
  } = usePositionAnalysis();

  const currentFen = useMemo(
    () => getFenAtPly(pgnText || game?.pgn || "", boardIndex),
    [pgnText, game?.pgn, boardIndex],
  );

  // In sandbox mode analyze the sandbox position; otherwise the real board position.
  const activeFen = isSandboxActive ? currentSandboxFen! : currentFen;

  // Re-analyze whenever analysis mode is active and the active position changes.
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
  const evalTopPercent = evalToWhitePercent(posLine?.scoreCpWhite, posLine?.mateWhite);
  const evalString = posLine ? evalToString(posLine.scoreCpWhite, posLine.mateWhite) : "";

  // showArrows — persisted in localStorage
  const [showArrows, setShowArrows] = useState(
    () => localStorage.getItem("chesslens_show_arrows") !== "false",
  );
  useEffect(() => {
    localStorage.setItem("chesslens_show_arrows", showArrows ? "true" : "false");
  }, [showArrows]);

  // Jump signal — tells ChessboardViewer to navigate to a specific ply
  const [jumpSignal, setJumpSignal] = useState<
    { index: number; counter: number } | undefined
  >(undefined);

  // Arrows derived from posLines — both orange, different shades
  const customArrows = useMemo<[string, string, string][]>(() => {
    if (!showAnalysis || !showArrows || posLines.length === 0) return [];
    const arrows: [string, string, string][] = [];
    const pv0 = posLines[0]?.pv[0];
    if (pv0 && pv0.length >= 4)
      arrows.push([pv0.slice(0, 2), pv0.slice(2, 4), "rgba(210, 115, 0, 0.90)"]);
    const pv1 = posLines[1]?.pv[0];
    if (pv1 && pv1.length >= 4)
      arrows.push([pv1.slice(0, 2), pv1.slice(2, 4), "rgba(255, 185, 75, 0.80)"]);
    return arrows;
  }, [showAnalysis, showArrows, posLines]);

  const isNavigatingPast = boardIndex < maxBoardIndex;
  const needsReview = game?.status === "needs_review" || isNavigatingPast;
  // In analysis mode: board is read-only to protect the original PGN
  const boardInputEnabled = needsReview && !showAnalysis;
  const canAnalyze =
    game?.status === "completed" &&
    !isResuming &&
    !!(pgnText || game?.pgn);
  const hasMultipleSheets =
    Array.isArray(game?.imageUrls) && game.imageUrls.length > 1;

  const currentVisiblePlyCount = maxBoardIndex;

  const expectedLiveTurn = useMemo(() => {
    if (isNavigatingPast) {
      return getExpectedTurnFromPlyCount(boardIndex);
    }

    if (game?.status === "needs_review") {
      return getExpectedTurnFromPlyCount(boardIndex);
    }

    return getExpectedTurnFromPlyCount(currentVisiblePlyCount);
  }, [isNavigatingPast, boardIndex, currentVisiblePlyCount, game?.status]);

  const expectedBoardTurn = useMemo(() => {
    return getExpectedTurnFromPlyCount(boardIndex);
  }, [boardIndex]);

  const physicalReviewRow = useMemo(() => {
    if (!game) return null;

    const blockedRow =
      typeof game?.reviewState?.blockedRow === "number"
        ? game.reviewState.blockedRow
        : null;

    if (blockedRow == null) return null;

    const anchorRow = game.ocr?.rows?.find((r: any) => r.row === blockedRow);
    const rowsPerSheet = getRowsPerSheetFromGame(game);

    const anchorOriginalRow =
      anchorRow && typeof anchorRow.originalRow === "number"
        ? anchorRow.originalRow
        : ((blockedRow - 1) % rowsPerSheet) + 1;

    const anchorSheet =
      anchorRow && typeof anchorRow.sheet === "number"
        ? anchorRow.sheet
        : typeof game.reviewState.blockedSheet === "number"
          ? game.reviewState.blockedSheet
          : Math.floor((blockedRow - 1) / rowsPerSheet);

    if (isNavigatingPast) {
      const anchorMoveNumber = expectedLiveTurn.moveNumber;
      const targetMoveNumber = expectedBoardTurn.moveNumber;
      const delta = targetMoveNumber - anchorMoveNumber;

      return {
        row: blockedRow + delta,
        sheet: anchorSheet,
        originalRow: anchorOriginalRow + delta,
      };
    }

    return {
      row: blockedRow,
      sheet: anchorSheet,
      originalRow: anchorOriginalRow,
    };
  }, [
    game,
    isNavigatingPast,
    expectedLiveTurn.moveNumber,
    expectedBoardTurn.moveNumber,
    game?.reviewState?.blockedRow,
    game?.reviewState?.blockedSheet,
  ]);

  const blockedLocalMoveNumber = physicalReviewRow?.originalRow ?? null;

  const displayedSheetIndex = getDisplayedSheetIndex(game, needsReview);

  const totalSheets =
    Array.isArray(game?.imageUrls) && game.imageUrls.length > 0
      ? game.imageUrls.length
      : 1;

  const currentSheetIndex = (() => {
    if (sheetOverride == null) return displayedSheetIndex;
    if (sheetOverride < 0) return 0;
    if (sheetOverride > totalSheets - 1) return totalSheets - 1;
    return sheetOverride;
  })();

  useEffect(() => {
    setSheetOverride(null);
  }, [game?.id, displayedSheetIndex]);

  const displayedImageUrl =
    Array.isArray(game?.imageUrls) && game.imageUrls[currentSheetIndex]
      ? game.imageUrls[currentSheetIndex]
      : game?.imageUrl;

  const getStatusText = () => {
    if (isResuming) return t.continuing;
    if (!game?.status) return "";
    return t.statusLabels[game.status] ?? game.status;
  };

  const handleMoveFromBoard = async ({
    from,
    to,
    promotion,
    undoIndex,
  }: {
    from: string;
    to: string;
    promotion?: string;
    undoIndex?: number;
  }) => {
    if (!game) return;
    if (!game.reviewState?.fen && !isNavigatingPast) return;

    setIsResuming(true);
    setHideQuestionUI(true);
    setBoardIndex(maxBoardIndex);

    const finalUndoIndex = undoIndex !== undefined ? undoIndex : boardIndex;

    try {
      await reviewGame.mutateAsync({
        id,
        moveFrom: from,
        moveTo: to,
        promotion,
        undoIndex: finalUndoIndex,
      });

      toast({
        title: t.moveAppliedTitle,
        description: t.moveAppliedDescription,
        duration: 1500,
      });
    } catch (e) {
      toast({
        title: t.applyMoveErrorTitle,
        description: e instanceof Error ? e.message : t.resumeErrorFallback,
        variant: "destructive",
      });
    } finally {
      setIsResuming(false);
    }
  };

  // Record a sandbox variant move — ChessboardViewer has already validated the
  // move and computed the next FEN; we just set state here, no re-validation.
  const handleSandboxMove = (payload: {
    fen: string;
    san: string;
    uci: string;
    from: string;
    to: string;
    promotion?: string;
  }) => {
    DEBUG_SANDBOX && console.log("[sandbox parent received]", payload);
    // First move of a new variant → snapshot the real-game ply for clearSandbox.
    if (!isSandboxActive) {
      setSandboxBasePly(boardIndex);
      DEBUG_SANDBOX && console.log("[sandbox basePly saved]", boardIndex);
    }
    // Branch-cut: if we're not at the tip, discard future moves and start new branch.
    setSandboxFens((prev) => [...prev.slice(0, sandboxIndex + 1), payload.fen]);
    setSandboxMoves((prev) => [...prev.slice(0, sandboxIndex + 1), payload.san]);
    setSandboxIndex((i) => i + 1);
    DEBUG_SANDBOX && console.log("[sandbox parent set]", { fen: payload.fen, san: payload.san });
  };

  const handleSandboxPrev = () => {
    setSandboxIndex((i) => Math.max(0, i - 1));
  };

  const handleSandboxNext = () => {
    setSandboxIndex((i) => Math.min(sandboxFens.length - 1, i + 1));
  };

  const clearSandbox = () => {
    // Jump back to the exact ply where the variant started.
    // jumpSignal uses a fresh counter so ChessboardViewer processes it even
    // if the ply value happens to equal the current internal index.
    const targetPly = sandboxBasePly ?? boardIndex;
    setJumpSignal({ index: targetPly, counter: Date.now() });
    DEBUG_SANDBOX && console.log("[sandbox clearSandbox] jumping back to ply", targetPly);
    resetSandboxState();
  };

  useEffect(() => {
    if (game?.pgn && !isEditing) {
      setPgnText(game.pgn);
    }

    if (game?.status !== "processing" && isResuming === false) {
      setHideQuestionUI(false);
    }
  }, [game?.pgn, game?.status, isResuming, isEditing]);

  const handleSave = async () => {
    try {
      await updateGame.mutateAsync({ id, pgn: pgnText, status: "completed" });
      setIsEditing(false);
      toast({
        title: t.changesSavedTitle,
        description: t.changesSavedDescription,
      });
    } catch (e) {
      toast({
        title: t.genericErrorTitle,
        description: String(e),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-bold">{t.gameNotFound}</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-white/50 backdrop-blur-md z-10">
        <div className={`max-w-7xl mx-auto px-4 flex items-center justify-between transition-all ${showAnalysis ? "h-10" : "h-16"}`}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>

            {!showAnalysis && (
              <h1 className="font-display font-bold text-xl hidden sm:block">
                {t.gameTitle(game.id)}
              </h1>
            )}

            {!showAnalysis && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium border truncate max-w-[45vw] sm:max-w-none ${
                  game.status === "completed" && !isResuming
                    ? "bg-green-100 text-green-700 border-green-200"
                    : game.status === "failed"
                      ? "bg-red-100 text-red-700 border-red-200"
                      : game.status === "needs_review"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-blue-100 text-blue-700 border-blue-200 animate-pulse"
                }`}
              >
                {getStatusText()}
              </span>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  {t.cancel}
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  {t.save}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={game.status === "processing" || isResuming}
              >
                {t.editPgn}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full pt-2 px-4 pb-4 flex flex-col gap-1">

        {/* Stockfish 18 pill — shown when analysis is active */}
        {showAnalysis && (
          <div className="flex items-center justify-center py-1">
            <span
              data-testid="badge-analysis-stockfish"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
            >
              {t.analysisWithStockfish}
            </span>
          </div>
        )}

        {/* ── Shared header bar — hidden in analysis mode (controls move to sidebar) */}
        {!showAnalysis && (
          <div className="flex items-stretch gap-8">
            {/* Left placeholder — desktop only */}
            <div className="hidden lg:block flex-1" />
            {/* Right section: Analitzar centred + Veure planella pinned right */}
            <div className="flex-1 flex items-center justify-end gap-2 min-h-[30px] lg:relative lg:justify-center">
              {canAnalyze && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    posStop();
                    setShowAnalysis(true);
                    setJumpSignal({ index: 0, counter: Date.now() });
                  }}
                  data-testid="button-analyze-game"
                  className="mr-auto gap-1.5 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 lg:mr-0"
                >
                  <TrendingUp className="w-4 h-4" />
                  {t.analyze}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="lg:hidden shrink-0"
                onClick={() => setShowSheetMobile((v) => !v)}
                data-testid="button-toggle-scoresheet-mobile"
              >
                {showSheetMobile ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    {t.hideScoresheet}
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    {t.showScoresheet}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── 2-col content grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">

          <div
            className={`${
              showSheetMobile ? "block" : "hidden"
            } lg:block bg-muted/20 border border-border rounded-xl overflow-hidden h-[60vh] lg:h-[600px] relative`}
          >
            {displayedImageUrl ? (
              <img
                src={displayedImageUrl}
                alt={t.originalScoresheet}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                {t.imageUnavailable}
              </div>
            )}
          </div>

          {hasMultipleSheets ? (
            <div
              className={`${
                showSheetMobile ? "flex" : "hidden"
              } lg:flex items-center justify-between gap-2`}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentSheetIndex <= 0}
                onClick={() => setSheetOverride(currentSheetIndex - 1)}
                aria-label={t.previousSheet}
                data-testid="button-prev-sheet"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span
                className="text-xs text-muted-foreground"
                data-testid="text-sheet-counter"
              >
                {t.sheetCounter(currentSheetIndex + 1, totalSheets)}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentSheetIndex >= totalSheets - 1}
                onClick={() => setSheetOverride(currentSheetIndex + 1)}
                aria-label={t.nextSheet}
                data-testid="button-next-sheet"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : null}

          {needsReview && hasMultipleSheets ? (
            <p
              className={`${
                showSheetMobile ? "block" : "hidden"
              } lg:block text-xs text-muted-foreground`}
            >
              {t.showingSheet(currentSheetIndex + 1)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 flex flex-col relative">
          {(game.status === "processing" || isResuming) && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm rounded-xl">
              <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2">{t.processingTitle}</h3>
              <p className="text-muted-foreground">{t.validatingMoves}</p>
            </div>
          )}

          {!hideQuestionUI &&
            game.status === "needs_review" &&
            !isNavigatingPast && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm space-y-2">
                <h4 className="text-sm font-bold text-amber-900">
                  {t.nextExpectedMove(
                    expectedLiveTurn.moveNumber,
                    expectedLiveTurn.side,
                  )}
                </h4>

                <p className="text-sm text-amber-800">
                  {t.makeCorrectMoveOnBoard}
                </p>

                {hasMultipleSheets && displayedSheetIndex > 0 && (
                  <p className="text-xs text-amber-700">
                    {t.reviewSheetRow(
                      displayedSheetIndex + 1,
                      blockedLocalMoveNumber,
                    )}
                  </p>
                )}
              </div>
            )}

          {!hideQuestionUI && isNavigatingPast && !showAnalysis && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <Undo2 className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-bold">
                  {t.reviewingBeforeMove(
                    expectedBoardTurn.moveNumber,
                    expectedBoardTurn.side,
                  )}
                </p>
                <p className="text-xs text-blue-700 mt-1">{t.reviewingHelp}</p>
              </div>
            </div>
          )}

          {/* ── Board section ──────────────────────────────────────────────── */}
          <div className="space-y-2">

            {/* Variant indicator + Stockfish lines — above the board row, full width.
                Kept outside the flex row so the sidebar aligns exactly with the board. */}
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

            {showAnalysis && (
              <div
                className="h-[52px] space-y-0.5 bg-muted/30 rounded-lg px-3 py-1.5 overflow-hidden w-full"
                data-testid="analysis-lines"
              >
                {posLines.length > 0 ? (
                  posLines.map((line, i) => {
                    const san = pvToSan(activeFen, line.pv);
                    const display = sanToDisplay(san, scoresheetLanguage);
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

            {/* Board + sidebar — this flex row has no lines above it so the
                sidebar min-h aligns exactly with the board height. */}
            <div className="flex items-start gap-3">

              {/* Board column */}
              <div className="flex-1 min-w-0">
                <ChessboardViewer
                  pgn={pgnText || game.pgn || ""}
                  error={game.status === "failed" ? (game.error ?? null) : null}
                  syncToken={`${game.updatedAt ?? ""}:${game.status ?? ""}:${
                    game.reviewState?.blockedRow ?? ""
                  }:${game.reviewState?.blockedSide ?? ""}`}
                  enableInput={boardInputEnabled}
                  onMove={handleMoveFromBoard}
                  onMoveIndexChange={(idx, maxIdx) => {
                    setBoardIndex(idx);
                    setMaxBoardIndex(maxIdx);
                  }}
                  boardOrientation={boardOrientation}
                  onOrientationChange={setBoardOrientation}
                  appLanguage={appLanguage}
                  scoresheetLanguage={scoresheetLanguage}
                  customArrows={customArrows}
                  jumpSignal={jumpSignal}
                  lockToEnd={!showAnalysis}
                  enableAnalysisSandbox={showAnalysis}
                  sandboxFen={showAnalysis ? currentSandboxFen : null}
                  onSandboxMove={showAnalysis ? handleSandboxMove : undefined}
                  onSandboxPrev={showAnalysis && isSandboxActive ? handleSandboxPrev : undefined}
                  onSandboxNext={showAnalysis && isSandboxActive ? handleSandboxNext : undefined}
                  sandboxCanPrev={sandboxCanPrev}
                  sandboxCanNext={sandboxCanNext}
                  evalBar={
                    showAnalysis ? (
                      <div className="flex items-stretch h-full gap-1">
                        {/* Score text — vertically centred left of bar */}
                        <div className="flex items-center justify-center">
                          <span className="text-[10px] font-mono font-semibold tabular-nums leading-none w-7 text-center">
                            {posStatus === "analyzing" && !evalString ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : (
                              evalString
                            )}
                          </span>
                        </div>
                        {/* Color bar — flex-grow segments avoid % height issue */}
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
                    ) : undefined
                  }
                />
              </div>

              {/* Lateral button column — only visible in analysis mode */}
              {showAnalysis && (
                <div className="shrink-0 flex flex-col justify-between w-[148px] min-h-[460px]">
                  {/* Top cluster: arrows toggle + scoresheet toggle.
                      Grouped so they sit together at the top; gap-3 gives
                      enough space to avoid misclicks. */}
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight"
                      onClick={() => setShowArrows((v) => !v)}
                      data-testid="button-toggle-arrows-sidebar"
                    >
                      {showArrows ? (
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{showArrows ? t.hideArrows : t.showArrows}</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight"
                      onClick={() => setShowSheetMobile((v) => !v)}
                      data-testid="button-toggle-scoresheet-sidebar"
                    >
                      {showSheetMobile ? (
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {showSheetMobile ? t.hideScoresheet : t.showScoresheet}
                      </span>
                    </Button>
                  </div>

                  {/* Middle: Tornar a la partida — only when sandbox is active */}
                  {isSandboxActive && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight"
                      onClick={clearSandbox}
                      data-testid="button-return-to-game"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.returnToGame}</span>
                    </Button>
                  )}

                  {/* Bottom: Sortir d'anàlisi — aligned to board rank 1 */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-1.5 text-xs h-auto py-1.5 leading-tight"
                    onClick={() => { setShowAnalysis(false); posStop(); }}
                    data-testid="button-hide-analysis-sidebar"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.hideAnalysis}</span>
                  </Button>
                </div>
              )}

            </div>

          </div>

          <PgnActions
            pgn={pgnText || game.pgn || ""}
            gameId={game.id}
            appLanguage={appLanguage}
            imageUrls={game?.imageUrls ?? []}
            className="lg:hidden"
          />

          <div className="hidden lg:block space-y-2">
            <PgnActions
              pgn={pgnText || game.pgn || ""}
              gameId={game.id}
              appLanguage={appLanguage}
              imageUrls={game?.imageUrls ?? []}
            />

            <h3 className="font-semibold text-sm">{t.pgnTitle}</h3>

            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              disabled={!isEditing}
              className="w-full h-32 p-4 rounded-lg font-mono text-xs border"
            />
          </div>
        </div>
        </div>{/* end content grid */}
      </main>

      <LicensesDialog
        open={showLicenses}
        onOpenChange={setShowLicenses}
        t={{
          title: t.licensesTitle,
          stockfish: t.licensesStockfish,
          pythonChess: t.licensesPythonChess,
          openSource: t.licensesOpenSource,
          gemini: t.licensesGemini,
          trademarks: t.licensesTrademarks,
          close: t.licensesClose,
        }}
      />
    </div>
  );
}
