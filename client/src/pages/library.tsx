import { useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  CloudDownload,
  RefreshCw,
  ArrowLeft,
  Loader2,
  FolderOpen,
  ChevronRight,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// ── Text ────────────────────────────────────────────────────────────────────

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
  // Filters
  filters: string;
  clearFilters: string;
  filterOpponent: string;
  filterDateFrom: string;
  filterDateTo: string;
  filterColor: string;
  filterColorAll: string;
  filterColorWhiteOption: string;
  filterColorBlackOption: string;
  filterDateError: string;
  filterResult: string;
  filterResultAll: string;
  filterWhiteMoves: string;
  filterBlackMoves: string;
  gamesSuffix: string;
  noFilteredResults: string;
  noFilteredHint: string;
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
    filters: "Filtres",
    clearFilters: "Netejar filtres",
    filterOpponent: "Jugador o rival",
    filterDateFrom: "Data des de",
    filterDateTo: "Data fins a",
    filterColor: "El meu color",
    filterColorAll: "Tots",
    filterColorWhiteOption: "Jo amb blanques",
    filterColorBlackOption: "Jo amb negres",
    filterDateError: "Format no vàlid. Utilitza AAAA-MM-DD",
    filterResult: "Resultat",
    filterResultAll: "Tots",
    filterWhiteMoves: "Blanques comencen amb",
    filterBlackMoves: "Negres responen amb",
    gamesSuffix: "partides",
    noFilteredResults: "Cap partida amb aquests filtres",
    noFilteredHint: "Prova de canviar o netejar els filtres.",
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
    filters: "Filters",
    clearFilters: "Clear filters",
    filterOpponent: "Player or opponent",
    filterDateFrom: "Date from",
    filterDateTo: "Date to",
    filterColor: "My color",
    filterColorAll: "All",
    filterColorWhiteOption: "I played White",
    filterColorBlackOption: "I played Black",
    filterDateError: "Invalid format. Use YYYY-MM-DD",
    filterResult: "Result",
    filterResultAll: "All",
    filterWhiteMoves: "White starts with",
    filterBlackMoves: "Black replies with",
    gamesSuffix: "games",
    noFilteredResults: "No games match these filters",
    noFilteredHint: "Try changing or clearing the filters.",
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
    filters: "Filtros",
    clearFilters: "Limpiar filtros",
    filterOpponent: "Jugador o rival",
    filterDateFrom: "Fecha desde",
    filterDateTo: "Fecha hasta",
    filterColor: "Mi color",
    filterColorAll: "Todos",
    filterColorWhiteOption: "Yo con blancas",
    filterColorBlackOption: "Yo con negras",
    filterDateError: "Formato no válido. Usa AAAA-MM-DD",
    filterResult: "Resultado",
    filterResultAll: "Todos",
    filterWhiteMoves: "Blancas empiezan con",
    filterBlackMoves: "Negras responden con",
    gamesSuffix: "partidas",
    noFilteredResults: "Ninguna partida coincide con estos filtros",
    noFilteredHint: "Prueba a cambiar o limpiar los filtros.",
  },
};

// ── Filter types & helpers ───────────────────────────────────────────────────

interface Filters {
  opponent: string;
  dateFrom: string;
  dateTo: string;
  userColor: "" | "white" | "black";
  result: "" | "*" | "1-0" | "0-1" | "1/2-1/2";
  whiteMoves: string;
  blackMoves: string;
}

const EMPTY_FILTERS: Filters = {
  opponent: "",
  dateFrom: "",
  dateTo: "",
  userColor: "",
  result: "",
  whiteMoves: "",
  blackMoves: "",
};

function hasActiveFilters(f: Filters): boolean {
  return !!(
    f.opponent ||
    f.dateFrom ||
    f.dateTo ||
    f.userColor ||
    f.result ||
    f.whiteMoves ||
    f.blackMoves
  );
}

/** Lowercase + remove common diacritics for fuzzy matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Parse a move query like "e4 Nf3", "e4,Nf3", "e4, d5" into tokens.
 * Split on whitespace and/or commas.
 */
function parseMoveQuery(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map((s) => normalize(s.trim()))
    .filter(Boolean);
}

/**
 * Check if the stored CSV move sequence starts with all query tokens.
 * Each query token is matched as a prefix/substring of the corresponding stored token.
 */
function matchMoves(csvMoves: string, query: string): boolean {
  if (!query.trim()) return true;
  const queryTokens = parseMoveQuery(query);
  if (queryTokens.length === 0) return true;
  const stored = csvMoves.split(",").filter(Boolean).map(normalize);
  for (let i = 0; i < queryTokens.length; i++) {
    if (!stored[i]?.includes(queryTokens[i])) return false;
  }
  return true;
}

