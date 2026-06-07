import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { PgnActions } from "@/components/pgn-actions";
import { AnalysisPanel } from "@/components/analysis-panel";
import { TrendingUp, X } from "lucide-react";
import type { DriveGameFile } from "@/lib/google-drive";

type AppLanguage = "ca" | "en" | "es";

const ANALYZE_LABEL: Record<AppLanguage, string> = {
  ca: "Analitzar",
  en: "Analyze",
  es: "Analizar",
};

const HIDE_LABEL: Record<AppLanguage, string> = {
  ca: "Amagar",
  en: "Hide",
  es: "Ocultar",
};

interface DriveGameViewerProps {
  file: DriveGameFile;
  pgn: string;
  appLanguage: AppLanguage;
  onClose: () => void;
}

export function DriveGameViewer({
  file,
  pgn,
  appLanguage,
  onClose,
}: DriveGameViewerProps) {
  const p = file.appProperties;
  const white = p.white || "?";
  const black = p.black || "?";
  const date = p.date || "";
  const result = p.result || "";
  const userColor = p.userColor;

  const defaultOrientation: "white" | "black" =
    userColor === "black" ? "black" : "white";
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    defaultOrientation,
  );
  const [showAnalysis, setShowAnalysis] = useState(false);

  const canAnalyze = pgn.trim().length > 0;

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-base leading-snug"
            data-testid="drive-viewer-title"
          >
            {white}{" "}
            <span className="text-muted-foreground font-normal text-sm">
              vs
            </span>{" "}
            {black}
          </DialogTitle>
          {(date || result) && (
            <div className="flex items-center gap-2 pt-1">
              {date && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  data-testid="drive-viewer-date"
                >
                  {date}
                </Badge>
              )}
              {result && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  data-testid="drive-viewer-result"
                >
                  {result}
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 pb-2">
          <ChessboardViewer
            pgn={pgn}
            boardOrientation={boardOrientation}
            onOrientationChange={setBoardOrientation}
            appLanguage={appLanguage}
            scoresheetLanguage={appLanguage}
            enableInput={false}
          />
          <PgnActions pgn={pgn} gameId={0} appLanguage={appLanguage} />

          {canAnalyze && !showAnalysis && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAnalysis(true)}
              data-testid="button-drive-analyze"
              className="gap-1.5"
            >
              <TrendingUp className="w-4 h-4" />
              {ANALYZE_LABEL[appLanguage]}
            </Button>
          )}

          {canAnalyze && showAnalysis && (
            <div className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {ANALYZE_LABEL[appLanguage]}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowAnalysis(false)}
                  data-testid="button-drive-hide-analysis"
                  title={HIDE_LABEL[appLanguage]}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <AnalysisPanel pgn={pgn} lang={appLanguage} depth={16} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
