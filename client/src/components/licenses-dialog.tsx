/**
 * licenses-dialog.tsx
 *
 * Modal discret amb avisos de tercers i atribucions.
 * Reutilitzable a la home (Configuració) i a la UI d'anàlisi.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LicensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: {
    title: string;
    stockfish: string;
    pythonChess: string;
    openSource: string;
    gemini: string;
    trademarks: string;
    close: string;
  };
}

export function LicensesDialog({ open, onOpenChange, t }: LicensesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground text-sm leading-relaxed">
            {t.stockfish}
          </p>
          <p className="text-sm leading-relaxed">{t.pythonChess}</p>
          <p className="text-sm leading-relaxed">{t.openSource}</p>
          <p className="text-sm leading-relaxed">{t.gemini}</p>
          <p className="text-sm leading-relaxed border-t pt-3">{t.trademarks}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            data-testid="button-licenses-close"
          >
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
