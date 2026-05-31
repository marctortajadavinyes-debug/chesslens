import { useMemo, useState } from "react";
import { Copy, Download, Share2, CloudUpload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  requestGoogleDriveToken,
  uploadPgnToDrive,
} from "@/lib/google-drive";

type AppLanguage = "ca" | "en" | "es";

interface PgnActionsProps {
  pgn: string;
  gameId: number;
  appLanguage: AppLanguage;
  className?: string;
  size?: "sm" | "default";
}

type ActionsText = {
  title: string;
  copy: string;
  share: string;
  download: string;
  saveToDrive: string;
  copiedTitle: string;
  copiedDescription: string;
  copyErrorTitle: string;
  shareErrorTitle: string;
  pgnNotReady: string;
  pgnInvalid: string;
  driveSavedTitle: string;
  driveConnecting: string;
  driveUploading: string;
  driveSaved: string;
};

const TEXT: Record<AppLanguage, ActionsText> = {
  ca: {
    title: "Accions del PGN",
    copy: "Copiar PGN",
    share: "Compartir",
    download: "Descarregar .pgn",
    saveToDrive: "Guardar a Drive",
    copiedTitle: "PGN copiat",
    copiedDescription: "El PGN s'ha copiat al porta-retalls.",
    copyErrorTitle: "No s'ha pogut copiar el PGN",
    shareErrorTitle: "No s'ha pogut compartir el PGN",
    pgnNotReady: "El PGN encara s'està generant.",
    pgnInvalid: "El PGN no és vàlid encara.",
    driveSavedTitle: "PGN guardat a Drive",
    driveConnecting: "Connectant...",
    driveUploading: "Pujant...",
    driveSaved: "Guardat",
  },
  en: {
    title: "PGN actions",
    copy: "Copy PGN",
    share: "Share",
    download: "Download .pgn",
    saveToDrive: "Save to Drive",
    copiedTitle: "PGN copied",
    copiedDescription: "The PGN has been copied to the clipboard.",
    copyErrorTitle: "Could not copy the PGN",
    shareErrorTitle: "Could not share the PGN",
    pgnNotReady: "PGN is still being generated.",
    pgnInvalid: "PGN is not valid yet.",
    driveSavedTitle: "PGN saved to Drive",
    driveConnecting: "Connecting...",
    driveUploading: "Uploading...",
    driveSaved: "Saved",
  },
  es: {
    title: "Acciones del PGN",
    copy: "Copiar PGN",
    share: "Compartir",
    download: "Descargar .pgn",
    saveToDrive: "Guardar en Drive",
    copiedTitle: "PGN copiado",
    copiedDescription: "El PGN se ha copiado al portapapeles.",
    copyErrorTitle: "No se ha podido copiar el PGN",
    shareErrorTitle: "No se ha podido compartir el PGN",
    pgnNotReady: "El PGN se está generando.",
    pgnInvalid: "El PGN aún no es válido.",
    driveSavedTitle: "PGN guardado en Drive",
    driveConnecting: "Conectando...",
    driveUploading: "Subiendo...",
    driveSaved: "Guardado",
  },
};

type DriveState = "idle" | "connecting" | "uploading" | "saved" | "error";

