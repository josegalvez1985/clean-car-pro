import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Boxes as BoxesIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { esAdmin, useAuth } from "@/lib/auth";
import { AquaBackground } from "@/components/aqua-background";
import { actualizarBox, borrarBox, crearBox, listarBoxes, type Box } from "@/lib/servicios";
import { useTabla, type Columna } from "@/lib/use-tabla";
import { BuscadorTabla, EncabezadosTabla } from "@/components/tabla-toolbar";

const COLUMNAS: Columna<Box>[] = [{ campo: "descripcion", titulo: "Descripción" }];

export const Route = createFileRoute("/boxes")({
  component: BoxesPage,
});

const DESCRIPCION_MAX = 500;

function BoxesPage() {
  const navigate = useNavigate();
  const { user, restaurando } = useAuth();
  const puedeEditar = esAdmin(user);

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<Box | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState<Box | null>(null);
  const [borrando, setBorrando] = useState(false);

  const { busqueda, setBusqueda, campo, direccion, ordenarPor, resultado } = useTabla(
    boxes,
    "descripcion",
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setBoxes(await listarBoxes());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los boxes");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (restaurando) return;
    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }
    void cargar();
  }, [user, restaurando, navigate, cargar]);

  if (restaurando || !user) return null;

  const abrirNuevo = () => {
    setEditando(null);
    setDescripcion("");
    setFormAbierto(true);
  };

  const abrirEdicion = (box: Box) => {
    setEditando(box);
    setDescripcion(box.descripcion);
    setFormAbierto(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = descripcion.trim();
    if (!valor) {
      toast.error("La descripción es obligatoria");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await actualizarBox(editando.id_box, valor);
        toast.success("Box actualizado");
      } else {
        await crearBox(valor);
        toast.success("Box creado");
      }
      setFormAbierto(false);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el box");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await borrarBox(aBorrar.id_box);
      toast.success("Box eliminado");
      setABorrar(null);
      await cargar();
    } catch (err) {
      // Cerrar igual el diálogo: si no, el error queda tapado por el overlay.
      setABorrar(null);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el box");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AquaBackground subtle />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/home" })}
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 leading-tight">
            <h1 className="text-[0.95rem] font-semibold">Boxes</h1>
            <p className="truncate text-xs text-muted-foreground">
              {cargando ? "Cargando…" : `${boxes.length} en total`}
            </p>
          </div>
          <Button onClick={abrirNuevo} size="sm" className="ml-auto">
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando boxes…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">No se pudieron cargar los boxes</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </div>
        ) : boxes.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card/70 p-10 text-center backdrop-blur">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary">
              <BoxesIcon className="h-6 w-6" />
            </span>
            <p className="font-medium">Todavía no hay boxes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Creá el primero para poder cargar servicios.
            </p>
            <Button onClick={abrirNuevo} className="mt-4">
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo box
            </Button>
          </div>
        ) : (
          <>
            <BuscadorTabla
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar box…"
              resultados={resultado.length}
              total={boxes.length}
            />
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur">
              <EncabezadosTabla
                columnas={COLUMNAS}
                campo={campo}
                direccion={direccion}
                onOrdenar={ordenarPor}
              />
              {resultado.map((box, i) => (
                <div
                  key={box.id_box}
                  className={`flex items-center gap-3 p-3.5 ${
                    i > 0 ? "border-t border-border/60" : ""
                  }`}
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-primary/12 text-primary">
                    <BoxesIcon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {box.descripcion}
                  </span>
                  {puedeEditar && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEdicion(box)}
                        aria-label={`Editar ${box.descripcion}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setABorrar(box)}
                        aria-label={`Eliminar ${box.descripcion}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <Drawer open={formAbierto} onOpenChange={setFormAbierto}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-4 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>{editando ? "Editar box" : "Nuevo box"}</DrawerTitle>
              <DrawerDescription>
                {editando ? "Cambiá la descripción del box." : "Agregá un box al lavadero."}
              </DrawerDescription>
            </DrawerHeader>
            <form onSubmit={guardar} className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {descripcion.length}/{DESCRIPCION_MAX}
                  </span>
                </div>
                <Input
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={DESCRIPCION_MAX}
                  autoComplete="off"
                  required
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={guardando}>
                {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear box"}
              </Button>
            </form>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={aBorrar !== null} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este box?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a eliminar «{aBorrar?.descripcion}». Si tiene servicios cargados, no se podrá
              borrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarBorrado();
              }}
              disabled={borrando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {borrando ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
