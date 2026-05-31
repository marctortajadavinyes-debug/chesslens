import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleDriveToken } from "@/lib/google-drive";
import { CloudIcon, Loader2 } from "lucide-react";

const LABEL: Record<string, string> = {
  ca: "Prova Google Drive",
  es: "Probar Google Drive",
  en: "Test Google Drive",
};

interface DriveTestButtonProps {
  appLanguage?: string;
}

export function DriveTestButton({ appLanguage = "ca" }: DriveTestButtonProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const label = LABEL[appLanguage] ?? LABEL.ca;

  async function handleClick() {
    setPending(true);
    try {
      const result = await requestGoogleDriveToken();
      if (result.ok) {
        toast({
          title:
            appLanguage === "es"
              ? "Google Drive conectado"
              : appLanguage === "en"
                ? "Google Drive connected"
                : "Google Drive connectat",
          description:
            appLanguage === "es"
              ? "Acceso concedido con scope drive.file"
              : appLanguage === "en"
                ? "Access granted with drive.file scope"
                : "Accés concedit amb scope drive.file",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Google Drive",
          description: result.error,
        });
      }
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