function sanitizeForFilename(s: string): string {
  return s
    .replace(/\*/g, "")
    .replace(/[/\\:?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

function pgnHeader(pgn: string, tag: string): string {
  const m = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`));
  return m ? m[1].trim() : "";
}

function buildPgnFilename(pgn: string, gameId: number): string {
  const rawWhite = pgnHeader(pgn, "White");
  const rawBlack = pgnHeader(pgn, "Black");
  const rawDate = pgnHeader(pgn, "Date");

  const white = sanitizeForFilename(rawWhite);
  const black = sanitizeForFilename(rawBlack);
  const date = rawDate
    .replace(/\./g, "-")
    .replace(/[^0-9\-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!white && !black) {
    return `chess-game-${gameId}.pgn`;
  }

  const nameParts: string[] = [];
  if (white) nameParts.push(white);
  nameParts.push("vs");
  if (black) nameParts.push(black);
  if (date) nameParts.push(date);

  const base = nameParts.join("_").replace(/_{2,}/g, "_");
  return base + ".pgn";
}

function isErrorPgn(pgn: string) {
  return pgn.trim().startsWith("ERROR:");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy fallback
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function PgnActions({
  pgn,
  gameId,
  appLanguage,
  className,
  size = "sm",
}: PgnActionsProps) {
  const t = TEXT[appLanguage] ?? TEXT.ca;
  const { toast } = useToast();
  const [isWorking, setIsWorking] = useState(false);
  const [driveState, setDriveState] = useState<DriveState>("idle");
  const [driveToken, setDriveToken] = useState<string | null>(null);

  const trimmedPgn = useMemo(() => (pgn ?? "").trim(), [pgn]);
  const hasPgn = trimmedPgn.length > 0;
  const invalid = hasPgn && isErrorPgn(trimmedPgn);
  const disabled = !hasPgn || invalid || isWorking;
  const drivePending = driveState === "connecting" || driveState === "uploading";

  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  if (!hasPgn) {
    return null;
  }

  const handleCopy = async () => {
    if (disabled) return;
    setIsWorking(true);
    const ok = await copyToClipboard(trimmedPgn);
    setIsWorking(false);

    if (ok) {
      toast({
        title: t.copiedTitle,
        description: t.copiedDescription,
        duration: 1500,
      });
    } else {
      toast({
        title: t.copyErrorTitle,
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (disabled || !canShare) return;
    setIsWorking(true);
    try {
      await (navigator as Navigator & {
        share: (data: ShareData) => Promise<void>;
      }).share({
        title: `ChessLens #${gameId}`,
        text: trimmedPgn,
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "AbortError") {
        toast({
          title: t.shareErrorTitle,
          variant: "destructive",
        });
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownload = () => {
    if (disabled) return;
    try {
      const blob = new Blob([trimmedPgn], {
        type: "application/x-chess-pgn",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildPgnFilename(trimmedPgn, gameId);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({
        title: t.copyErrorTitle,
        variant: "destructive",
      });
    }
  };

  const handleDrive = async () => {
    if (disabled || drivePending) return;
    if (invalid) return;

    const filename = buildPgnFilename(trimmedPgn, gameId);

    try {
      let token = driveToken;

      if (!token) {
        setDriveState("connecting");
        const tokenResult = await requestGoogleDriveToken({ prompt: "" });
        if (!tokenResult.ok) {
          setDriveState("error");
          toast({ variant: "destructive", title: "Google Drive", description: tokenResult.error });
          return;
        }
        token = tokenResult.accessToken;
        setDriveToken(token);
      }

      setDriveState("uploading");
      const uploadResult = await uploadPgnToDrive(token, {
        filename,
        pgn: trimmedPgn,
      });

      if (!uploadResult.ok) {
        setDriveToken(null);
        setDriveState("error");
        toast({ variant: "destructive", title: "Google Drive", description: uploadResult.error });
        return;
      }

      setDriveState("saved");
      toast({ title: t.driveSavedTitle });
    } catch {
      setDriveToken(null);
      setDriveState("error");
      toast({ variant: "destructive", title: "Google Drive", description: "Unexpected error." });
    }
  };

  const driveLabel = (() => {
    if (driveState === "connecting") return t.driveConnecting;
    if (driveState === "uploading") return t.driveUploading;
    if (driveState === "saved") return t.driveSaved;
    return t.saveToDrive;
  })();

  return (
    <div
      className={[
        "rounded-xl border bg-card p-3 space-y-2",
        className ?? "",
      ].join(" ")}
      data-testid="pgn-actions"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t.title}</h3>
      </div>

      {invalid ? (
        <p className="text-xs text-muted-foreground">{t.pgnInvalid}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          size={size}
          onClick={handleCopy}
          disabled={disabled}
          data-testid="button-pgn-copy"
        >
          <Copy className="w-4 h-4 mr-2" />
          {t.copy}
        </Button>

        {canShare && (
          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={handleShare}
            disabled={disabled}
            data-testid="button-pgn-share"
          >
            <Share2 className="w-4 h-4 mr-2" />
            {t.share}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={handleDownload}
          disabled={disabled}
          data-testid="button-pgn-download"
        >
          <Download className="w-4 h-4 mr-2" />
          {t.download}
        </Button>

        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={handleDrive}
          disabled={disabled || drivePending}
          data-testid="button-pgn-save-drive"
        >
          {driveState === "saved" ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <CloudUpload className="w-4 h-4 mr-2" />
          )}
          {driveLabel}
        </Button>
      </div>
    </div>
  );
}
