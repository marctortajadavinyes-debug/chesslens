import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  requestGoogleDriveToken,
  ensureChessLensDriveFolder,
} from "@/lib/google-drive";
import { CloudIcon, Loader2 } from "lucide-react";

const LABEL: Record<string, string> = {
  ca: "Prova Google Drive",
  es: "Probar Google Drive",
  en: "Test Google Drive",
};

const TOAST_TITLE: Record<string, string> = {
  ca: "Google Drive connectat",
  es: "Google Drive conectado",
  en: "Google Drive connected",
};

const TOAST_DESC: Record<string, string> = {
  ca: "Carpeta ChessLens preparada",
  es: "Carpeta ChessLens preparada",
  en: "ChessLens folder ready",
};

interface DriveTestButtonProps {
  appLanguage?: string;
}

export function DriveTestButton({ appLanguage = "ca" }: DriveTestButtonProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const lang = ["ca", "es", "en"].includes(appLanguage) ? appLanguage : "ca";
  const label = LABEL[lang];

  async function handleClick() {
    setPending(true);
    try {
      const tokenResult = await requestGoogleDriveToken();
      if (!tokenResult.ok) {
        toast({
          variant: "destructive",
          title: "Google Drive",
          description: tokenResult.error,
        });
        return;
      }

      const folderResult = await ensureChessLensDriveFolder(
        tokenResult.accessToken,
      );
      if (!folderResult.ok) {
        toast({
          variant: "destructive",
          title: "Google Drive",
          description: folderResult.error,
        });
        return;
      }

      toast({
        title: TOAST_TITLE[lang],
        description: TOAST_DESC[lang],
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      data-testid="button-drive-test"
      className="text-xs text-muted-foreground border-dashed"
    >
      {pending ? (
        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
      ) : (
        <CloudIcon className="w-3 h-3 mr-1.5" />
      )}
      {label}
    </Button>
  );
}
