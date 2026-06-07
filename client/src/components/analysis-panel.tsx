/**
 * analysis-panel.tsx — SF.3A
 *
 * Visual analysis panel: eval bar, best moves, quality summary, critical moments.
 * Self-contained — uses useStockfishAnalysis internally.
 * Always post-PGN. Never touches OCR / parser / reviewState / resume.
 *
 * i18n: inline ca / en / es.
 * TODO SF.3A-i18n: integrate with app-wide UI_TEXT once panel ships to production.
 */

import { Chess } from "chess.js";
import {
  TrendingUp,
  Square,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStockfishAnalysis } from "@/hooks/use-stockfish-analysis";
import type { MoveAnalysis, MoveQuality } from "@/lib/pgn-analysis";
import type { AnalysisLine } from "@/lib/stockfish-worker";

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Lang = "ca" | "en" | "es";

type PanelText = {
  title: string;
  analyze: string;
  stop: string;
  reset: string;
  statusAnalyzing: string;
  statusDone: (n: number) => string;
  statusError: string;
  statusIdle: string;
  statusAborted: string;
  bestMoves: string;
  qualitySummary: string;
  excellent: string;
  good: string;
  inaccuracy: string;
  mistake: string;
  blunder: string;
  criticalMoments: string;
  noCritical: string;
  white: string;
  black: string;
  evalWhiteBetter: string;
  evalEqual: string;
  evalBlackBetter: string;
  evalWhiteMate: string;
  evalBlackMate: string;
};

