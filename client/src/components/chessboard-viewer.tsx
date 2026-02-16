import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw, Play, Pause } from 'lucide-react';

interface ChessboardViewerProps {
  pgn: string;
}

export function ChessboardViewer({ pgn }: ChessboardViewerProps) {
  const [game, setGame] = useState(new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize game from PGN
  useEffect(() => {
    if (!pgn) return;
    try {
      const newGame = new Chess();
      newGame.loadPgn(pgn);
      setGame(newGame);
      // Reset to end of game initially
      setCurrentMoveIndex(newGame.history().length);
    } catch (e) {
      console.error("Invalid PGN", e);
    }
  }, [pgn]);

  // Handle auto-play
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMoveIndex(prev => {
          if (prev >= game.history().length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, game]);

  // Get current position based on move index
  const currentPosition = () => {
    const history = game.history();
    const tempGame = new Chess();
    for (let i = 0; i < currentMoveIndex; i++) {
      tempGame.move(history[i]);
    }
    return tempGame.fen();
  };

  const history = game.history();

  return (
    <div className="flex flex-col space-y-6">
      <div className="aspect-square w-full max-w-[400px] mx-auto shadow-2xl rounded-lg overflow-hidden border-4 border-primary/10">
        <Chessboard 
          position={currentPosition()} 
          boardOrientation="white"
          customDarkSquareStyle={{ backgroundColor: '#779556' }}
          customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-2">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => { setIsPlaying(false); setCurrentMoveIndex(0); }}
          disabled={currentMoveIndex === 0}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => { setIsPlaying(false); setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1)); }}
          disabled={currentMoveIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Button 
          variant="default" 
          size="icon"
          className="w-12 h-12 rounded-full"
          onClick={() => {
            if (currentMoveIndex >= history.length) {
                setCurrentMoveIndex(0);
                setIsPlaying(true);
            } else {
                setIsPlaying(!isPlaying);
            }
          }}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>

        <Button 
          variant="outline" 
          size="icon"
          onClick={() => { setIsPlaying(false); setCurrentMoveIndex(Math.min(history.length, currentMoveIndex + 1)); }}
          disabled={currentMoveIndex >= history.length}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Moves List (Simple) */}
      <div className="bg-muted/30 rounded-lg p-4 h-32 overflow-y-auto text-sm font-mono border border-border">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center pt-8">No moves yet</p>
        ) : (
            <div className="flex flex-wrap gap-2">
                {history.map((move, i) => (
                    <span 
                        key={i} 
                        className={cn(
                            "px-1.5 rounded cursor-pointer hover:bg-primary/10 transition-colors",
                            i === currentMoveIndex - 1 && "bg-primary text-primary-foreground font-bold"
                        )}
                        onClick={() => { setIsPlaying(false); setCurrentMoveIndex(i + 1); }}
                    >
                        {i % 2 === 0 && <span className="text-muted-foreground mr-1">{(i/2 + 1)}.</span>}
                        {move}
                    </span>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
