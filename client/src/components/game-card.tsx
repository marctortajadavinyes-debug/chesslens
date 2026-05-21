import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Clock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import type { Game } from "@shared/schema";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link href={`/games/${game.id}`} className="block group">
      <div className="bg-card border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:border-primary/20 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0 border border-border/50">
              <img
                src={game.imageUrl ?? undefined}
                alt={`Game ${game.id}`}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </div>

            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                Game #{game.id}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                {game.createdAt &&
                  formatDistanceToNow(new Date(game.createdAt), {
                    addSuffix: true,
                  })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <StatusBadge status={game.status} />
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    processing: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    completed: "bg-green-500/10 text-green-600 border-green-200",
    failed: "bg-red-500/10 text-red-600 border-red-200",
  };

  const icons = {
    processing: <Clock className="w-3.5 h-3.5 mr-1.5 animate-pulse" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />,
    failed: <AlertCircle className="w-3.5 h-3.5 mr-1.5" />,
  };

  const statusKey = status as keyof typeof styles;

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border",
        styles[statusKey] || styles.processing,
      )}
    >
      {icons[statusKey]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
