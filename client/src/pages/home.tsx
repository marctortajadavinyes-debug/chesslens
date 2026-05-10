import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import {
  Upload,
  Loader2,
  Plus,
  Play,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { useCreateGame, useGames } from "@/hooks/use-games";
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

const SETTINGS_STORAGE_KEY = "chesslens_user_settings_v1";

const DEFAULT_SETTINGS: ChessLensUserSettings = {
  alias: "",
  email: "",
  appLanguage: "ca",
  scoresheetLanguage: "ca",
  sheetFormat: "fce_75_3x25",
};

const APP_LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "ca", label: "Català" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

const SCORESHEET_LANGUAGE_OPTIONS: {
  value: ScoresheetLanguage;
  label: string;
}[] = [
  { value: "ca", label: "Català" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "ru", label: "Русский" },
  { value: "tr", label: "Türkçe" },
  { value: "zh", label: "中文" },
  { value: "hi", label: "हिन्दी" },
];

const SHEET_FORMAT_OPTIONS: { value: SheetFormat; label: string }[] = [
  {
    value: "fce_75_3x25",
    label: "FCE · 75 jugades · 3 columnes x 25",
  },
  {
    value: "fide_60_3x20",
    label: "FEDA / FIDE / US · 60 jugades · 3 columnes x 20",
  },
  {
    value: "standard_60_2x30",
    label: "Estàndard club/escolar · 60 jugades · 2 columnes x 30",
  },
  {
    value: "generic_40_2x20",
    label: "Genèrica / escolar · 40 jugades · 2 columnes x 20",
  },
];

function getOptionLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
) {
  return options.find((o) => o.value === value)?.label ?? value;
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
      title: "Configuració desada",
      description: "ChessLens farà servir aquests valors per defecte.",
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
          title: "Planella afegida",
          description: `${newImages.length} imatge(s) afegida(es)`,
          duration: 1500,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleSubmit = async () => {
    if (images.length === 0) return;
    setIsUploading(true);

    try {
      const game = await createGame.mutateAsync({
        imageUrls: images,
        appLanguage: settings.appLanguage,
        scoresheetLanguage: settings.scoresheetLanguage,
        sheetFormat: settings.sheetFormat,
      });

      toast({
        title: "Planelles enviades",
        description: "S'està processant la partida.",
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
        errorMsg =
          "Els servidors d'intel·ligència artificial estan molt sol·licitats. Si us plau, espera uns segons i torna-ho a provar.";
      } else if (errorMsg.toLowerCase().includes("failed to fetch")) {
        errorMsg =
          "Problema de connexió amb el servidor. Comprova la teva xarxa.";
      }

      toast({
        title: "No s'ha pogut iniciar l'escaneig",
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

          {hasSavedSettings && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              disabled={isUploading}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuració
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Digitalitza la teva partida d'escacs
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Puja una o més planelles i genera el PGN automàticament.
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
                    Configuració inicial de ChessLens
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ho preguntarem només una vegada. Després ho podràs canviar
                    des de Configuració.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Àlies
                    </label>
                    <input
                      value={settings.alias}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          alias: e.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Correu electrònic
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
                      placeholder="Opcional"
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Idioma de l'aplicació
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
                      Idioma de la planella
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
                      Format de planella
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
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Nota: els formats FEDA/FIDE i genèric queden preparats per al
                  següent pas del motor.
                </p>

                <div className="flex gap-2 justify-end">
                  {hasSavedSettings && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowSettings(false)}
                    >
                      Cancel·lar
                    </Button>
                  )}

                  <Button type="button" onClick={saveSettings}>
                    Desar configuració
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="text-xs text-muted-foreground bg-muted/30 border rounded-xl p-3 text-left">
                  <div className="font-medium text-foreground mb-1">
                    Configuració actual
                  </div>
                  <div>
                    App:{" "}
                    {getOptionLabel(APP_LANGUAGE_OPTIONS, settings.appLanguage)}
                    {" · "}
                    Planella:{" "}
                    {getOptionLabel(
                      SCORESHEET_LANGUAGE_OPTIONS,
                      settings.scoresheetLanguage,
                    )}
                  </div>
                  <div>
                    Format:{" "}
                    {getOptionLabel(SHEET_FORMAT_OPTIONS, settings.sheetFormat)}
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
                          {isDragActive
                            ? "Deixa la planella aquí"
                            : "Clica per afegir la teva planella"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          o arrossega la imatge aquí (JPG, PNG, WEBP)
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
                        {images.length}{" "}
                        {images.length === 1
                          ? "planella carregada"
                          : "planelles carregades"}
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
                      {isUploading
                        ? "Processant planella..."
                        : "Escanejar partida"}
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
                        Afegir una altra planella (opcional)
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">Partides recents</h2>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : games?.length === 0 ? (
            <div className="text-center p-8 border rounded-xl bg-muted/20 text-muted-foreground">
              No hi ha partides encara
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
