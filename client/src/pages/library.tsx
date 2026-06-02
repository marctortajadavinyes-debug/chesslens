import { useState, useCallback } from "react";
import { Link } from "wouter";
import { CloudDownload, RefreshCw, ArrowLeft, Loader2, FolderOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDriveLibrary } from "@/hooks/use-drive-library";
import { DriveGameViewer } from "@/components/drive-game-viewer";
import { useToast } from "@/hooks/use-toast";
import type { DriveGameFile } from "@/lib/google-drive";

type AppLanguage = "ca" | "en" | "es";

const SETTINGS_KEY = "chesslens_user_settings_v1";

function readAppLanguage(): AppLanguage {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "ca";
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "appLanguage" in parsed) {
      const lang = (parsed as { appLanguage: unknown }).appLanguage;
      if (lang === "en" || lang === "es") return lang;
    }
    return "ca";
  } catch {
    return "ca";
  }
}

type PageText = {
  title: string;
  subtitle: string;
  back: string;
  connect: string;
  refresh: string;
  loading: string;
  empty: string;
  emptyHint: string;
  errorTitle: string;
  white: string;
  black: string;
  date: string;
  result: string;
  opponent: string;
  userColor: string;
  colorWhite: string;
  colorBlack: string;
  movesWhite: string;
  movesBlack: string;
  file: string;
  me: string;
  loadingGame: string;
  gameLoadError: string;
};

const TEXT: Record<AppLanguage, PageText> = {
  ca: {
    title: "Les meves partides",
    subtitle: "Partides guardades a Google Drive · carpeta Chess Games",
    back: "Tornar",
    connect: "Connectar amb Google Drive",
    refresh: "Actualitzar",
    loading: "Carregant partides...",
    empty: "Cap partida a Drive",
    emptyHint: "Guarda partides des de la pantalla principal per veure-les aquí.",
    errorTitle: "Error carregant les partides",
    white: "Blanques",
    black: "Negres",
    date: "Data",
    result: "Resultat",
    opponent: "Rival",
    userColor: "Color",
    colorWhite: "Blanques",
    colorBlack: "Negres",
    movesWhite: "Blanques comencen amb",
    movesBlack: "Negres responen amb",
    file: "Fitxer",
    me: "Jo",
    loadingGame: "Carregant partida...",
    gameLoadError: "Error carregant la partida",
  },
  en: {
    title: "My games",
    subtitle: "Games saved to Google Drive · Chess Games folder",
    back: "Back",
    connect: "Connect with Google Drive",
    refresh: "Refresh",
    loading: "Loading games...",
    empty: "No games on Drive",
    emptyHint: "Save games from the home screen to see them here.",
    errorTitle: "Error loading games",
    white: "White",
    black: "Black",
    date: "Date",
    result: "Result",
    opponent: "Opponent",
    userColor: "Color",
    colorWhite: "White",
    colorBlack: "Black",
    movesWhite: "White starts with",
    movesBlack: "Black replies with",
    file: "File",
    me: "Me",
    loadingGame: "Loading game...",
    gameLoadError: "Error loading game",
  },
  es: {
    title: "Mis partidas",
    subtitle: "Partidas guardadas en Google Drive · carpeta Chess Games",
    back: "Volver",
    connect: "Conectar con Google Drive",
    refresh: "Actualizar",
    loading: "Cargando partidas...",
    empty: "No hay partidas en Drive",
    emptyHint: "Guarda partidas desde la pantalla principal para verlas aquí.",
    errorTitle: "Error al cargar las partidas",
    white: "Blancas",
    black: "Negras",
    date: "Fecha",
    result: "Resultado",
    opponent: "Rival",
    userColor: "Color",
    colorWhite: "Blancas",
    colorBlack: "Negras",
    movesWhite: "Blancas empiezan con",
    movesBlack: "Negras responden con",
    file: "Archivo",
    me: "Yo",
    loadingGame: "Cargando partida...",
    gameLoadError: "Error al cargar la partida",
  },
};

function colorBadgeLabel(
  t: PageText,
  userColor: string,
): string | null {
  if (userColor === "white") return t.colorWhite;
  if (userColor === "black") return t.colorBlack;
  return null;
}

