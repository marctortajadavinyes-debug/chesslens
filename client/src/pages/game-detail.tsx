import { useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGame, useReviewGame, useUpdateGame } from "@/hooks/use-games";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { ArrowLeft, Save, RefreshCw, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function GameDetail() {
  const [, params] = useRoute("/games/:id");
  const id = parseInt(params?.id || "0", 10);

  const { data: game, isLoading, error } = useGame(id);
  const updateGame = useUpdateGame();
  const reviewGame = useReviewGame();
  const { toast } = useToast();

  const [pgnText, setPgnText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [hideQuestionUI, setHideQuestionUI] = useState(false);

  const [boardIndex, setBoardIndex] = useState<number>(0);
  const [maxBoardIndex, setMaxBoardIndex] = useState<number>(0);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white",
  );

  const isNavigatingPast = boardIndex < maxBoardIndex;
  const needsReview = game?.status === "needs_review" || isNavigatingPast;
  const hasMultipleSheets =
    Array.isArray(game?.imageUrls) && game.imageUrls.length > 1;

  const currentVisiblePlyCount = maxBoardIndex;

  const expectedLiveTurn = useMemo(() => {
    return getExpectedTurnFromPlyCount(currentVisiblePlyCount);
  }, [currentVisiblePlyCount]);

  const blockedLocalMoveNumber = useMemo(() => {
    if (!game?.reviewState?.blockedRow) return null;

    const blockedRow = game.reviewState.blockedRow;

    const matchedRow = Array.isArray(game?.ocr?.rows)
      ? game.ocr.rows.find((r: any) => r.row === blockedRow)
      : null;

    if (matchedRow && typeof matchedRow.originalRow === "number") {
      return matchedRow.originalRow;
    }

    return ((blockedRow - 1) % 75) + 1;
  }, [game?.reviewState?.blockedRow, game?.ocr?.rows]);

  const expectedBoardTurn = useMemo(() => {
    return getExpectedTurnFromPlyCount(boardIndex);
  }, [boardIndex]);

  const displayedSheetIndex = getDisplayedSheetIndex(game, needsReview);

  const displayedImageUrl =
    Array.isArray(game?.imageUrls) && game.imageUrls[displayedSheetIndex]
      ? game.imageUrls[displayedSheetIndex]
      : game?.imageUrl;

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
        title: "Jugada aplicada",
        description: "Continuem l'escaneig des d'aquesta posició.",
      });
    } catch (e) {
      toast({
        title: "Error en aplicar la jugada",
        description: e instanceof Error ? e.message : "No s'ha pogut reprendre",
        variant: "destructive",
      });
    } finally {
      setIsResuming(false);
    }
  };

  useEffect(() => {
    if (game?.pgn && !isEditing && !isResuming) {
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
        title: "Canvis desats",
        description: "El PGN s'ha actualitzat.",
      });
    } catch (e) {
      toast({
        title: "Error",
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
        <h1 className="text-2xl font-bold">Partida no trobada</h1>
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
              Partida #{game.id}
            </h1>

            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                game.status === "completed" && !isResuming
                  ? "bg-green-100 text-green-700 border-green-200"
                  : game.status === "failed"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : game.status === "needs_review"
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-blue-100 text-blue-700 border-blue-200 animate-pulse"
              }`}
            >
              {isResuming
                ? "Continuant..."
                : game.status === "needs_review"
                  ? "Revisió necessària"
                  : game.status}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel·lar
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Desar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={game.status === "processing" || isResuming}
              >
                Editar PGN
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4 hidden lg:block">
          <h2 className="font-semibold text-lg">Planella original</h2>

          <div className="bg-muted/20 border border-border rounded-xl overflow-hidden h-[600px] relative">
            {displayedImageUrl ? (
              <img
                src={displayedImageUrl}
                alt="Planella"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                Imatge no disponible
              </div>
            )}
          </div>

          {needsReview && hasMultipleSheets ? (
            <p className="text-xs text-muted-foreground">
              Mostrant planella {displayedSheetIndex + 1}
            </p>
          ) : null}
        </div>

        <div className="space-y-6 flex flex-col min-h-[600px] relative">
          {(game.status === "processing" || isResuming) && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm rounded-xl">
              <RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2">Processant</h3>
              <p className="text-muted-foreground">Validant jugades...</p>
            </div>
          )}

          {!hideQuestionUI &&
            game.status === "needs_review" &&
            !isNavigatingPast && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm space-y-2">
                <h4 className="text-sm font-bold text-amber-900">
                  Següent moviment esperat: {expectedLiveTurn.moveNumber}{" "}
                  {expectedLiveTurn.side === "w" ? "blanques" : "negres"}
                </h4>

                <p className="text-sm text-amber-800">
                  Fes la jugada correcta directament sobre el tauler per
                  continuar l'escaneig.
                </p>

                {hasMultipleSheets && (
                  <p className="text-xs text-amber-700">
                    Revisa la planella {displayedSheetIndex + 1}
                    {blockedLocalMoveNumber != null
                      ? ` · moviment ${blockedLocalMoveNumber}`
                      : ""}
                    .
                  </p>
                )}
              </div>
            )}

          {!hideQuestionUI && isNavigatingPast && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <Undo2 className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-bold">
                  Estàs revisant la posició abans del moviment{" "}
                  {expectedBoardTurn.moveNumber}{" "}
                  {expectedBoardTurn.side === "w" ? "blanques" : "negres"}.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Fes ara la jugada correcta al tauler i ChessLens continuarà
                  l'escaneig des d'aquí.
                </p>
              </div>
            </div>
          )}

          <ChessboardViewer
            pgn={pgnText}
            error={game.error ?? null}
            enableInput={needsReview}
            onMove={handleMoveFromBoard}
            onMoveIndexChange={(idx, maxIdx) => {
              setBoardIndex(idx);
              setMaxBoardIndex(maxIdx);
            }}
            boardOrientation={boardOrientation}
            onOrientationChange={setBoardOrientation}
          />

          <div className="hidden lg:block space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">PGN</h3>
              <span className="text-xs text-muted-foreground">
                Visible només en escriptori
              </span>
            </div>

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
