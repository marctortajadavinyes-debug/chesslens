import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Upload, FileImage, Loader2 } from "lucide-react";
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    
    // Convert file to base64 for MVP simplicity
    // In production, upload to S3/Cloudinary and get a URL
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imageUrl = reader.result as string;
        const game = await createGame.mutateAsync({ imageUrl });
        toast({
          title: "Scoresheet Uploaded",
          description: "We're processing your game now.",
        });
        setLocation(`/games/${game.id}`);
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [createGame, setLocation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-display font-bold text-xl">
              C
            </div>
            <span className="font-display font-bold text-xl">ChessLens</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero / Upload Section */}
        <section className="mb-16 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">
              Digitize Your Chess Games
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Upload a photo of your handwritten scoresheet. We'll use AI to convert it into a digital PGN you can analyze and share.
            </p>
          </motion.div>

          {/* Upload Zone */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="max-w-xl mx-auto"
          >
            <div 
              {...getRootProps()} 
              className={`
                relative border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer group
                ${isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50 hover:bg-muted/30"}
                ${isUploading ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-full ${isDragActive ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"}`}>
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-medium text-lg">
                    {isUploading ? "Processing..." : isDragActive ? "Drop it here!" : "Click or drag to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports JPG, PNG, WEBP (Max 10MB)
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Recent Games List */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold">Recent Games</h2>
            <div className="h-px flex-1 bg-border ml-6"></div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : games?.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
              <FileImage className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No games uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games?.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
