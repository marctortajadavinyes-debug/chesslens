import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import {
  Upload,
  Loader2,
  Plus,
  Play,
  CheckCircle2,
  Settings,
  Library,
  MessageSquare,
} from "lucide-react";
import { useCreateGame, useGames } from "@/hooks/use-games";
import { analyzePgn } from "@/lib/pgn-analysis";
import { AnalysisPanel } from "@/components/analysis-panel";
import { Button } from "@/components/ui/button";
import { LicensesDialog } from "@/components/licenses-dialog";
import { GameCard } from "@/components/game-card";
import { useToast } from "@/hooks/use-toast";
import type {
  AppLanguage,
  ScoresheetLanguage,
  SheetFormat,
} from "@shared/schema";

type FotoChessUserSettings = {
  alias: string;
  email: string;
  appLanguage: AppLanguage;
  scoresheetLanguage: ScoresheetLanguage;
  sheetFormat: SheetFormat;
};

type UiText = {
  library: string;
  settingsButton: string;
  heroTitle: string;
  heroSubtitle: string;
  initialSettingsTitle: string;
  settingsTitle: string;
  alias: string;
  email: string;
  optional: string;
  appLanguage: string;
  scoresheetLanguage: string;
  sheetFormat: string;
  cancel: string;
  saveSettings: string;
  settingsSavedTitle: string;
  settingsSavedDescription: string;
  currentSettings: string;
  app: string;
  scoresheet: string;
  format: string;
  dropActive: string;
  dropIdle: string;
  dropHint: string;
  sheetAddedTitle: string;
  sheetAddedDescription: (count: number) => string;
  sheetsSentTitle: string;
  sheetsSentDescription: string;
  aiHighDemand: string;
  connectionProblem: string;
  scanStartFailedTitle: string;
  imagesLoaded: (count: number) => string;
  processingSheet: string;
  scanGame: string;
  addAnotherSheet: string;
  recentGames: string;
  noGames: string;
  genericErrorTitle: string;
  suggestionsTitle: string;
  suggestionsDescription: string;
  suggestionsButton: string;
  suggestionsBody: string;
  licensesTitle: string;
  licensesClose: string;
  licensesStockfish: string;
  licensesPythonChess: string;
  licensesOpenSource: string;
  licensesGemini: string;
  licensesTrademarks: string;
  licensesTrigger: string;
  analysisWithStockfish: string;
};

const SETTINGS_STORAGE_KEY = "chesslens_user_settings_v1";
const DEVICE_STORAGE_KEY = "chesslens_device_id_v1";

function getOrCreateDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
}

const DEFAULT_SETTINGS: FotoChessUserSettings = {
  alias: "",
  email: "",
  appLanguage: "ca",
  scoresheetLanguage: "ca",
  sheetFormat: "fce_75_3x25",
};