function GameCard({
  file,
  t,
  onOpen,
  isLoading,
}: {
  file: DriveGameFile;
  t: PageText;
  onOpen: () => void;
  isLoading: boolean;
}) {
  const p = file.appProperties;
  const white = p.white ?? "";
  const black = p.black ?? "";
  const date = p.date ?? "";
  const result = p.result ?? "";
  const opponent = p.opponent ?? "";
  const userColor = p.userColor ?? "";
  const firstWhiteMoves = p.firstWhiteMoves ?? "";
  const firstBlackMoves = p.firstBlackMoves ?? "";

  const hasMetadata = white || black || date || result;

  return (
    <div
      className="rounded-xl border bg-card p-4 space-y-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors relative select-none"
      data-testid={`card-drive-game-${file.id}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 rounded-xl bg-background/70 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t.loadingGame}</span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {hasMetadata ? (
            <p className="font-semibold text-sm leading-snug truncate">
              {white || "?"}{" "}
              <span className="text-muted-foreground font-normal">vs</span>{" "}
              {black || "?"}
            </p>
          ) : (
            <p className="font-semibold text-sm leading-snug truncate text-muted-foreground">
              {file.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {result && (
            <Badge variant="outline" className="text-xs" data-testid={`badge-result-${file.id}`}>
              {result}
            </Badge>
          )}
          {userColor && colorBadgeLabel(t, userColor) && (
            <Badge variant="secondary" className="text-xs" data-testid={`badge-color-${file.id}`}>
              {t.me} · {colorBadgeLabel(t, userColor)}
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
        </div>
      </div>

      {/* Details grid */}
      {hasMetadata && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {date && (
            <>
              <span className="font-medium text-foreground">{t.date}</span>
              <span data-testid={`text-date-${file.id}`}>{date}</span>
            </>
          )}
          {opponent && (
            <>
              <span className="font-medium text-foreground">{t.opponent}</span>
              <span data-testid={`text-opponent-${file.id}`}>{opponent}</span>
            </>
          )}
          {firstWhiteMoves && (
            <>
              <span className="font-medium text-foreground">{t.movesWhite}</span>
              <span className="font-mono" data-testid={`text-wmoves-${file.id}`}>
                {firstWhiteMoves.split(",").filter(Boolean).join(", ")}…
              </span>
            </>
          )}
          {firstBlackMoves && (
            <>
              <span className="font-medium text-foreground">{t.movesBlack}</span>
              <span className="font-mono" data-testid={`text-bmoves-${file.id}`}>
                {firstBlackMoves.split(",").filter(Boolean).join(", ")}…
              </span>
            </>
          )}
        </div>
      )}

      {/* Filename (when metadata present) */}
      {hasMetadata && (
        <p
          className="text-[11px] text-muted-foreground/60 truncate"
          data-testid={`text-filename-${file.id}`}
        >
          {file.name}
        </p>
      )}
    </div>
  );
}

export default function Library() {
  const [appLanguage] = useState<AppLanguage>(() => readAppLanguage());
  const t = TEXT[appLanguage] ?? TEXT.ca;
  const { toast } = useToast();

  const { files, loading, error, connected, connectAndLoad, refresh, loadPgnContent } =
    useDriveLibrary();

  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [viewerFile, setViewerFile] = useState<DriveGameFile | null>(null);
  const [viewerPgn, setViewerPgn] = useState<string | null>(null);

  const handleOpenGame = useCallback(
    async (file: DriveGameFile) => {
      if (loadingFileId) return; // already loading something
      setLoadingFileId(file.id);
      const result = await loadPgnContent(file);
      setLoadingFileId(null);
      if (result.ok) {
        setViewerFile(file);
        setViewerPgn(result.pgn);
      } else {
        toast({
          title: t.gameLoadError,
          description: result.error,
          variant: "destructive",
        });
      }
    },
    [loadingFileId, loadPgnContent, t.gameLoadError, toast],
  );

  const handleCloseViewer = useCallback(() => {
    setViewerFile(null);
    setViewerPgn(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button type="button" variant="ghost" size="sm" data-testid="button-library-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.back}
              </Button>
            </Link>
            <span className="text-sm font-semibold">{t.title}</span>
          </div>

          {connected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              data-testid="button-library-refresh"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {t.refresh}
            </Button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>

        {/* Connect button (pre-connect state) */}
        {!connected && !loading && (
          <Button
            type="button"
            onClick={connectAndLoad}
            data-testid="button-library-connect"
            className="gap-2"
          >
            <CloudDownload className="w-4 h-4" />
            {t.connect}
          </Button>
        )}

        {/* Loading */}
        {loading && (
          <div
            className="flex items-center gap-3 text-muted-foreground py-12 justify-center"
            data-testid="library-loading"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">{t.loading}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive space-y-1"
            data-testid="library-error"
          >
            <p className="font-semibold">{t.errorTitle}</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Games list */}
        {connected && !loading && !error && files.length > 0 && (
          <div className="space-y-3" data-testid="library-game-list">
            {files.map((file) => (
              <GameCard
                key={file.id}
                file={file}
                t={t}
                onOpen={() => handleOpenGame(file)}
                isLoading={loadingFileId === file.id}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {connected && !loading && !error && files.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground"
            data-testid="library-empty"
          >
            <FolderOpen className="w-12 h-12 opacity-30" />
            <p className="font-medium text-sm">{t.empty}</p>
            <p className="text-xs max-w-xs">{t.emptyHint}</p>
          </div>
        )}
      </main>

      {/* Game viewer */}
      {viewerFile && viewerPgn !== null && (
        <DriveGameViewer
          file={viewerFile}
          pgn={viewerPgn}
          appLanguage={appLanguage}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}