/** Returns true if dateStr is empty (allowed) or is a valid YYYY-MM-DD date. */
function isValidDate(s: string): boolean {
  if (!s.trim()) return true;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

function applyFilters(files: DriveGameFile[], f: Filters): DriveGameFile[] {
  if (!hasActiveFilters(f)) return files;

  return files.filter((file) => {
    const p = file.appProperties;

    // Search in white, black, opponent, and filename
    if (f.opponent.trim()) {
      const q = normalize(f.opponent.trim());
      const searchable = [
        normalize(p.white ?? ""),
        normalize(p.black ?? ""),
        normalize(p.opponent ?? ""),
        normalize(file.name ?? ""),
      ];
      if (!searchable.some((s) => s.includes(q))) return false;
    }

    // Only apply date filter when the entered value is a valid date
    if (f.dateFrom.trim() && isValidDate(f.dateFrom)) {
      const d = p.date ?? "";
      if (!d || d < f.dateFrom.trim()) return false;
    }

    if (f.dateTo.trim() && isValidDate(f.dateTo)) {
      const d = p.date ?? "";
      if (!d || d > f.dateTo.trim()) return false;
    }

    if (f.userColor) {
      if ((p.userColor ?? "") !== f.userColor) return false;
    }

    if (f.result) {
      if ((p.result ?? "") !== f.result) return false;
    }

    if (f.whiteMoves.trim()) {
      if (!matchMoves(p.firstWhiteMoves ?? "", f.whiteMoves)) return false;
    }

    if (f.blackMoves.trim()) {
      if (!matchMoves(p.firstBlackMoves ?? "", f.blackMoves)) return false;
    }

    return true;
  });
}

// ── FilterBar component ──────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  onClear,
  t,
  filteredCount,
  totalCount,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
  t: PageText;
  filteredCount: number;
  totalCount: number;
}) {
  const active = hasActiveFilters(filters);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3" data-testid="filter-bar">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t.filters}</span>
          <span
            className="text-xs text-muted-foreground"
            data-testid="text-games-count"
          >
            {filteredCount}
            {active && filteredCount !== totalCount
              ? `/${totalCount}`
              : ""}{" "}
            {t.gamesSuffix}
          </span>
        </div>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 text-xs"
            data-testid="button-clear-filters"
          >
            <X className="w-3 h-3 mr-1" />
            {t.clearFilters}
          </Button>
        )}
      </div>

      {/* Opponent + dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t.filterOpponent}</Label>
          <Input
            value={filters.opponent}
            onChange={(e) => set("opponent", e.target.value)}
            className="h-8 text-sm"
            placeholder="—"
            data-testid="input-filter-opponent"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.filterDateFrom}</Label>
          <Input
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            className={[
              "h-8 text-sm",
              filters.dateFrom && !isValidDate(filters.dateFrom)
                ? "border-destructive focus-visible:ring-destructive"
                : "",
            ].join(" ")}
            placeholder="YYYY-MM-DD"
            data-testid="input-filter-date-from"
          />
          {filters.dateFrom && !isValidDate(filters.dateFrom) && (
            <p className="text-xs text-destructive" data-testid="text-filter-date-from-error">
              {t.filterDateError}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.filterDateTo}</Label>
          <Input
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            className={[
              "h-8 text-sm",
              filters.dateTo && !isValidDate(filters.dateTo)
                ? "border-destructive focus-visible:ring-destructive"
                : "",
            ].join(" ")}
            placeholder="YYYY-MM-DD"
            data-testid="input-filter-date-to"
          />
          {filters.dateTo && !isValidDate(filters.dateTo) && (
            <p className="text-xs text-destructive" data-testid="text-filter-date-to-error">
              {t.filterDateError}
            </p>
          )}
        </div>
      </div>

      {/* Color + Result */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t.filterColor}</Label>
          <Select
            value={filters.userColor || "_all"}
            onValueChange={(v) =>
              set("userColor", v === "_all" ? "" : (v as "white" | "black"))
            }
          >
            <SelectTrigger className="h-8 text-sm" data-testid="select-filter-color">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t.filterColorAll}</SelectItem>
              <SelectItem value="white">{t.filterColorWhiteOption}</SelectItem>
              <SelectItem value="black">{t.filterColorBlackOption}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.filterResult}</Label>
          <Select
            value={filters.result || "_all"}
            onValueChange={(v) =>
              set(
                "result",
                v === "_all"
                  ? ""
                  : (v as "*" | "1-0" | "0-1" | "1/2-1/2"),
              )
            }
          >
            <SelectTrigger className="h-8 text-sm" data-testid="select-filter-result">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t.filterResultAll}</SelectItem>
              <SelectItem value="*">*</SelectItem>
              <SelectItem value="1-0">1-0</SelectItem>
              <SelectItem value="0-1">0-1</SelectItem>
              <SelectItem value="1/2-1/2">1/2-1/2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Move filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t.filterWhiteMoves}</Label>
          <Input
            value={filters.whiteMoves}
            onChange={(e) => set("whiteMoves", e.target.value)}
            className="h-8 text-sm font-mono"
            placeholder="e4 Nf3…"
            data-testid="input-filter-white-moves"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.filterBlackMoves}</Label>
          <Input
            value={filters.blackMoves}
            onChange={(e) => set("blackMoves", e.target.value)}
            className="h-8 text-sm font-mono"
            placeholder="e5 Nc6…"
            data-testid="input-filter-black-moves"
          />
        </div>
      </div>
    </div>
  );
}

