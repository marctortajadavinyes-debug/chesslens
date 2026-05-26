import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronRight,
} from "lucide-react";
import type { Game } from "@shared/schema";
import { cn } from "@/lib/utils";

type CardLanguage = "ca" | "en" | "es";

interface GameCardProps {
  game: Game;
  language?: CardLanguage;
}

type CardText = {
  gameTitle: (id: number) => string;
  status: Record<string, string>;
};

const TEXT: Record<CardLanguage, CardText> = {
  ca: {
    gameTitle: (id) => `Partida #${id}`,
    status: {
      processing: "Processant",
      needs_review: "Revisió necessària",
      completed: "Completada",
      failed: "Error",
    },
  },
  en: {
    gameTitle: (id) => `Game #${id}`,
    status: {
      processing: "Processing",
      needs_review: "Review needed",
      completed: "Completed",
      failed: "Failed",
    },
  },
  es: {
    gameTitle: (id) => `Partida #${id}`,
    status: {
      processing: "Procesando",
      needs_review: "Revisión necesaria",
      completed: "Completada",
      failed: "Error",
    },
  },
};

export function GameCard({ game, language = "ca" }: GameCardProps) {
  const t = TEXT[language] ?? TEXT.ca;

  return (
    <Link href={`/games/${game.id}`} className="block group">
      <div className="bg-card border border-border rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:border-primary/20 relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="h-16 w-16 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0 border border-border/50">
              <img
                src={game.imageUrl ?? undefined}
                alt={t.gameTitle(game.id)}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </div>

            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg text-foreground truncate">
                {t.gameTitle(game.id)}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                {game.createdAt &&
                  formatDistanceToNow(new Date(game.createdAt), {
                    addSuffix: true,
                  })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <StatusBadge status={game.status} text={t.status} />
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1 shrink-0" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({
  status,
  text,
}: {
  status: string;
  text: Record<string, string>;
}) {
  const styles: Record<string, string> = {
    processing: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    needs_review: "bg-amber-500/10 text-amber-700 border-amber-200",
    completed: "bg-green-500/10 text-green-600 border-green-200",
    failed: "bg-red-500/10 text-red-600 border-red-200",
  };

  const icons: Record<string, JSX.Element> = {
    processing: <Clock className="w-3.5 h-3.5 mr-1.5 animate-pulse" />,
    needs_review: <Eye className="w-3.5 h-3.5 mr-1.5" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />,
    failed: <AlertCircle className="w-3.5 h-3.5 mr-1.5" />,
  };

  const label =
    text[status] ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border shrink-0",
        styles[status] || styles.processing,
      )}
    >
      {icons[status] ?? icons.processing}
      {label}
    </span>
  );
}
