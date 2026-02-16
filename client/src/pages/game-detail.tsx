import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGame, useUpdateGame } from "@/hooks/use-games";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { ArrowLeft, Save, Copy, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GameDetail() {
  const [, params] = useRoute("/games/:id");
  const id = parseInt(params?.id || "0");
  const { data: game, isLoading, error } = useGame(id);
  const updateGame = useUpdateGame();
  const { toast } = useToast();
  
  const [pgnText, setPgnText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync PGN from backend when it arrives
  useEffect(() => {
    if (game?.pgn) {
      setPgnText(game.pgn);
    }
  }, [game?.pgn]);

  const handleSave = async () => {
    try {
      await updateGame.mutateAsync({ 
        id, 
        pgn: pgnText 
      });
      setIsEditing(false);
      toast({
        title: "Changes saved",
        description: "Your PGN has been updated successfully.",
      });
    } catch (e) {
      toast({
        title: "Failed to save",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pgnText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading game data...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Game not found</h1>
        <Button asChild>
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-white/50 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="font-display font-bold text-xl">Game #{game.id}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
              game.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
              game.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
              'bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse'
            }`}>
              {game.status}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={updateGame.isPending}>
                  {updateGame.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </>
            ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)} disabled={game.status !== 'completed'}>
                  Edit PGN
                </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Source Image */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Original Scoresheet</h2>
          </div>
          <div className="bg-muted/20 border border-border rounded-xl overflow-hidden h-[600px] relative group">
            <img 
              src={game.imageUrl} 
              alt="Scoresheet" 
              className="w-full h-full object-contain"
            />
            {/* Zoom Hint Overlay could go here */}
          </div>
        </div>

        {/* Right Column: PGN & Board */}
        <div className="space-y-6 flex flex-col h-[600px]">
          {/* Tabs / Switcher could go here, for now stacked */}
          
          {game.status === 'processing' ? (
             <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 border border-dashed border-border rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h3 className="text-xl font-bold mb-2">Processing Scoresheet</h3>
                <p className="text-muted-foreground max-w-sm">
                    Our AI is analyzing the handwriting and extracting moves. This usually takes 10-20 seconds.
                </p>
             </div>
          ) : (
            <>
              {/* Chessboard Preview */}
              <div className="flex-1 min-h-[300px]">
                 <ChessboardViewer pgn={pgnText} />
              </div>

              {/* PGN Editor */}
              <div className="flex flex-col space-y-2">
                 <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-muted-foreground">PGN Output</h3>
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 text-xs">
                        {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        {copied ? "Copied" : "Copy PGN"}
                    </Button>
                 </div>
                 <textarea
                    value={pgnText}
                    onChange={(e) => setPgnText(e.target.value)}
                    disabled={!isEditing}
                    className={`
                        w-full h-48 p-4 rounded-lg font-mono text-sm resize-none
                        border transition-all duration-200
                        ${isEditing 
                            ? "bg-background border-primary ring-1 ring-primary/20 shadow-sm" 
                            : "bg-muted/30 border-border text-muted-foreground"
                        }
                        focus:outline-none
                    `}
                    placeholder="1. e4 e5 2. Nf3..."
                 />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
