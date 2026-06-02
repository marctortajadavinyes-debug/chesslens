import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PgnMetadata, UserColor } from "@/lib/pgn-metadata";

type AppLanguage = "ca" | "en" | "es";

interface DialogText {
  title: string;
  notice: string;
  white: string;
  black: string;
  dateLabel: string;
  result: string;
  iPlayedAs: string;
  colorWhite: string;
  colorBlack: string;
  badgeMe: string;
  badgeRival: string;
  firstWhiteMoves: string;
  firstBlackMoves: string;
  cancel: string;
  confirm: string;
}

const TEXT: Record<AppLanguage, DialogText> = {
  ca: {
    title: "Revisa les dades de la partida",
    notice:
      "Revisa aquestes dades. ChessLens les farà servir per trobar ràpidament les teves partides per rival, data, color o obertura.",
    white: "Blanques",
    black: "Negres",
    dateLabel: "Data (AAAA-MM-DD)",
    result: "Resultat",
    iPlayedAs: "Jo jugava amb",
    colorWhite: "Blanques",
    colorBlack: "Negres",
    badgeMe: "Jo",
    badgeRival: "Rival",
    firstWhiteMoves: "Primeres jugades blanques",
    firstBlackMoves: "Primeres jugades negres",
    cancel: "Cancel·lar",
    confirm: "Confirmar i guardar a Drive",
  },
  en: {
    title: "Review game data",
    notice:
      "Review this data. ChessLens will use it to quickly find your games by opponent, date, color, or opening.",
    white: "White",
    black: "Black",
    dateLabel: "Date (YYYY-MM-DD)",
    result: "Result",
    iPlayedAs: "I played as",
    colorWhite: "White",
    colorBlack: "Black",
    badgeMe: "Me",
    badgeRival: "Rival",
    firstWhiteMoves: "First white moves",
    firstBlackMoves: "First black moves",
    cancel: "Cancel",
    confirm: "Confirm and save to Drive",
  },
  es: {
    title: "Revisa los datos de la partida",
    notice:
      "Revisa estos datos. ChessLens los usará para encontrar rápidamente tus partidas por rival, fecha, color o apertura.",
    white: "Blancas",
    black: "Negras",
    dateLabel: "Fecha (AAAA-MM-DD)",
    result: "Resultado",
    iPlayedAs: "Yo jugaba con",
    colorWhite: "Blancas",
    colorBlack: "Negras",
    badgeMe: "Yo",
    badgeRival: "Rival",
    firstWhiteMoves: "Primeras jugadas blancas",
    firstBlackMoves: "Primeras jugadas negras",
    cancel: "Cancelar",
    confirm: "Confirmar y guardar en Drive",
  },
};

const RESULTS = ["*", "1-0", "0-1", "1/2-1/2"];

interface SaveGameMetadataDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (meta: PgnMetadata) => void;
  initialMeta: PgnMetadata;
  appLanguage?: AppLanguage;
  isPending?: boolean;
}

export function SaveGameMetadataDialog({
  open,
  onClose,
  onConfirm,
  initialMeta,
  appLanguage = "ca",
  isPending = false,
}: SaveGameMetadataDialogProps) {
  const t = TEXT[appLanguage] ?? TEXT.ca;
  const [meta, setMeta] = useState<PgnMetadata>(initialMeta);

  useEffect(() => {
    if (open) setMeta(initialMeta);
  }, [open, initialMeta]);

  function field(key: keyof PgnMetadata, value: string) {
    setMeta((prev) => ({ ...prev, [key]: value }));
  }

  function handleColorSelect(color: UserColor) {
    setMeta((prev) => ({
      ...prev,
      userColor: color,
      opponent:
        color === "white"
          ? prev.black
          : color === "black"
            ? prev.white
            : prev.opponent,
    }));
  }

  const formattedWhiteMoves = meta.firstWhiteMoves
    ? meta.firstWhiteMoves.split(",").join(", ")
    : "—";
  const formattedBlackMoves = meta.firstBlackMoves
    ? meta.firstBlackMoves.split(",").join(", ")
    : "—";

  const colorKnown = meta.userColor === "white" || meta.userColor === "black";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="drive-meta-dialog-title">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {t.notice}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* White */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="meta-white" className="text-xs font-medium">
                {t.white}
              </Label>
              {colorKnown && (
                <Badge
                  variant={meta.userColor === "white" ? "default" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4"
                  data-testid="badge-white-role"
                >
                  {meta.userColor === "white" ? t.badgeMe : t.badgeRival}
                </Badge>
              )}
            </div>
            <Input
              id="meta-white"
              value={meta.white}
              onChange={(e) => {
                field("white", e.target.value);
                if (meta.userColor === "black") {
                  setMeta((prev) => ({
                    ...prev,
                    white: e.target.value,
                    opponent: e.target.value,
                  }));
                } else {
                  field("white", e.target.value);
                }
              }}
              className="h-8 text-sm"
              data-testid="input-meta-white"
              disabled={isPending}
            />
          </div>

          {/* Black */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="meta-black" className="text-xs font-medium">
                {t.black}
              </Label>
              {colorKnown && (
                <Badge
                  variant={meta.userColor === "black" ? "default" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4"
                  data-testid="badge-black-role"
                >
                  {meta.userColor === "black" ? t.badgeMe : t.badgeRival}
                </Badge>
              )}
            </div>
            <Input
              id="meta-black"
              value={meta.black}
              onChange={(e) => {
                if (meta.userColor === "white") {
                  setMeta((prev) => ({
                    ...prev,
                    black: e.target.value,
                    opponent: e.target.value,
                  }));
                } else {
                  field("black", e.target.value);
                }
              }}
              className="h-8 text-sm"
              data-testid="input-meta-black"
              disabled={isPending}
            />
          </div>

          {/* Compact color selector — shown only when unknown */}
          {!colorKnown && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">{t.iPlayedAs}</Label>
              <Select
                value=""
                onValueChange={(v) => handleColorSelect(v as UserColor)}
                disabled={isPending}
              >
                <SelectTrigger
                  className="h-8 text-sm"
                  data-testid="select-meta-i-played-as"
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">{t.colorWhite}</SelectItem>
                  <SelectItem value="black">{t.colorBlack}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="meta-date" className="text-xs font-medium">
              {t.dateLabel}
            </Label>
            <Input
              id="meta-date"
              value={meta.date}
              onChange={(e) => field("date", e.target.value)}
              className="h-8 text-sm"
              data-testid="input-meta-date"
              disabled={isPending}
            />
          </div>

          {/* Result */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{t.result}</Label>
            <Select
              value={meta.result || "*"}
              onValueChange={(v) => field("result", v)}
              disabled={isPending}
            >
              <SelectTrigger
                className="h-8 text-sm"
                data-testid="select-meta-result"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* First moves — read only */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{t.firstWhiteMoves}</Label>
            <p
              className="text-sm text-muted-foreground font-mono px-3 py-1.5 bg-muted/40 rounded-md"
              data-testid="text-first-white-moves"
            >
              {formattedWhiteMoves}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">{t.firstBlackMoves}</Label>
            <p
              className="text-sm text-muted-foreground font-mono px-3 py-1.5 bg-muted/40 rounded-md"
              data-testid="text-first-black-moves"
            >
              {formattedBlackMoves}
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            data-testid="button-drive-meta-cancel"
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(meta)}
            disabled={isPending}
            data-testid="button-drive-meta-confirm"
          >
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