const APP_LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "ca", label: "Català" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const SCORESHEET_LANGUAGE_OPTIONS: {
  value: ScoresheetLanguage;
  label: string;
}[] = [
  { value: "ca", label: "Català" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const SHEET_FORMAT_OPTIONS: { value: SheetFormat }[] = [
  { value: "fce_75_3x25" },
  { value: "fide_60_3x20" },
  { value: "standard_60_2x30" },
  { value: "generic_40_2x20" },
];

const SHEET_FORMAT_LABELS: Record<AppLanguage, Record<SheetFormat, string>> = {
  ca: {
    fce_75_3x25: "FCE · 75 jugades · 3 columnes x 25",
    fide_60_3x20: "FEDA / FIDE / US · 60 jugades · 3 columnes x 20",
    standard_60_2x30: "Estàndard club/escolar · 60 jugades · 2 columnes x 30",
    generic_40_2x20: "Genèrica / escolar · 40 jugades · 2 columnes x 20",
  },
  en: {
    fce_75_3x25: "FCE · 75 moves · 3 columns x 25",
    fide_60_3x20: "FEDA / FIDE / US · 60 moves · 3 columns x 20",
    standard_60_2x30: "Club/school standard · 60 moves · 2 columns x 30",
    generic_40_2x20: "Generic / school · 40 moves · 2 columns x 20",
  },
  es: {
    fce_75_3x25: "FCE · 75 jugadas · 3 columnas x 25",
    fide_60_3x20: "FEDA / FIDE / US · 60 jugadas · 3 columnas x 20",
    standard_60_2x30: "Estándar club/escolar · 60 jugadas · 2 columnas x 30",
    generic_40_2x20: "Genérica / escolar · 40 jugadas · 2 columnas x 20",
  },
};

const UI_TEXT: Record<AppLanguage, UiText> = {
  ca: {
    library: "Les meves partides",
    settingsButton: "Configuració",
    heroTitle: "Digitalitza la teva partida d'escacs",
    heroSubtitle: "Puja una o més planelles i genera el PGN automàticament.",
    initialSettingsTitle: "Configuració inicial de FotoChess",
    settingsTitle: "Configuració de FotoChess",
    alias: "Nom del jugador",
    email: "Correu electrònic",
    optional: "Opcional",
    appLanguage: "Idioma de l'aplicació",
    scoresheetLanguage: "Idioma de la planella",
    sheetFormat: "Format de planella",
    cancel: "Cancel·lar",
    saveSettings: "Desar configuració",
    settingsSavedTitle: "Configuració desada",
    settingsSavedDescription:
      "FotoChess farà servir aquests valors per defecte.",
    currentSettings: "Configuració actual",
    app: "App",
    scoresheet: "Planella",
    format: "Format",
    dropActive: "Deixa la planella aquí",
    dropIdle: "Clica per afegir la teva planella",
    dropHint: "o arrossega la imatge aquí (JPG, PNG, WEBP)",
    sheetAddedTitle: "Planella afegida",
    sheetAddedDescription: (count: number) =>
      count === 1 ? "1 imatge afegida" : `${count} imatges afegides`,
    sheetsSentTitle: "Planelles enviades",
    sheetsSentDescription: "S'està processant la partida.",
    aiHighDemand:
      "Els servidors d'intel·ligència artificial estan molt sol·licitats. Si us plau, espera uns segons i torna-ho a provar.",
    connectionProblem:
      "Problema de connexió amb el servidor. Comprova la teva xarxa.",
    scanStartFailedTitle: "No s'ha pogut iniciar l'escaneig",
    imagesLoaded: (count: number) =>
      count === 1 ? "1 planella carregada" : `${count} planelles carregades`,
    processingSheet: "Processant planella...",
    scanGame: "Escanejar partida",
    addAnotherSheet: "Afegir una altra planella (opcional)",
    recentGames: "Partides recents",
    noGames: "No hi ha partides encara",
    genericErrorTitle: "Error",
    suggestionsTitle: "Suggeriments",
    suggestionsDescription:
      "Ajuda'ns a millorar FotoChess. Escriu-nos qualsevol idea, problema o millora que vulguis proposar.",
    suggestionsButton: "Enviar suggeriment",
    suggestionsBody: "Escriu aquí el teu suggeriment:",
    licensesTitle: "Llicències i avisos de tercers",
    licensesClose: "Tancar",
    licensesStockfish:
      "FotoChess utilitza Stockfish per a l'anàlisi d'escacs. Stockfish és un motor d'escacs lliure i de codi obert sota llicència GPLv3.",
    licensesPythonChess:
      "FotoChess utilitza python-chess al servidor per validar jugades i generar PGN.",
    licensesOpenSource:
      "FotoChess també utilitza biblioteques de codi obert com chess.js, react-chessboard i Lucide Icons per a la interfície i la gestió de posicions.",
    licensesGemini:
      "Les imatges de planelles pujades per l'usuari poden ser processades mitjançant Gemini API / Google AI Studio per extreure'n les jugades.",
    licensesTrademarks:
      "Chess.com, Lichess.org i ChessBase són marques dels seus respectius titulars. FotoChess no està afiliada, patrocinada ni avalada per aquests serveis.",
    licensesTrigger: "Llicències i avisos de tercers",
    analysisWithStockfish: "Anàlisi amb Stockfish 18",
  },
  en: {
    library: "My games",
    settingsButton: "Settings",
    heroTitle: "Digitize your chess game",
    heroSubtitle:
      "Upload one or more scoresheets and generate PGN automatically.",
    initialSettingsTitle: "Initial FotoChess settings",
    settingsTitle: "FotoChess settings",
    alias: "Player name",
    email: "Email",
    optional: "Optional",
    appLanguage: "App language",
    scoresheetLanguage: "Scoresheet language",
    sheetFormat: "Scoresheet format",
    cancel: "Cancel",
    saveSettings: "Save settings",
    settingsSavedTitle: "Settings saved",
    settingsSavedDescription: "FotoChess will use these values by default.",
    currentSettings: "Current settings",
    app: "App",
    scoresheet: "Scoresheet",
    format: "Format",
    dropActive: "Drop the scoresheet here",
    dropIdle: "Click to add your scoresheet",
    dropHint: "or drag the image here (JPG, PNG, WEBP)",
    sheetAddedTitle: "Scoresheet added",
    sheetAddedDescription: (count: number) =>
      count === 1 ? "1 image added" : `${count} images added`,
    sheetsSentTitle: "Scoresheets sent",
    sheetsSentDescription: "The game is being processed.",
    aiHighDemand:
      "The artificial intelligence servers are very busy. Please wait a few seconds and try again.",
    connectionProblem:
      "Connection problem with the server. Please check your network.",
    scanStartFailedTitle: "Could not start the scan",
    imagesLoaded: (count: number) =>
      count === 1 ? "1 scoresheet loaded" : `${count} scoresheets loaded`,
    processingSheet: "Processing scoresheet...",
    scanGame: "Scan game",
    addAnotherSheet: "Add another scoresheet (optional)",
    recentGames: "Recent games",
    noGames: "No games yet",
    genericErrorTitle: "Error",
    suggestionsTitle: "Suggestions",
    suggestionsDescription:
      "Help us improve FotoChess. Send us any idea, issue, or improvement you would like to suggest.",
    suggestionsButton: "Send suggestion",
    suggestionsBody: "Write your suggestion here:",
    licensesTitle: "Licences and third-party notices",
    licensesClose: "Close",
    licensesStockfish:
      "FotoChess uses Stockfish for chess analysis. Stockfish is a free and open-source chess engine under the GPLv3 licence.",
    licensesPythonChess:
      "FotoChess uses python-chess on the server to validate moves and generate PGN.",
    licensesOpenSource:
      "FotoChess also uses open-source libraries such as chess.js, react-chessboard and Lucide Icons for the interface and position management.",
    licensesGemini:
      "User-uploaded scoresheet images may be processed via Gemini API / Google AI Studio to extract moves.",
    licensesTrademarks:
      "Chess.com, Lichess.org and ChessBase are trademarks of their respective owners. FotoChess is not affiliated with, sponsored by, or endorsed by these services.",
    licensesTrigger: "Licences and third-party notices",
    analysisWithStockfish: "Analysis with Stockfish 18",
  },
  es: {
    library: "Mis partidas",
    settingsButton: "Configuración",
    heroTitle: "Digitaliza tu partida de ajedrez",
    heroSubtitle: "Sube una o más planillas y genera el PGN automáticamente.",
    initialSettingsTitle: "Configuración inicial de FotoChess",
    settingsTitle: "Configuración de FotoChess",
    alias: "Nombre del jugador",
    email: "Correo electrónico",
    optional: "Opcional",
    appLanguage: "Idioma de la aplicación",
    scoresheetLanguage: "Idioma de la planilla",
    sheetFormat: "Formato de planilla",
    cancel: "Cancelar",
    saveSettings: "Guardar configuración",
    settingsSavedTitle: "Configuración guardada",
    settingsSavedDescription: "FotoChess usará estos valores por defecto.",
    currentSettings: "Configuración actual",
    app: "App",
    scoresheet: "Planilla",
    format: "Formato",
    dropActive: "Suelta la planilla aquí",
    dropIdle: "Haz clic para añadir tu planilla",
    dropHint: "o arrastra la imagen aquí (JPG, PNG, WEBP)",
    sheetAddedTitle: "Planilla añadida",
    sheetAddedDescription: (count: number) =>
      count === 1 ? "1 imagen añadida" : `${count} imágenes añadidas`,
    sheetsSentTitle: "Planillas enviadas",
    sheetsSentDescription: "Se está procesando la partida.",
    aiHighDemand:
      "Los servidores de inteligencia artificial están muy solicitados. Espera unos segundos y vuelve a intentarlo.",
    connectionProblem:
      "Problema de conexión con el servidor. Comprueba tu red.",
    scanStartFailedTitle: "No se ha podido iniciar el escaneo",
    imagesLoaded: (count: number) =>
      count === 1 ? "1 planilla cargada" : `${count} planillas cargadas`,
    processingSheet: "Procesando planilla...",
    scanGame: "Escanear partida",
    addAnotherSheet: "Añadir otra planilla (opcional)",
    recentGames: "Partidas recientes",
    noGames: "Todavía no hay partidas",
    genericErrorTitle: "Error",
    suggestionsTitle: "Sugerencias",
    suggestionsDescription:
      "Ayúdanos a mejorar FotoChess. Escríbenos cualquier idea, problema o mejora que quieras proponer.",
    suggestionsButton: "Enviar sugerencia",
    suggestionsBody: "Escribe aquí tu sugerencia:",
    licensesTitle: "Licencias y avisos de terceros",
    licensesClose: "Cerrar",
    licensesStockfish:
      "FotoChess utiliza Stockfish para el análisis de ajedrez. Stockfish es un motor de ajedrez libre y de código abierto bajo licencia GPLv3.",
    licensesPythonChess:
      "FotoChess utiliza python-chess en el servidor para validar jugadas y generar PGN.",
    licensesOpenSource:
      "FotoChess también utiliza bibliotecas de código abierto como chess.js, react-chessboard y Lucide Icons para la interfaz y la gestión de posiciones.",
    licensesGemini:
      "Las imágenes de planillas subidas por el usuario pueden ser procesadas mediante Gemini API / Google AI Studio para extraer las jugadas.",
    licensesTrademarks:
      "Chess.com, Lichess.org y ChessBase son marcas de sus respectivos titulares. FotoChess no está afiliada, patrocinada ni avalada por estos servicios.",
    licensesTrigger: "Licencias y avisos de terceros",
    analysisWithStockfish: "Análisis con Stockfish 18",
  },
};

function getLanguageOptionLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function getSheetFormatLabel(appLanguage: AppLanguage, value: SheetFormat) {
  return (
    SHEET_FORMAT_LABELS[appLanguage]?.[value] ?? SHEET_FORMAT_LABELS.ca[value]
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createGame = useCreateGame();
  const { data: games, isLoading } = useGames();

  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasSavedSettings, setHasSavedSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [settings, setSettings] =
    useState<FotoChessUserSettings>(DEFAULT_SETTINGS);
  // draftSettings holds unsaved form changes; only applied to settings on Save.
  const [draftSettings, setDraftSettings] =
    useState<FotoChessUserSettings>(DEFAULT_SETTINGS);

  const t = UI_TEXT[settings.appLanguage] ?? UI_TEXT.ca;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (!raw) {
        setSettings(DEFAULT_SETTINGS);
        setHasSavedSettings(false);
        setShowSettings(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<FotoChessUserSettings>;

      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
      });
      setHasSavedSettings(true);
      setShowSettings(false);
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setHasSavedSettings(false);
      setShowSettings(true);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  const saveSettings = () => {
    setSettings(draftSettings);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(draftSettings));
    setHasSavedSettings(true);
    setShowSettings(false);

    toast({
      title: t.settingsSavedTitle,
      description: t.settingsSavedDescription,
      duration: 1500,
    });
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles || acceptedFiles.length === 0) return;

      try {
        const newImages: string[] = [];
        for (const file of acceptedFiles) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newImages.push(base64);
        }

        setImages((prev) => [...prev, ...newImages]);
        toast({
          title: t.sheetAddedTitle,
          description: t.sheetAddedDescription(newImages.length),
          duration: 1500,
        });
      } catch (error) {
        toast({
          title: t.genericErrorTitle,
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    },
    [toast, t],
  );

  const handleSubmit = async () => {
    if (images.length === 0) return;
    setIsUploading(true);

    try {
      const game = await createGame.mutateAsync({
        imageUrls: images,
        alias: settings.alias.trim(),
        email: settings.email.trim(),
        deviceId: getOrCreateDeviceId(),
        appLanguage: settings.appLanguage,
        scoresheetLanguage: settings.scoresheetLanguage,
        sheetFormat: settings.sheetFormat,
      });

      toast({
        title: t.sheetsSentTitle,
        description: t.sheetsSentDescription,
        duration: 1500,
      });

      setImages([]);
      setLocation(`/games/${game.id}`);
    } catch (error) {
      let errorMsg = (error as Error).message;

      if (
        errorMsg.includes("503") ||
        errorMsg.toLowerCase().includes("high demand") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.toLowerCase().includes("failed to create game")
      ) {
        errorMsg = t.aiHighDemand;
      } else if (errorMsg.toLowerCase().includes("failed to fetch")) {
        errorMsg = t.connectionProblem;
      }

      toast({
        title: t.scanStartFailedTitle,
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 5,
    disabled: isUploading || showSettings,
  });

  if (!settingsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
          {/* Marca — fila 1 en mòbil, esquerra en sm+ */}
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/fotochess-icon.png"
              alt=""
              aria-hidden="true"
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-md sm:rounded-lg object-cover"
            />
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base sm:text-xl">FotoChess</span>
              <span className="text-[10px] text-muted-foreground tracking-wide mt-0.5">
                Scan. Save PGN. Analyze. Improve.
              </span>
            </div>
          </div>

          {/* Botons — fila 2 en mòbil, centre/dreta en sm+ */}
          <div className="mt-1.5 flex w-full items-center justify-between gap-2 sm:mt-0 sm:w-auto sm:flex-1 sm:justify-end">
            <Link href="/library">
              <Button
                type="button"
                variant="default"
                size="sm"
                data-testid="link-library"
              >
                <Library className="w-4 h-4 mr-2" />
                {t.library}
              </Button>
            </Link>
            {hasSavedSettings && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setDraftSettings(settings); setShowSettings(true); }}
                disabled={isUploading}
                className="shrink-0"
              >
                <Settings className="w-4 h-4 mr-2" />
                {t.settingsButton}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="mb-6 sm:mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-2 sm:mb-3">
              {t.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mb-3 sm:mb-5">
              {t.heroSubtitle}
            </p>
          </motion.div>

          {/* Hero — sempre 2 columnes (imatge esquerra, config dreta) */}
          <div className="mx-auto mb-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f7f4] shadow-sm">
            <div className="grid grid-cols-[46%_54%] items-stretch">
              {/* Columna esquerra — imatge escorada a l'esquerra */}
              <div className="relative h-[110px] overflow-hidden sm:h-[145px] lg:h-[165px]">
                <img
                  src="/hero-scoresheet-scan.png"
                  alt="Escaneig de planella d'escacs per generar PGN"
                  className="absolute inset-y-0 left-[-12px] h-full w-full object-contain object-left"
                  loading="eager"
                />
              </div>

              {/* Columna dreta — Configuració actual alineada a la dreta */}
              <div className="flex h-full items-center justify-end px-1 sm:px-4">
                <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-[#fbfbf8] px-2.5 py-2 sm:px-4 sm:py-3 text-left shadow-sm">
                  <div className="text-xs sm:text-sm font-semibold text-slate-950">
                    {t.currentSettings}
                  </div>
                  <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">{t.app}:</span>{" "}
                    {getLanguageOptionLabel(
                      APP_LANGUAGE_OPTIONS,
                      settings.appLanguage,
                    )}
                    {" · "}
                    <span className="font-semibold text-slate-900">{t.scoresheet}:</span>{" "}
                    {getLanguageOptionLabel(
                      SCORESHEET_LANGUAGE_OPTIONS,
                      settings.scoresheetLanguage,
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">{t.format}:</span>{" "}
                    {getSheetFormatLabel(
                      settings.appLanguage,
                      settings.sheetFormat,
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel de Configuració — overlay pantalla completa en mòbil, inline en sm+ */}
          <div className={showSettings
            ? "fixed inset-0 z-30 bg-background overflow-y-auto sm:relative sm:inset-auto sm:z-auto sm:overflow-visible sm:bg-transparent"
            : "max-w-xl mx-auto"
          }>
            {showSettings ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-4 sm:p-6 sm:rounded-2xl sm:border shadow-sm text-left space-y-3 sm:space-y-5 sm:max-w-xl sm:mx-auto"
              >
                <div className="flex items-center gap-2 border-b pb-3 sm:border-none sm:pb-0">
                  <h2 className="text-lg sm:text-xl font-bold flex-1">
                    {hasSavedSettings
                      ? t.settingsTitle
                      : t.initialSettingsTitle}
                  </h2>
                  {hasSavedSettings && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="sm:hidden text-muted-foreground"
                      onClick={() => { setDraftSettings(settings); setShowSettings(false); }}
                    >
                      {t.cancel}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.alias}
                    </label>
                    <input
                      value={draftSettings.alias}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          alias: e.target.value,
                        }))
                      }
                      placeholder={t.optional}
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.email}
                    </label>
                    <input
                      type="email"
                      value={draftSettings.email}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder={t.optional}
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.appLanguage}
                    </label>
                    <select
                      value={draftSettings.appLanguage}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          appLanguage: e.target.value as AppLanguage,
                        }))
                      }
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {APP_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.scoresheetLanguage}
                    </label>
                    <select
                      value={draftSettings.scoresheetLanguage}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          scoresheetLanguage: e.target
                            .value as ScoresheetLanguage,
                        }))
                      }
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {SCORESHEET_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.sheetFormat}
                    </label>
                    <select
                      value={draftSettings.sheetFormat}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          sheetFormat: e.target.value as SheetFormat,
                        }))
                      }
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {SHEET_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {getSheetFormatLabel(
                            draftSettings.appLanguage,
                            option.value,
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Suggestions section */}
                <div className="border border-border rounded-xl p-2.5 space-y-1.5 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold">{t.suggestionsTitle}</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => {
                      setSuggestionText("");
                      setShowSuggestionDialog(true);
                    }}
                    data-testid="button-send-suggestion"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                    {t.suggestionsButton}
                  </Button>
                </div>

                {/* Licenses link */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setShowLicenses(true)}
                    data-testid="button-licenses-trigger"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {t.licensesTrigger}
                  </button>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  {hasSavedSettings && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="hidden sm:inline-flex"
                      onClick={() => { setDraftSettings(settings); setShowSettings(false); }}
                    >
                      {t.cancel}
                    </Button>
                  )}

                  <Button type="button" onClick={saveSettings} className="flex-1 sm:flex-none">
                    {t.saveSettings}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {images.length === 0 ? (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors ${
                      isDragActive
                        ? "border-primary bg-primary/10"
                        : "border-primary/50 bg-primary/5 hover:bg-primary/10"
                    } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-7 h-7 text-primary" />
                      <div>
                        <p className="text-base font-medium text-foreground">
                          {isDragActive ? t.dropActive : t.dropIdle}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.dropHint}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-6 bg-card p-8 rounded-2xl border shadow-sm"
                  >
                    <div className="flex items-center justify-center gap-3 text-green-600">
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-lg font-medium">
                        {t.imagesLoaded(images.length)}
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="lg"
                      className="w-full h-16 text-lg rounded-xl shadow-lg hover:scale-[1.02] transition-transform"
                      disabled={isUploading}
                      onClick={handleSubmit}
                    >
                      {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin mr-3" />
                      ) : (
                        <Play className="w-6 h-6 mr-3 fill-current" />
                      )}
                      {isUploading ? t.processingSheet : t.scanGame}
                    </Button>

                    <div {...getRootProps()} className="mt-2">
                      <input {...getInputProps()} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUploading}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t.addAnotherSheet}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">{t.recentGames}</h2>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : games?.length === 0 ? (
            <div className="text-center p-5 border rounded-xl bg-muted/20 text-muted-foreground">
              {t.noGames}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games?.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

      </main>

      {showSuggestionDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-3 py-4">
          <div className="w-full max-w-lg rounded-2xl bg-background p-4 shadow-xl border border-border">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-display font-bold">
                  {t.suggestionsTitle}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.suggestionsDescription}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSuggestionDialog(false)}
                className="shrink-0"
              >
                ×
              </Button>
            </div>

            <label className="block text-sm font-medium mb-2">
              {t.suggestionsBody}
            </label>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              className="w-full min-h-[180px] rounded-xl border border-border bg-background p-3 text-base leading-relaxed resize-y"
              autoFocus
            />

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(suggestionText);
                  toast({
                    title:
                      settings.appLanguage === "ca"
                        ? "Suggeriment copiat"
                        : settings.appLanguage === "es"
                          ? "Sugerencia copiada"
                          : "Suggestion copied",
                    duration: 1500,
                  });
                }}
                disabled={!suggestionText.trim()}
              >
                {settings.appLanguage === "ca"
                  ? "Copiar text"
                  : settings.appLanguage === "es"
                    ? "Copiar texto"
                    : "Copy text"}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  const subject =
                    settings.appLanguage === "ca"
                      ? "Suggeriment FotoChess"
                      : settings.appLanguage === "es"
                        ? "Sugerencia FotoChess"
                        : "FotoChess suggestion";
                  const body = suggestionText.trim() || t.suggestionsBody;
                  const mailto = `mailto:chessproapp.mvp@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  window.location.href = mailto;
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {settings.appLanguage === "ca"
                  ? "Obrir correu"
                  : settings.appLanguage === "es"
                    ? "Abrir correo"
                    : "Open email"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
