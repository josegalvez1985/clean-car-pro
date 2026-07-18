import { Share, SquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function IosInstallHint({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Instalar Clean Car</DialogTitle>
          <DialogDescription>
            En iPhone/iPad, agregá la app a la pantalla de inicio desde Safari:
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm text-foreground">
          <li className="flex items-center gap-3">
            <Share className="h-5 w-5 shrink-0 text-primary" />
            Tocá el botón <b>Compartir</b> en la barra de Safari.
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus className="h-5 w-5 shrink-0 text-primary" />
            Elegí <b>Agregar a inicio</b> y confirmá.
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
