import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMonto } from "@/components/ui/input-monto";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  actualizarServicioLavadero,
  borrarServicioLavadero,
  listarBoxes,
  listarServicios,
  listarServiciosLavadero,
  type Box,
  type Servicio,
  type ServicioLavadero,
} from "@/lib/servicios";
import { useTabla, type Columna } from "@/lib/use-tabla";
import { BuscadorTabla, EncabezadosTabla } from "@/components/tabla-toolbar";

export const Route = createFileRoute("/ventas")({
  component: VentasPage,
});

const COMENTARIO_MAX = 500;
const TAM_PAGINA = 30;
const GS = new Intl.NumberFormat("es-PY");

const COLUMNAS: Columna<ServicioLavadero>[] = [
  { campo: "fecha", titulo: "Fecha" },
  { campo: "box", titulo: "Box" },
  { campo: "servicio", titulo: "Servicio" },
  { campo: "precio", titulo: "Precio", numerica: true },
];

function VentasPage() {
  const navigate = useNavigate();
  const { user, restaurando } = useAuth();
  const puedeEditar = esAdmin(user);

  const [ventas, setVentas] = useState<ServicioLavadero[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroBox, setFiltroBox] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

  const [editando, setEditando] = useState<ServicioLavadero | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [idBox, setIdBox] = useState("");
  const [idServicio, setIdServicio] = useState("");
  const [fecha, setFecha] = useState("");
  const [precio, setPrecio] = useState("");
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState<ServicioLavadero | null>(null);
  const [borrando, setBorrando] = useState(false);

  const { busqueda, setBusqueda, campo, direccion, ordenarPor, resultado } = useTabla(
    ventas,
    "fecha",
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setPagina(1);
    try {
      const [v, b, s] = await Promise.all([
        listarServiciosLavadero({
          fechaDesde: filtroFecha || undefined,
          fechaHasta: filtroFecha || undefined,
          idBox: filtroBox ? Number(filtroBox) : undefined,
          pagina: 1,
          tamPagina: TAM_PAGINA,
        }),
        listarBoxes(),
        listarServicios(),
      ]);
      setVentas(v.data);
      setTotal(v.total);
      setBoxes(b);
      setServicios(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las ventas");
    } finally {
      setCargando(false);
    }
  }, [filtroFecha, filtroBox]);

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const siguiente = pagina + 1;
      const v = await listarServiciosLavadero({
        fechaDesde: filtroFecha || undefined,
        fechaHasta: filtroFecha || undefined,
        idBox: filtroBox ? Number(filtroBox) : undefined,
        pagina: siguiente,
        tamPagina: TAM_PAGINA,
      });
      setVentas((prev) => [...prev, ...v.data]);
      setPagina(siguiente);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar más ventas");
    } finally {
      setCargandoMas(false);
    }
  };

  useEffect(() => {
    if (restaurando) return;
    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }
    void cargar();
  }, [user, restaurando, navigate, cargar]);

  const totalFacturado = useMemo(
    () => resultado.reduce((acc, v) => acc + v.precio, 0),
    [resultado],
  );

  if (restaurando || !user) return null;

  const abrirEdicion = (v: ServicioLavadero) => {
    setEditando(v);
    setIdBox(String(v.id_box));
    setIdServicio(String(v.id_servicio));
    setFecha(v.fecha);
    setPrecio(String(v.precio));
    setComentario(v.comentario);
    setFormAbierto(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    if (!idBox || !idServicio) {
      toast.error("Elegí box y servicio");
      return;
    }
    if (!precio || Number(precio) <= 0) {
      toast.error("Ingresá un precio válido");
      return;
    }

    setGuardando(true);
    try {
      await actualizarServicioLavadero(editando.id_servicio_lavadero, {
        id_box: Number(idBox),
        id_servicio: Number(idServicio),
        fecha,
        comentario: comentario.trim(),
        precio: Number(precio),
      });
      toast.success("Venta actualizada");
      setFormAbierto(false);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la venta");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await borrarServicioLavadero(aBorrar.id_servicio_lavadero);
      toast.success("Venta eliminada");
      setABorrar(null);
      await cargar();
    } catch (err) {
      setABorrar(null);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la venta");
    } finally {
      setBorrando(false);
    }
  };

  const hayMas = ventas.length < total;

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
            <h1 className="text-[0.95rem] font-semibold">Ventas</h1>
            <p className="truncate text-xs text-muted-foreground">
              {cargando ? "Cargando…" : `${total} en total`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="filtro-box">Box</Label>
            <Select
              value={filtroBox || "__todos__"}
              onValueChange={(v) => setFiltroBox(v === "__todos__" ? "" : v)}
            >
              <SelectTrigger id="filtro-box">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {boxes.map((b) => (
                  <SelectItem key={b.id_box} value={String(b.id_box)}>
                    {b.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-fecha">Fecha</Label>
            <Input
              id="filtro-fecha"
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando ventas…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">No se pudieron cargar las ventas</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </div>
        ) : ventas.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card/70 p-10 text-center backdrop-blur">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary">
              <Receipt className="h-6 w-6" />
            </span>
            <p className="font-medium">No hay ventas para este filtro</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registrá un servicio desde el inicio.
            </p>
          </div>
        ) : (
          <>
            <BuscadorTabla
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar venta…"
              resultados={resultado.length}
              total={ventas.length}
            />
            <div className="mb-3 flex items-baseline justify-between rounded-xl border border-border/60 bg-card/70 px-3.5 py-2.5 backdrop-blur">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total {busqueda ? "(filtrado)" : "cargado"}
              </span>
              <span className="text-sm font-bold tabular-nums">{GS.format(totalFacturado)}</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur">
              <EncabezadosTabla
                columnas={COLUMNAS}
                campo={campo}
                direccion={direccion}
                onOrdenar={ordenarPor}
              />
              {resultado.map((v, i) => (
                <div
                  key={v.id_servicio_lavadero}
                  className={`flex items-center gap-3 p-3.5 ${
                    i > 0 ? "border-t border-border/60" : ""
                  }`}
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-primary/12 text-primary">
                    <Receipt className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <b className="truncate text-sm font-semibold">{v.servicio}</b>
                    <span className="truncate text-xs text-muted-foreground">
                      {v.box} · {v.fecha}
                    </span>
                  </span>
                  <span className="flex-none text-sm font-bold tabular-nums">
                    {GS.format(v.precio)}
                  </span>
                  {puedeEditar && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEdicion(v)}
                        aria-label={`Editar venta de ${v.servicio}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setABorrar(v)}
                        aria-label={`Eliminar venta de ${v.servicio}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {!busqueda && hayMas && (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => void cargarMas()}
                disabled={cargandoMas}
              >
                {cargandoMas ? "Cargando…" : `Mostrar más (${ventas.length} de ${total})`}
              </Button>
            )}
          </>
        )}
      </main>

      <Drawer open={formAbierto} onOpenChange={setFormAbierto}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>Editar venta</DrawerTitle>
              <DrawerDescription>Cambiá los datos del servicio registrado.</DrawerDescription>
            </DrawerHeader>

            <form onSubmit={guardar} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="box">Box</Label>
                  <Select value={idBox} onValueChange={setIdBox}>
                    <SelectTrigger id="box">
                      <SelectValue placeholder="Elegir" />
                    </SelectTrigger>
                    <SelectContent>
                      {boxes.map((b) => (
                        <SelectItem key={b.id_box} value={String(b.id_box)}>
                          {b.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="servicio">Servicio</Label>
                <Select value={idServicio} onValueChange={setIdServicio}>
                  <SelectTrigger id="servicio">
                    <SelectValue placeholder="Elegir servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicios.map((s) => (
                      <SelectItem key={s.id_servicio} value={String(s.id_servicio)}>
                        {s.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="comentario">Observación (opcional)</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {comentario.length}/{COMENTARIO_MAX}
                  </span>
                </div>
                <Textarea
                  id="comentario"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  maxLength={COMENTARIO_MAX}
                  rows={3}
                  placeholder="Detalle del servicio (si lo dejás vacío, se usa el nombre del servicio)"
                />
              </div>

              <Button type="submit" className="h-12 w-full text-base" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </Button>
            </form>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={aBorrar !== null} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a eliminar el servicio «{aBorrar?.servicio}» de {aBorrar?.box} del{" "}
              {aBorrar?.fecha}.
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
