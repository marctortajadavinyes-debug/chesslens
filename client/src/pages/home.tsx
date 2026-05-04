import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Upload, Loader2, Plus, Play, CheckCircle2 } from "lucide-react";
import { useCreateGame, useGames } from "@/hooks/use-games";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/game-card";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createGame = useCreateGame();
  const { data: games, isLoading } = useGames();

  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

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
      const game = await createGame.mutateAsync({ imageUrls: images });
      toast({
        title: "Planelles enviades",
        description: "S'està processant la partida.",
        duration: 1500,
      });
      setImages([]);
      setLocation(`/games/${game.id}`);
    } catch (error) {
      let errorMsg = (error as Error).message;

      // Traduïm i fem amigables els errors més comuns dels servidors i la IA
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
    disabled: isUploading,
  });

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
            {images.length === 0 ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/10" : "border-primary/50 bg-primary/5 hover:bg-primary/10"} ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
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
                  {isUploading ? "Processant planella..." : "Escanejar partida"}
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
