import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
}

/**
 * Campo tipo <select> que abre un drawer a pantalla con buscador, en vez del
 * dropdown chico de Radix. Es más fácil de tocar en el celular (cada opción es
 * una fila grande) y filtra al tipear cuando la lista es larga.
 *
 * Controlado: `valor` es el `valor` de la opción elegida (o "" si no hay).
 */
export function SelectorModal({
  id,
  opciones,
  valor,
  onChange,
  placeholder = "Elegir",
  titulo,
  buscarPlaceholder = "Buscar…",
  disabled,
}: {
  id?: string;
  opciones: OpcionSelector[];
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  titulo: string;
  buscarPlaceholder?: string;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const seleccionada = opciones.find((o) => o.valor === valor);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => o.etiqueta.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  const elegir = (v: string) => {
    onChange(v);
    setAbierto(false);
    setBusqueda("");
  };

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAbierto(true)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !seleccionada && "text-muted-foreground",
        )}
      >
        <span className="truncate">{seleccionada?.etiqueta ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      <Drawer open={abierto} onOpenChange={setAbierto}>
        <DrawerContent>
          <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-6">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>{titulo}</DrawerTitle>
            </DrawerHeader>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={buscarPlaceholder}
                className="pl-9"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {filtradas.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin resultados
                </p>
              ) : (
                filtradas.map((o) => {
                  const activa = o.valor === valor;
                  return (
                    <button
                      key={o.valor}
                      type="button"
                      onClick={() => elegir(o.valor)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3.5 text-left text-base",
                        "hover:bg-accent active:bg-accent",
                        activa && "bg-accent font-medium",
                      )}
                    >
                      <span className="min-w-0 truncate">{o.etiqueta}</span>
                      {activa && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