// ── GameCard component ───────────────────────────────────────────────────────

function colorBadgeLabel(t: PageText, userColor: string): string | null {
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 rounded-xl bg-background/70 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {t.loadingGame}
          </span>
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
            <Badge
              variant="outline"
              className="text-xs"
              data-testid={`badge-result-${file.id}`}
            >
              {result}
            </Badge>
          )}
          {userColor && colorBadgeLabel(t, userColor) && (
            <Badge
              variant="secondary"
              className="text-xs"
              data-testid={`badge-color-${file.id}`}
            >
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
              <span className="font-medium text-foreground">
                {t.movesWhite}
              </span>
              <span
                className="font-mono"
                data-testid={`text-wmoves-${file.id}`}
              >
                {firstWhiteMoves.split(",").filter(Boolean).join(", ")}…
              </span>
            </>
          )}
          {firstBlackMoves && (
            <>
              <span className="font-medium text-foreground">
                {t.movesBlack}
              </span>
              <span
                className="font-mono"
                data-testid={`text-bmoves-${file.id}`}
              >
                {firstBlackMoves.split(",").filter(Boolean).join(", ")}…
              </span>
            </>
          )}
        </div>
      )}

      {/* Filename */}
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

// ── Library page ─────────────────────────────────────────────────────────────

export default function Library() {
  const [appLanguage] = useState<AppLanguage>(() => readAppLanguage());
  const t = TEXT[appLanguage] ?? TEXT.ca;
  const { toast } = useToast();

  const {
    files,
    loading,
    error,
    connected,
    connectAndLoad,
    refresh,
    loadPgnContent,
  } = useDriveLibrary();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [viewerFile, setViewerFile] = useState<DriveGameFile | null>(null);
  const [viewerPgn, setViewerPgn] = useState<string | null>(null);

  const filteredFiles = useMemo(
    () => applyFilters(files, filters),
    [files, filters],
  );

  const handleOpenGame = useCallback(
    async (file: DriveGameFile) => {
      if (loadingFileId) return;
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

  const showFilters = connected && !loading && !error && files.length > 0;

  // Full-screen viewer — replaces library list entirely (no modal/overlay)
  if (viewerFile && viewerPgn !== null) {
    return (
      <DriveGameViewer
        file={viewerFile}
        pgn={viewerPgn}
        appLanguage={appLanguage}
        onClose={handleCloseViewer}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="button-library-back"
              >
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

        {/* Connect button */}
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

        {/* Filter bar — shown only when there are games */}
        {showFilters && (
          <FilterBar
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(EMPTY_FILTERS)}
            t={t}
            filteredCount={filteredFiles.length}
            totalCount={files.length}
          />
        )}

        {/* Games list */}
        {connected && !loading && !error && filteredFiles.length > 0 && (
          <div className="space-y-3" data-testid="library-game-list">
            {filteredFiles.map((file) => (
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

        {/* No results from filters */}
        {connected &&
          !loading &&
          !error &&
          files.length > 0 &&
          filteredFiles.length === 0 && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
              data-testid="library-no-filter-results"
            >
              <SlidersHorizontal className="w-10 h-10 opacity-30" />
              <p className="font-medium text-sm">{t.noFilteredResults}</p>
              <p className="text-xs max-w-xs">{t.noFilteredHint}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
                data-testid="button-clear-filters-empty"
              >
                <X className="w-3 h-3 mr-1" />
                {t.clearFilters}
              </Button>
            </div>
          )}

        {/* Empty state (no games at all) */}
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

    </div>
  );
}
