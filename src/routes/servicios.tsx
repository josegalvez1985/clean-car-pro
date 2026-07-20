import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ListOrdered, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMonto } from "@/components/ui/input-monto";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  actualizarServicio,
  borrarServicio,
  crearServicio,
  listarCatalogo,
  type Servicio,
} from "@/lib/servicios";
import { useTabla, type Columna } from "@/lib/use-tabla";
import { BuscadorTabla, EncabezadosTabla } from "@/components/tabla-toolbar";

const COLUMNAS: Columna<Servicio>[] = [
  { campo: "descripcion", titulo: "Descripción" },
  { campo: "porc_comision", titulo: "Comisión", numerica: true },
  { campo: "precio", titulo: "Precio", numerica: true },
];

export const Route = createFileRoute("/servicios")({
  component: ServiciosPage,
});

const DESCRIPCION_MAX = 500;
const GS = new Intl.NumberFormat("es-PY");

function ServiciosPage() {
  const navigate = useNavigate();
  const { user, restaurando } = useAuth();
  const puedeEditar = esAdmin(user);

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<Servicio | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [comision, setComision] = useState("");
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState<Servicio | null>(null);
  const [borrando, setBorrando] = useState(false);

  const { busqueda, setBusqueda, campo, direccion, ordenarPor, resultado } = useTabla(
    servicios,
    "descripcion",
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setServicios(await listarCatalogo());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los servicios");
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
    setPrecio("");
    setComision("");
    setActivo(true);
    setFormAbierto(true);
  };

  const abrirEdicion = (s: Servicio) => {
    setEditando(s);
    setDescripcion(s.descripcion);
    setPrecio(String(s.precio));
    setComision(String(s.porc_comision));
    setActivo(s.estado === "A");
    setFormAbierto(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = descripcion.trim();
    if (!desc) {
      toast.error("La descripción es obligatoria");
      return;
    }
    if (precio === "" || Number(precio) < 0) {
      toast.error("Ingresá un precio válido");
      return;
    }
    const comisionNum = comision === "" ? 0 : Number(comision);
    if (comisionNum < 0 || comisionNum > 100) {
      toast.error("La comisión debe estar entre 0 y 100");
      return;
    }

    const datos = {
      descripcion: desc,
      estado: activo ? "A" : "I",
      precio: Number(precio),
      porc_comision: comisionNum,
    };

    setGuardando(true);
    try {
      if (editando) {
        await actualizarServicio(editando.id_servicio, datos);
        toast.success("Servicio actualizado");
      } else {
        await crearServicio(datos);
        toast.success("Servicio creado");
      }
      setFormAbierto(false);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el servicio");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await borrarServicio(aBorrar.id_servicio);
      toast.success("Servicio eliminado");
      setABorrar(null);
      await cargar();
    } catch (err) {
      // Cerrar igual el diálogo: si no, el error queda tapado por el overlay.
      setABorrar(null);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el servicio");
    } finally {
      setBorrando(false);
    }
  };

  const activos = servicios.filter((s) => s.estado === "A").length;

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
            <h1 className="text-[0.95rem] font-semibold">Servicios</h1>
            <p className="truncate text-xs text-muted-foreground">
              {cargando ? "Cargando…" : `${activos} activos de ${servicios.length}`}
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
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando servicios…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">No se pudieron cargar los servicios</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </div>
        ) : servicios.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card/70 p-10 text-center backdrop-blur">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-warning/20 text-warning">
              <ListOrdered className="h-6 w-6" />
            </span>
            <p className="font-medium">Todavía no hay servicios</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Creá el primero para poder cargar lavados.
            </p>
            <Button onClick={abrirNuevo} className="mt-4">
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo servicio
            </Button>
          </div>
        ) : (
          <>
            <BuscadorTabla
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar servicio…"
              resultados={resultado.length}
              total={servicios.length}
            />
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur">
              <EncabezadosTabla
                columnas={COLUMNAS}
                campo={campo}
                direccion={direccion}
                onOrdenar={ordenarPor}
              />
              {resultado.map((s, i) => (
                <div
                  key={s.id_servicio}
                  className={`flex items-center gap-3 p-3.5 ${
                    i > 0 ? "border-t border-border/60" : ""
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${
                      s.estado === "A"
                        ? "bg-warning/20 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <ListOrdered className="h-[18px] w-[18px]" />
                  </span>

                  {/* El chip va en la segunda línea: en pantalla angosta, al lado
                      del nombre le robaba el ancho y lo truncaba. */}
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <b
                      className={`truncate text-sm font-semibold ${
                        s.estado === "A" ? "" : "text-muted-foreground line-through"
                      }`}
                    >
                      {s.descripcion}
                    </b>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap tabular-nums">
                        Comisión {s.porc_comision}%
                      </span>
                      {s.estado !== "A" && (
                        <span className="flex-none rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide">
                          Inactivo
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="flex-none text-sm font-bold tabular-nums">
                    {GS.format(s.precio)}
                  </span>

                  {puedeEditar && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEdicion(s)}
                        aria-label={`Editar ${s.descripcion}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setABorrar(s)}
                        aria-label={`Eliminar ${s.descripcion}`}
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
          <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>{editando ? "Editar servicio" : "Nuevo servicio"}</DrawerTitle>
              <DrawerDescription>
                {editando ? "Cambiá los datos del servicio." : "Agregá un servicio al catálogo."}
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
                  placeholder="Lavado completo"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio</Label>
                  <InputMonto
                    id="precio"
                    value={precio}
                    onChange={setPrecio}
                    placeholder="0"
                    className="tabular-nums"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comision">Comisión (%)</Label>
                  <Input
                    id="comision"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={comision}
                    onChange={(e) => setComision(e.target.value)}
                    placeholder="0"
                    className="tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3.5">
                <div className="leading-tight">
                  <Label htmlFor="activo" className="cursor-pointer">
                    Servicio activo
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Los inactivos no aparecen al cargar un lavado.
                  </p>
                </div>
                <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
              </div>

              <Button type="submit" className="h-12 w-full text-base" disabled={guardando}>
                {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear servicio"}
              </Button>
            </form>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={aBorrar !== null} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a eliminar «{aBorrar?.descripcion}». Si tiene lavados registrados no se podrá
              borrar; en ese caso conviene marcarlo como inactivo.
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
