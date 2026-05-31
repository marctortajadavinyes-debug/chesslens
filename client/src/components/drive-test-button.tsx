import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  requestGoogleDriveToken,
  ensureChessDriveFolder,
  uploadPgnToDrive,
} from "@/lib/google-drive";
import { CloudIcon, Loader2, UploadCloud } from "lucide-react";

const LABEL_CONNECT: Record<string, string> = {
  ca: "Prova Google Drive",
  es: "Probar Google Drive",
  en: "Test Google Drive",
};

const LABEL_UPLOAD: Record<string, string> = {
  ca: "Puja PGN de prova",
  es: "Subir PGN de prueba",
  en: "Upload test PGN",
};

const TOAST_CONNECTED_TITLE: Record<string, string> = {
  ca: "Google Drive connectat",
  es: "Google Drive conectado",
  en: "Google Drive connected",
};

const TOAST_CONNECTED_DESC: Record<string, string> = {
  ca: "carpeta preparada",
  es: "carpeta preparada",
  en: "folder ready",
};

const TOAST_UPLOAD_TITLE: Record<string, string> = {
  ca: "PGN de prova pujat a Drive",
  es: "PGN de prueba subido a Drive",
  en: "Test PGN uploaded to Drive",
};

interface DriveTestButtonProps {
  appLanguage?: string;
}

export function DriveTestButton({ appLanguage = "ca" }: DriveTestButtonProps) {
  const [connectPending, setConnectPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { toast } = useToast();

  const lang = ["ca", "es", "en"].includes(appLanguage) ? appLanguage : "ca";

  async function handleConnect() {
    setConnectPending(true);
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

      const folderResult = await ensureChessDriveFolder(
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

      setAccessToken(tokenResult.accessToken);
      toast({
        title: TOAST_CONNECTED_TITLE[lang],
        description: TOAST_CONNECTED_DESC[lang],
      });
    } finally {
      setConnectPending(false);
    }
  }

  async function handleUpload() {
    const token = accessToken;
    if (!token) return;

    setUploadPending(true);
    try {
      const uploadResult = await uploadPgnToDrive(token);
      if (!uploadResult.ok) {
        toast({
          variant: "destructive",
          title: "Google Drive",
          description: uploadResult.error,
        });
        return;
      }

      toast({ title: TOAST_UPLOAD_TITLE[lang] });
    } finally {
      setUploadPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleConnect}
        disabled={connectPending || uploadPending}
        data-testid="button-drive-test"
        className="text-xs text-muted-foreground border-dashed"
      >
        {connectPending ? (
          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
        ) : (
          <CloudIcon className="w-3 h-3 mr-1.5" />
        )}
        {LABEL_CONNECT[lang]}
      </Button>

      {accessToken && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUpload}
          disabled={uploadPending}
          data-testid="button-drive-upload-test"
          className="text-xs text-muted-foreground border-dashed"
        >
          {uploadPending ? (
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
          ) : (
            <UploadCloud className="w-3 h-3 mr-1.5" />
          )}
          {LABEL_UPLOAD[lang]}
        </Button>
      )}
    </div>
  );
}
