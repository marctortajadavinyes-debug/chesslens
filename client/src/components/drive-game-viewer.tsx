import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChessboardViewer } from "@/components/chessboard-viewer";
import { PgnActions } from "@/components/pgn-actions";
import type { DriveGameFile } from "@/lib/google-drive";

type AppLanguage = "ca" | "en" | "es";

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
