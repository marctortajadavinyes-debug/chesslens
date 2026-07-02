import { useMemo, useState } from "react";
import { Copy, Download, Share2, CloudUpload, Check, ExternalLink, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  requestGoogleDriveToken,
  uploadPgnToDrive,
  uploadImageToDrive,
} from "@/lib/google-drive";
import {
  extractPgnMetadata,
  buildPgnFilename,
  buildFilenameFromMeta,
  buildDriveAppProperties,
  applyMetadataToPgn,
} from "@/lib/pgn-metadata";
import type { PgnMetadata } from "@/lib/pgn-metadata";
import { SaveGameMetadataDialog } from "@/components/save-game-metadata-dialog";

type AppLanguage = "ca" | "en" | "es";

interface PgnActionsProps {
  pgn: string;
  gameId: number;
  appLanguage: AppLanguage;
  className?: string;
  size?: "sm" | "default";
  imageUrls?: string[];
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
  driveUploadingSheet: (current: number, total: number) => string;
  driveSaved: string;
  driveImageErrorTitle: string;
  driveImageErrorDescription: string;
  export: string;
  exportTitle: string;
  exportLichess: string;
  exportLichessDesc: string;
  exportChessCom: string;
  exportChessComDesc: string;
  exportChessBase: string;
  exportChessBaseDesc: string;
  exportLichessToast: string;
  exportChessComToast: string;
  exportChessBaseToast: string;
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
    driveUploadingSheet: (current, total) =>
      `Pujant planella ${current}/${total}...`,
    driveSaved: "Guardat",
    driveImageErrorTitle: "Error en pujar la planella",
    driveImageErrorDescription:
      "El PGN s'ha guardat, però no s'ha pogut pujar alguna imatge.",
    export: "Exportar",
    exportTitle: "Exportar partida",
    exportLichess: "Lichess.org",
    exportLichessDesc: "Copiar PGN i obrir Lichess.org",
    exportChessCom: "Chess.com",
    exportChessComDesc: "Copiar PGN i obrir Chess.com",
    exportChessBase: "ChessBase",
    exportChessBaseDesc: "Descarregar PGN compatible",
    exportLichessToast: "PGN copiat. Enganxa'l a Lichess per importar la partida.",
    exportChessComToast: "PGN copiat. Enganxa'l a Chess.com per carregar la partida.",
    exportChessBaseToast: "PGN descarregat. El pots obrir amb ChessBase.",
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
    driveUploadingSheet: (current, total) =>
      `Uploading scoresheet ${current}/${total}...`,
    driveSaved: "Saved",
    driveImageErrorTitle: "Error uploading scoresheet",
    driveImageErrorDescription:
      "The PGN was saved, but one or more images could not be uploaded.",
    export: "Export",
    exportTitle: "Export game",
    exportLichess: "Lichess.org",
    exportLichessDesc: "Copy PGN and open Lichess.org",
    exportChessCom: "Chess.com",
    exportChessComDesc: "Copy PGN and open Chess.com",
    exportChessBase: "ChessBase",
    exportChessBaseDesc: "Download compatible PGN",
    exportLichessToast: "PGN copied. Paste it into Lichess to import the game.",
    exportChessComToast: "PGN copied. Paste it into Chess.com to load the game.",
    exportChessBaseToast: "PGN downloaded. You can open it with ChessBase.",
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
    driveUploadingSheet: (current, total) =>
      `Subiendo planilla ${current}/${total}...`,
    driveSaved: "Guardado",
    driveImageErrorTitle: "Error al subir la planilla",
    driveImageErrorDescription:
      "El PGN se ha guardado, pero no se ha podido subir alguna imagen.",
    export: "Exportar",
    exportTitle: "Exportar partida",
    exportLichess: "Lichess.org",
    exportLichessDesc: "Copiar PGN y abrir Lichess.org",
    exportChessCom: "Chess.com",
    exportChessComDesc: "Copiar PGN y abrir Chess.com",
    exportChessBase: "ChessBase",
    exportChessBaseDesc: "Descargar PGN compatible",
    exportLichessToast: "PGN copiado. Pégalo en Lichess para importar la partida.",
    exportChessComToast: "PGN copiado. Pégalo en Chess.com para cargar la partida.",
    exportChessBaseToast: "PGN descargado. Puedes abrirlo con ChessBase.",
  },
};

type DriveState = "idle" | "connecting" | "uploading" | "saved" | "error";

const SETTINGS_STORAGE_KEY = "chesslens_user_settings_v1";

