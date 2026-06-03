import { useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGame, useReviewGame, useUpdateGame } from "@/hooks/use-games";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { PgnActions } from "@/components/pgn-actions";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Undo2,
  Image as ImageIcon,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppLanguage } from "@shared/schema";

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
      "Fes ara la jugada correcta al tauler i ChessLens continuarà l'escaneig des d'aquí.",
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
      "Now make the correct move on the board and ChessLens will continue the scan from here.",
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
      "Haz ahora la jugada correcta en el tablero y ChessLens continuará el escaneo desde aquí.",
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
  },
};

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

  const isNavigatingPast = boardIndex < maxBoardIndex;
  const needsReview = game?.status === "needs_review" || isNavigatingPast;
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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>

            <h1 className="font-display font-bold text-xl hidden sm:block">
              {t.gameTitle(game.id)}
            </h1>

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

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 lg:block">
            <h2 className="font-semibold text-lg">{t.originalScoresheet}</h2>

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

        <div className="space-y-6 flex flex-col min-h-[600px] relative">
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

          {!hideQuestionUI && isNavigatingPast && (
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

          <ChessboardViewer
            pgn={pgnText || game.pgn || ""}
            error={game.status === "failed" ? (game.error ?? null) : null}
            syncToken={`${game.updatedAt ?? ""}:${game.status ?? ""}:${
              game.reviewState?.blockedRow ?? ""
            }:${game.reviewState?.blockedSide ?? ""}`}
            enableInput={needsReview}
            onMove={handleMoveFromBoard}
            onMoveIndexChange={(idx, maxIdx) => {
              setBoardIndex(idx);
              setMaxBoardIndex(maxIdx);
            }}
            boardOrientation={boardOrientation}
            onOrientationChange={setBoardOrientation}
            appLanguage={appLanguage}
            scoresheetLanguage={scoresheetLanguage}
          />

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
      </main>
    </div>
  );
}