const PANEL_TEXT: Record<Lang, PanelText> = {
  ca: {
    title: "Anàlisi",
    analyze: "Analitzar",
    stop: "Detenir",
    reset: "Reiniciar",
    statusAnalyzing: "Analitzant",
    statusDone: (n) =>
      n === 1 ? "Anàlisi completada · 1 jugada" : `Anàlisi completada · ${n} jugades`,
    statusError: "Error d'anàlisi",
    statusIdle: "Prem Analitzar per iniciar",
    statusAborted: "Anàlisi interrompuda",
    bestMoves: "Millors jugades",
    qualitySummary: "Qualitat de jugades",
    excellent: "Excel·lents",
    good: "Bones",
    inaccuracy: "Imprecisions",
    mistake: "Errors",
    blunder: "Errors greus",
    criticalMoments: "Moments crítics",
    noCritical: "Cap moment crític",
    white: "Blanques",
    black: "Negres",
    evalWhiteBetter: "Blanques estan millor",
    evalEqual: "Posició equilibrada",
    evalBlackBetter: "Negres estan millor",
    evalWhiteMate: "Blanques fan mat",
    evalBlackMate: "Negres fan mat",
  },
  en: {
    title: "Analysis",
    analyze: "Analyse",
    stop: "Stop",
    reset: "Reset",
    statusAnalyzing: "Analysing",
    statusDone: (n) =>
      n === 1 ? "Analysis complete · 1 move" : `Analysis complete · ${n} moves`,
    statusError: "Analysis error",
    statusIdle: "Press Analyse to start",
    statusAborted: "Analysis aborted",
    bestMoves: "Best moves",
    qualitySummary: "Move quality",
    excellent: "Excellent",
    good: "Good",
    inaccuracy: "Inaccuracy",
    mistake: "Mistake",
    blunder: "Blunder",
    criticalMoments: "Critical moments",
    noCritical: "No critical moments",
    white: "White",
    black: "Black",
    evalWhiteBetter: "White is better",
    evalEqual: "Equal position",
    evalBlackBetter: "Black is better",
    evalWhiteMate: "White forces mate",
    evalBlackMate: "Black forces mate",
  },
  es: {
    title: "Análisis",
    analyze: "Analizar",
    stop: "Detener",
    reset: "Reiniciar",
    statusAnalyzing: "Analizando",
    statusDone: (n) =>
      n === 1 ? "Análisis completado · 1 jugada" : `Análisis completado · ${n} jugadas`,
    statusError: "Error en el análisis",
    statusIdle: "Pulsa Analizar para empezar",
    statusAborted: "Análisis interrumpido",
    bestMoves: "Mejores jugadas",
    qualitySummary: "Calidad de jugadas",
    excellent: "Excelentes",
    good: "Buenas",
    inaccuracy: "Imprecisiones",
    mistake: "Errores",
    blunder: "Errores graves",
    criticalMoments: "Momentos críticos",
    noCritical: "Ningún momento crítico",
    white: "Blancas",
    black: "Negras",
    evalWhiteBetter: "Blancas están mejor",
    evalEqual: "Posición equilibrada",
    evalBlackBetter: "Negras están mejor",
    evalWhiteMate: "Blancas dan mate",
    evalBlackMate: "Negras dan mate",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Percentage of the bar that is "White" (6–94). Center = 50 = equal. */
function evalToWhitePct(lines: AnalysisLine[]): number {
  if (lines.length === 0) return 50;
  const line = lines[0];
  if (line.mateWhite !== undefined) return line.mateWhite > 0 ? 94 : 6;
  const cp = Math.max(-1000, Math.min(1000, line.scoreCpWhite ?? 0));
  return 50 + (cp / 1000) * 44; // 6..94
}

/** Formatted eval string: "+1.1", "0.0", "M+3", "M-2". */
function formatEvalStr(lines: AnalysisLine[]): string {
  if (lines.length === 0) return "0.0";
  const line = lines[0];
  if (line.mateWhite !== undefined) {
    return line.mateWhite > 0 ? `M+${line.mateWhite}` : `M${line.mateWhite}`;
  }
  const cp = line.scoreCpWhite ?? 0;
  return (cp >= 0 ? "+" : "") + (cp / 100).toFixed(1);
}

function evalDescription(lines: AnalysisLine[], t: PanelText): string {
  if (lines.length === 0) return t.evalEqual;
  const line = lines[0];
  if (line.mateWhite !== undefined) {
    return line.mateWhite > 0 ? t.evalWhiteMate : t.evalBlackMate;
  }
  const cp = line.scoreCpWhite ?? 0;
  if (Math.abs(cp) <= 30) return t.evalEqual;
  return cp > 0 ? t.evalWhiteBetter : t.evalBlackBetter;
}

/** Convert UCI move to SAN given the position FEN. Returns UCI on failure. */
function uciToSan(fen: string, uci: string): string {
  if (!fen || !uci) return uci;
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
    const res = chess.move({ from, to, promotion });
    return res?.san ?? uci;
  } catch {
    return uci;
  }
}

type QualityCounts = Record<MoveQuality, number>;

function buildSummary(moves: MoveAnalysis[]): QualityCounts {
  const c: QualityCounts = { excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const mv of moves) {
    if (mv.label) c[mv.label]++;
  }
  return c;
}

function getCriticalMoments(moves: MoveAnalysis[]): MoveAnalysis[] {
  return moves.filter(
    (m) => m.label === "mistake" || m.label === "blunder" || (m.evalLossCp ?? 0) >= 150,
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EvalBar({ lines, t }: { lines: AnalysisLine[]; t: PanelText }) {
  const whitePct = evalToWhitePct(lines);
  const evalStr = formatEvalStr(lines);
  const desc = evalDescription(lines, t);

  return (
    <div className="space-y-1.5">
      {/* Visual bar: Black left, White right */}
      <div className="relative flex h-5 rounded-full overflow-hidden border border-border/30">
        <div
          className="h-full bg-zinc-800"
          style={{ width: `${100 - whitePct}%`, transition: "width 0.6s ease" }}
        />
        <div
          className="h-full bg-zinc-100 dark:bg-zinc-200"
          style={{ width: `${whitePct}%`, transition: "width 0.6s ease" }}
        />
      </div>
      {/* Labels: side — numeric eval — side */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground shrink-0">♟ {t.black}</span>
        <div className="flex-1 flex flex-col items-center leading-tight">
          <span
            className="font-mono font-bold text-foreground text-sm tabular-nums"
            data-testid="eval-value"
          >
            {evalStr}
          </span>
          <span className="text-muted-foreground text-[10px]">{desc}</span>
        </div>
        <span className="text-muted-foreground shrink-0">♔ {t.white}</span>
      </div>
    </div>
  );
}

const QUALITY_META: Record<MoveQuality, { color: string; icon: string }> = {
  excellent: { color: "text-green-600 dark:text-green-400", icon: "⭐" },
  good: { color: "text-emerald-600 dark:text-emerald-400", icon: "✓" },
  inaccuracy: { color: "text-yellow-600 dark:text-yellow-400", icon: "?!" },
  mistake: { color: "text-orange-500 dark:text-orange-400", icon: "?" },
  blunder: { color: "text-red-600 dark:text-red-400", icon: "??" },
};

const QUALITY_KEYS: MoveQuality[] = ["excellent", "good", "inaccuracy", "mistake", "blunder"];

function QualitySummary({ summary, t }: { summary: QualityCounts; t: PanelText }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{t.qualitySummary}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {QUALITY_KEYS.map((key) => {
          const { color, icon } = QUALITY_META[key];
          return (
            <div key={key} className="flex items-center gap-1.5 min-w-0">
              <span className={`text-xs font-mono w-5 text-center shrink-0 ${color}`}>{icon}</span>
              <span className="text-xs text-muted-foreground truncate flex-1">
                {t[key as keyof PanelText] as string}
              </span>
              <span
                className={`text-xs font-bold tabular-nums shrink-0 ${color}`}
                data-testid={`quality-count-${key}`}
              >
                {summary[key]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BestMovesSection({
  lines,
  finalFen,
  t,
}: {
  lines: AnalysisLine[];
  finalFen: string;
  t: PanelText;
}) {
  if (lines.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{t.bestMoves}</p>
      {lines.slice(0, 2).map((line, idx) => {
        const san = uciToSan(finalFen, line.move);
        const evalStr =
          line.mateWhite !== undefined
            ? line.mateWhite > 0
              ? `M+${line.mateWhite}`
              : `M${line.mateWhite}`
            : line.scoreCpWhite !== undefined
              ? (line.scoreCpWhite >= 0 ? "+" : "") + (line.scoreCpWhite / 100).toFixed(1)
              : "?";
        return (
          <div
            key={idx}
            className="flex items-center gap-2"
            data-testid={`best-move-${idx + 1}`}
          >
            <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">
              {idx + 1}.
            </span>
            <span className="font-mono text-xs font-semibold text-foreground">{san}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">{evalStr}</span>
          </div>
        );
      })}
    </div>
  );
}

function CriticalMomentsSection({
  moments,
  t,
}: {
  moments: MoveAnalysis[];
  t: PanelText;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
        {t.criticalMoments}
      </p>
      {moments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.noCritical}</p>
      ) : (
        <div className="space-y-0.5">
          {moments.slice(0, 6).map((mv) => {
            const { color, icon } = QUALITY_META[mv.label ?? "mistake"];
            const lossPawns =
              mv.evalLossCp !== undefined
                ? `${(-mv.evalLossCp / 100).toFixed(1)}`
                : null;
            const sideStr = mv.side === "w" ? t.white : t.black;
            return (
              <div
                key={mv.ply}
                className="flex items-center gap-1.5 text-xs py-0.5"
                data-testid={`critical-moment-${mv.ply}`}
              >
                <span className={`font-mono font-bold w-5 text-center shrink-0 ${color}`}>
                  {icon}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {mv.moveNumber}. {sideStr}
                </span>
                <span className="font-mono font-medium text-foreground">{mv.san}</span>
                {lossPawns && (
                  <span className={`ml-auto tabular-nums shrink-0 ${color}`}>{lossPawns}</span>
                )}
              </div>
            );
          })}
          {moments.length > 6 && (
            <p className="text-[10px] text-muted-foreground pl-6">+{moments.length - 6}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Public props & component ─────────────────────────────────────────────────

export interface AnalysisPanelProps {
  pgn: string;
  lang?: Lang;
  /** Stockfish search depth (default 10). Higher = slower but more accurate. */
  depth?: number;
}

export function AnalysisPanel({ pgn, lang = "ca", depth = 10 }: AnalysisPanelProps) {
  const t = PANEL_TEXT[lang];
  const { status, progress, analysis, error, analyze, abort, reset } =
    useStockfishAnalysis();

  const isAnalyzing = status === "analyzing";
  const isDone = status === "done";
  const hasResult = isDone && analysis !== null;

  const finalLines = analysis?.finalPositionLines ?? [];
  const finalFen = analysis?.moves[analysis.moves.length - 1]?.fenAfter ?? "";
  const moves = analysis?.moves ?? [];
  const summary = buildSummary(moves);
  const criticals = getCriticalMoments(moves);

  return (
    <div className="space-y-3" data-testid="analysis-panel">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          {t.title}
        </span>
        <div className="flex items-center gap-1.5">
          {isAnalyzing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={abort}
              className="h-7 text-xs gap-1"
              data-testid="button-analysis-stop"
            >
              <Square className="w-3 h-3" />
              {t.stop}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant={isDone ? "outline" : "default"}
                onClick={() => analyze(pgn, { depth })}
                disabled={isAnalyzing}
                className="h-7 text-xs"
                data-testid="button-analysis-start"
              >
                {t.analyze}
              </Button>
              {(isDone || status === "error" || status === "aborted") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  className="h-7 w-7 p-0"
                  data-testid="button-analysis-reset"
                  title={t.reset}
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Status ─────────────────────────────────────────────────────── */}
      {isAnalyzing && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            {t.statusAnalyzing} · {progress}%
          </div>
          <Progress value={progress} className="h-1.5" data-testid="analysis-progress" />
        </div>
      )}

      {status === "idle" && (
        <p className="text-xs text-muted-foreground">{t.statusIdle}</p>
      )}

      {status === "error" && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{t.statusError}{error ? `: ${error}` : ""}</span>
        </div>
      )}

      {status === "aborted" && (
        <p className="text-xs text-muted-foreground">{t.statusAborted}</p>
      )}

      {isDone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
          {t.statusDone(moves.length)}
        </div>
      )}

      {/* ── Content (only when done) ────────────────────────────────────── */}
      {hasResult && (
        <div className="border-t border-border/40 pt-3 space-y-4">
          {/* Eval bar */}
          <EvalBar lines={finalLines} t={t} />

          {/* Best moves from final position */}
          {finalLines.length > 0 && finalFen && (
            <BestMovesSection lines={finalLines} finalFen={finalFen} t={t} />
          )}

          {/* Quality summary */}
          <QualitySummary summary={summary} t={t} />

          {/* Critical moments */}
          <CriticalMomentsSection moments={criticals} t={t} />
        </div>
      )}
    </div>
  );
}