function readPlayerAlias(): string {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return "";
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "alias" in parsed) {
      return typeof (parsed as { alias: unknown }).alias === "string"
        ? ((parsed as { alias: string }).alias ?? "")
        : "";
    }
    return "";
  } catch {
    return "";
  }
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

/** Derive image file extension from a data URI. Defaults to .jpg. */
function imageExtFromDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith("data:image/png")) return ".png";
  if (dataUrl.startsWith("data:image/webp")) return ".webp";
  return ".jpg";
}

export function PgnActions({
  pgn,
  gameId,
  appLanguage,
  className,
  size = "sm",
  imageUrls = [],
}: PgnActionsProps) {
  const t = TEXT[appLanguage] ?? TEXT.ca;
  const { toast } = useToast();

  const [isWorking, setIsWorking] = useState(false);
  const [driveState, setDriveState] = useState<DriveState>("idle");
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [showMetaDialog, setShowMetaDialog] = useState(false);
  const [pendingMeta, setPendingMeta] = useState<PgnMetadata | null>(null);
  const [sheetProgress, setSheetProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const trimmedPgn = useMemo(() => (pgn ?? "").trim(), [pgn]);
  const hasPgn = trimmedPgn.length > 0;
  const invalid = hasPgn && isErrorPgn(trimmedPgn);
  const disabled = !hasPgn || invalid || isWorking;
  const drivePending = driveState === "connecting" || driveState === "uploading";

  const hasImages = imageUrls.length > 0;

  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  if (!hasPgn) return null;

  // --- Handlers ---

  const handleCopy = async () => {
    if (disabled) return;
    setIsWorking(true);
    const ok = await copyToClipboard(trimmedPgn);
    setIsWorking(false);
    if (ok) {
      toast({ title: t.copiedTitle, description: t.copiedDescription, duration: 1500 });
    } else {
      toast({ title: t.copyErrorTitle, variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (disabled || !canShare) return;
    setIsWorking(true);
    try {
      await (navigator as Navigator & {
        share: (data: ShareData) => Promise<void>;
      }).share({ title: `ChessLens #${gameId}`, text: trimmedPgn });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "AbortError") {
        toast({ title: t.shareErrorTitle, variant: "destructive" });
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownload = () => {
    if (disabled) return;
    try {
      const blob = new Blob([trimmedPgn], { type: "application/x-chess-pgn" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildPgnFilename(trimmedPgn, gameId);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({ title: t.copyErrorTitle, variant: "destructive" });
    }
  };

  // Step 1: open dialog with auto-detected metadata
  const handleDriveClick = () => {
    if (disabled || drivePending) return;
    const playerAlias = readPlayerAlias();
    const meta = extractPgnMetadata(trimmedPgn, gameId, playerAlias);
    setPendingMeta(meta);
    setShowMetaDialog(true);
  };

  // Step 2: user confirmed metadata → apply to PGN → token → upload PGN → optionally upload images
  const handleConfirmSave = async (meta: PgnMetadata, saveImages: boolean) => {
    setShowMetaDialog(false);

    const correctedPgn = applyMetadataToPgn(trimmedPgn, meta);
    const filename = buildFilenameFromMeta(meta, gameId);
    const appProperties = buildDriveAppProperties(meta);

    // Base name for image filenames (strip .pgn extension)
    const baseName = filename.endsWith(".pgn")
      ? filename.slice(0, -4)
      : filename;

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
      setSheetProgress(null);

      const uploadResult = await uploadPgnToDrive(token, {
        filename,
        pgn: correctedPgn,
        appProperties,
      });

      if (!uploadResult.ok) {
        setDriveToken(null);
        setDriveState("error");
        toast({ variant: "destructive", title: "Google Drive", description: uploadResult.error });
        return;
      }

      const pgnFileId = uploadResult.fileId;

      // Upload scoresheet images if the user opted in
      if (saveImages && hasImages) {
        let imageError = false;

        for (let i = 0; i < imageUrls.length; i++) {
          const dataUrl = imageUrls[i];
          if (!dataUrl || !dataUrl.startsWith("data:")) continue;

          setSheetProgress({ current: i + 1, total: imageUrls.length });

          const ext = imageExtFromDataUrl(dataUrl);
          const imageFilename = `${baseName}_scoresheet-${i + 1}${ext}`;

          const imageAppProperties: Record<string, string> = {
            source: "chesslens",
            type: "scoresheet",
            relatedPgnFileId: pgnFileId,
            relatedPgnName: filename,
            sheetIndex: String(i + 1),
          };

          const imageResult = await uploadImageToDrive(
            token,
            dataUrl,
            imageFilename,
            imageAppProperties,
          );

          if (!imageResult.ok) {
            imageError = true;
            // Continue uploading remaining images even if one fails
          }
        }

        setSheetProgress(null);

        if (imageError) {
          toast({
            variant: "destructive",
            title: t.driveImageErrorTitle,
            description: t.driveImageErrorDescription,
          });
        }
      }

      setDriveState("saved");
      toast({ title: t.driveSavedTitle });
    } catch {
      setDriveToken(null);
      setDriveState("error");
      setSheetProgress(null);
      toast({ variant: "destructive", title: "Google Drive", description: "Unexpected error." });
    }
  };

  const handleMetaClose = () => {
    if (!drivePending) setShowMetaDialog(false);
  };

  // ── Export handlers ──────────────────────────────────────────────────────

  const handleExportLichess = async () => {
    await copyToClipboard(trimmedPgn);
    window.open("https://lichess.org/paste", "_blank", "noopener,noreferrer");
    toast({ title: t.exportLichessToast, duration: 4000 });
  };

  const handleExportChessCom = async () => {
    await copyToClipboard(trimmedPgn);
    window.open("https://www.chess.com/analysis", "_blank", "noopener,noreferrer");
    toast({ title: t.exportChessComToast, duration: 4000 });
  };

  const handleExportChessBase = () => {
    handleDownload();
    toast({ title: t.exportChessBaseToast, duration: 3000 });
  };

  const driveLabel = (() => {
    if (driveState === "connecting") return t.driveConnecting;
    if (driveState === "uploading") {
      if (sheetProgress) {
        return t.driveUploadingSheet(sheetProgress.current, sheetProgress.total);
      }
      return t.driveUploading;
    }
    if (driveState === "saved") return t.driveSaved;
    return t.saveToDrive;
  })();

  return (
    <>
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

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="default"
            size={size}
            onClick={handleCopy}
            disabled={disabled}
            data-testid="button-pgn-copy"
            className="w-full justify-center order-1"
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
              className="w-full justify-center order-5"
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
            className="w-full justify-center order-2"
          >
            <Download className="w-4 h-4 mr-2" />
            {t.download}
          </Button>

          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={handleDriveClick}
            disabled={disabled || drivePending}
            data-testid="button-pgn-save-drive"
            className="w-full justify-center order-3"
          >
            {driveState === "saved" ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <CloudUpload className="w-4 h-4 mr-2" />
            )}
            {driveLabel}
          </Button>

          {/* Exportar — alineat a la dreta quan hi ha espai */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size={size}
                disabled={disabled}
                data-testid="button-pgn-export"
                className="w-full justify-center order-4"
              >
                <Share2 className="w-4 h-4 mr-2" />
                <span className="hidden lg:inline">{t.exportTitle}</span>
                <span className="lg:hidden">{t.export}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1.5 space-y-1">
              <DropdownMenuLabel className="px-1 pb-1">{t.exportTitle}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleExportChessCom}
                data-testid="menu-item-export-chesscom"
                className="flex items-start gap-2.5 cursor-pointer rounded-md px-2.5 py-2 mt-1 bg-black text-white hover:bg-neutral-800 focus:bg-neutral-800 focus:text-white"
              >
                <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">{t.exportChessCom}</span>
                  <span className="text-xs opacity-70">{t.exportChessComDesc}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportLichess}
                data-testid="menu-item-export-lichess"
                className="flex items-start gap-2.5 cursor-pointer rounded-md px-2.5 py-2 bg-slate-100 text-slate-900 hover:bg-slate-200 focus:bg-slate-200 focus:text-slate-900 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:focus:bg-slate-600"
              >
                <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">{t.exportLichess}</span>
                  <span className="text-xs opacity-60">{t.exportLichessDesc}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportChessBase}
                data-testid="menu-item-export-chessbase"
                className="flex items-start gap-2.5 cursor-pointer rounded-md px-2.5 py-2 bg-red-600 text-white hover:bg-red-700 focus:bg-red-700 focus:text-white"
              >
                <FileDown className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">{t.exportChessBase}</span>
                  <span className="text-xs opacity-80">{t.exportChessBaseDesc}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {pendingMeta && (
        <SaveGameMetadataDialog
          open={showMetaDialog}
          onClose={handleMetaClose}
          onConfirm={handleConfirmSave}
          initialMeta={pendingMeta}
          appLanguage={appLanguage}
          isPending={drivePending}
          hasImages={hasImages}
          imageCount={imageUrls.length}
        />
      )}
    </>
  );
}
