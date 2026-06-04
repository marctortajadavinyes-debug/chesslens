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
import { getStockfishWorker } from "@/lib/stockfish-worker";
import { analyzePgn } from "@/lib/pgn-analysis";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/game-card";
import { useToast } from "@/hooks/use-toast";
import type {
  AppLanguage,
  ScoresheetLanguage,
  SheetFormat,
} from "@shared/schema";

type ChessLensUserSettings = {
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

const DEFAULT_SETTINGS: ChessLensUserSettings = {
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
    initialSettingsTitle: "Configuració inicial de ChessLens",
    settingsTitle: "Configuració de ChessLens",
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
      "ChessLens farà servir aquests valors per defecte.",
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
      "Ajuda'ns a millorar ChessLens. Escriu-nos qualsevol idea, problema o millora que vulguis proposar.",
    suggestionsButton: "Enviar suggeriment",
    suggestionsBody: "Escriu aquí el teu suggeriment:",
  },
  en: {
    library: "My games",
    settingsButton: "Settings",
    heroTitle: "Digitize your chess game",
    heroSubtitle:
      "Upload one or more scoresheets and generate PGN automatically.",
    initialSettingsTitle: "Initial ChessLens settings",
    settingsTitle: "ChessLens settings",
    alias: "Player name",
    email: "Email",
    optional: "Optional",
    appLanguage: "App language",
    scoresheetLanguage: "Scoresheet language",
    sheetFormat: "Scoresheet format",
    cancel: "Cancel",
    saveSettings: "Save settings",
    settingsSavedTitle: "Settings saved",
    settingsSavedDescription: "ChessLens will use these values by default.",
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
      "Help us improve ChessLens. Send us any idea, issue, or improvement you would like to suggest.",
    suggestionsButton: "Send suggestion",
    suggestionsBody: "Write your suggestion here:",
  },
  es: {
    library: "Mis partidas",
    settingsButton: "Configuración",
    heroTitle: "Digitaliza tu partida de ajedrez",
    heroSubtitle: "Sube una o más planillas y genera el PGN automáticamente.",
    initialSettingsTitle: "Configuración inicial de ChessLens",
    settingsTitle: "Configuración de ChessLens",
    alias: "Nombre del jugador",
    email: "Correo electrónico",
    optional: "Opcional",
    appLanguage: "Idioma de la aplicación",
    scoresheetLanguage: "Idioma de la planilla",
    sheetFormat: "Formato de planilla",
    cancel: "Cancelar",
    saveSettings: "Guardar configuración",
    settingsSavedTitle: "Configuración guardada",
    settingsSavedDescription: "ChessLens usará estos valores por defecto.",
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
      "Ayúdanos a mejorar ChessLens. Escríbenos cualquier idea, problema o mejora que quieras proponer.",
    suggestionsButton: "Enviar sugerencia",
    suggestionsBody: "Escribe aquí tu sugerencia:",
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
  const [settings, setSettings] =
    useState<ChessLensUserSettings>(DEFAULT_SETTINGS);

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

      const parsed = JSON.parse(raw) as Partial<ChessLensUserSettings>;

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
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-display font-bold text-xl">
              C
            </div>
            <span className="font-display font-bold text-xl">ChessLens</span>
          </div>

          <div className="flex items-center gap-2">
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
                onClick={() => setShowSettings(true)}
                disabled={isUploading}
              >
                <Settings className="w-4 h-4 mr-2" />
                {t.settingsButton}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              {t.heroTitle}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              {t.heroSubtitle}
            </p>
          </motion.div>

          <div className="max-w-xl mx-auto">
            {showSettings ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card p-6 rounded-2xl border shadow-sm text-left space-y-5"
              >
                <div>
                  <h2 className="text-xl font-bold">
                    {hasSavedSettings
                      ? t.settingsTitle
                      : t.initialSettingsTitle}
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.alias}
                    </label>
                    <input
                      value={settings.alias}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          alias: e.target.value,
                        }))
                      }
                      placeholder={t.optional}
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.email}
                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder={t.optional}
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.appLanguage}
                    </label>
                    <select
                      value={settings.appLanguage}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          appLanguage: e.target.value as AppLanguage,
                        }))
                      }
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
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
                      value={settings.scoresheetLanguage}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          scoresheetLanguage: e.target
                            .value as ScoresheetLanguage,
                        }))
                      }
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
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
                      value={settings.sheetFormat}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sheetFormat: e.target.value as SheetFormat,
                        }))
                      }
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      {SHEET_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {getSheetFormatLabel(
                            settings.appLanguage,
                            option.value,
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* [DEV] Stockfish SF.1 / SF.2.1 eval validation — remove after validation */}
                <div className="border border-dashed border-border rounded-xl p-3 space-y-2 bg-muted/10 opacity-70">
                  <p className="text-xs text-muted-foreground font-mono">[DEV] SF eval validation (SF.1 + SF.2.1)</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={async () => {
                        const sf = getStockfishWorker();
                        try {
                          console.log("[SF.1] Init worker…");
                          await sf.init();
                          console.log("[SF.1] uciok + readyok ✓");
                          const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
                          const r = await sf.analyze(fen, 10);
                          console.log("[SF.1] bestmove:", r.bestMove, "depth:", r.depth, "cp:", r.scoreCp);
                          toast({ title: `SF.1 OK · ${r.bestMove}`, duration: 3000 });
                        } catch (err) {
                          console.error("[SF.1]", err);
                          toast({ title: `SF.1 Error`, variant: "destructive", duration: 3000 });
                        }
                      }}
                      data-testid="button-dev-sf1-test"
                    >SF.1 Worker</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={async () => {
                        // SF.2.1 eval direction validation
                        // Rule: evalLossCp always ≥ 0; good move → 0; bad move → high positive
                        // Eval always from White's perspective: + = White better, - = Black better

                        function logMove(prefix: string, mv: { ply: number; side: string; san: string; evalBeforeCpWhite?: number; evalAfterCpWhite?: number; evalLossCp?: number; label?: string }) {
                          const before = mv.evalBeforeCpWhite !== undefined ? (mv.evalBeforeCpWhite / 100).toFixed(2) : "?";
                          const after  = mv.evalAfterCpWhite  !== undefined ? (mv.evalAfterCpWhite  / 100).toFixed(2) : "?";
                          const loss   = mv.evalLossCp !== undefined ? mv.evalLossCp : "?";
                          console.log(
                            `${prefix} ply=${mv.ply} ${mv.side === "w" ? "W" : "B"} ${mv.san}` +
                            ` | before=${before} after=${after} loss=${loss}cp label=${mv.label ?? "-"}`
                          );
                        }

                        // PGN A: normal Ruy Lopez — expect all excellent/good
                        const pgnA = `[Event "A-Normal"]
1. d4 d5 2. Nf3 Nf6 3. c4 e6 4. Nc3 Be7 5. e3 O-O *`;

                        // PGN B: White queen blunder on ply 7 (4.Qxg6?? loses the queen to hxg6)
                        // Expect ply 7 White move: high evalLossCp → blunder
                        const pgnB = `[Event "B-WhiteBlunder"]
1. e4 e5 2. Qh5 Nc6 3. Bc4 g6 4. Qxg6 hxg6 *`;

                        // PGN C: Black falls into Legal's Trap (6...Bxd1?? loses to Bxf7+ Ke7 Nd5#)
                        // Expect ply 12 Black move: high evalLossCp → blunder
                        const pgnC = `[Event "C-BlackBlunder"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5 6. Nxe5 Bxd1 *`;

                        const tests = [
                          { label: "A (normal)", pgn: pgnA, blunderPly: null as number | null },
                          { label: "B (White blunder ply 7)", pgn: pgnB, blunderPly: 7 },
                          { label: "C (Black blunder ply 12)", pgn: pgnC, blunderPly: 12 },
                        ];

                        let allOk = true;
                        for (const t of tests) {
                          try {
                            console.log(`\n[SF.2.1] ── ${t.label} ──`);
                            const result = await analyzePgn(t.pgn, { depth: 10, multiPV: 2 });
                            for (const mv of result.moves) {
                              logMove(`[SF.2.1]`, mv);
                            }
                            if (t.blunderPly !== null) {
                              const blunder = result.moves.find(m => m.ply === t.blunderPly);
                              if (blunder) {
                                const isBlunder = (blunder.evalLossCp ?? 0) > 200;
                                console.log(`[SF.2.1] ply ${t.blunderPly} evalLossCp=${blunder.evalLossCp} label=${blunder.label} → ${isBlunder ? "✓ BLUNDER detected" : "✗ NOT detected as blunder"}`);
                                if (!isBlunder) allOk = false;
                              }
                            } else {
                              const maxLoss = Math.max(0, ...result.moves.map(m => m.evalLossCp ?? 0));
                              console.log(`[SF.2.1] max evalLossCp in normal game = ${maxLoss}cp`);
                            }
                          } catch (err) {
                            console.error(`[SF.2.1] Error in ${t.label}:`, err);
                            allOk = false;
                          }
                        }
                        toast({
                          title: allOk ? "SF.2.1 ✓ eval validation passed" : "SF.2.1 ✗ check console",
                          variant: allOk ? "default" : "destructive",
                          duration: 5000,
                        });
                      }}
                      data-testid="button-dev-sf21-test"
                    >SF.2.1 Val</Button>
                  </div>
                </div>

                {/* Suggestions section */}
                <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{t.suggestionsTitle}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.suggestionsDescription}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const subject =
                        settings.appLanguage === "ca"
                          ? "Suggeriment ChessLens"
                          : settings.appLanguage === "es"
                            ? "Sugerencia ChessLens"
                            : "ChessLens suggestion";
                      const body = t.suggestionsBody + " ";
                      const mailto = `mailto:chessproapp.mvp@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      window.location.href = mailto;
                    }}
                    data-testid="button-send-suggestion"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {t.suggestionsButton}
                  </Button>
                </div>

                <div className="flex gap-2 justify-end">
                  {hasSavedSettings && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowSettings(false)}
                    >
                      {t.cancel}
                    </Button>
                  )}

                  <Button type="button" onClick={saveSettings}>
                    {t.saveSettings}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="text-xs text-muted-foreground bg-muted/30 border rounded-xl p-3 text-left">
                  <div className="font-medium text-foreground mb-1">
                    {t.currentSettings}
                  </div>
                  <div>
                    {t.app}:{" "}
                    {getLanguageOptionLabel(
                      APP_LANGUAGE_OPTIONS,
                      settings.appLanguage,
                    )}
                    {" · "}
                    {t.scoresheet}:{" "}
                    {getLanguageOptionLabel(
                      SCORESHEET_LANGUAGE_OPTIONS,
                      settings.scoresheetLanguage,
                    )}
                  </div>
                  <div>
                    {t.format}:{" "}
                    {getSheetFormatLabel(
                      settings.appLanguage,
                      settings.sheetFormat,
                    )}
                  </div>
                </div>

                {images.length === 0 ? (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-colors ${
                      isDragActive
                        ? "border-primary bg-primary/10"
                        : "border-primary/50 bg-primary/5 hover:bg-primary/10"
                    } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-4">
                      <Upload className="w-12 h-12 text-primary" />
                      <div>
                        <p className="text-xl font-medium text-foreground">
                          {isDragActive ? t.dropActive : t.dropIdle}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
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
            <div className="text-center p-8 border rounded-xl bg-muted/20 text-muted-foreground">
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
    </div>
  );
}
