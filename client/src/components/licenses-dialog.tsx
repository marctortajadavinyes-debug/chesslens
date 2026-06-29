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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">{t.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 text-sm text-muted-foreground pr-1">
          <p className="text-foreground text-sm leading-relaxed">
            {t.stockfish}
          </p>
          <p className="text-sm leading-relaxed">{t.pythonChess}</p>
          <p className="text-sm leading-relaxed">{t.openSource}</p>
          <p className="text-sm leading-relaxed">{t.gemini}</p>
          <p className="text-sm leading-relaxed border-t pt-3">{t.trademarks}</p>
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            data-testid="button-licenses-close"
            className="w-full sm:w-auto"
          >
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
