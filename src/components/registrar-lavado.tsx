import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMonto } from "@/components/ui/input-monto";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectorModal } from "@/components/selector-modal";
import {
  crearServicioLavadero,
  listarBoxes,
  listarServicios,
  type Box,
  type Servicio,
} from "@/lib/servicios";
import { TicketLavado, type DatosTicket } from "@/components/ticket-lavado";
import { bluetoothDisponible, imprimirTicket } from "@/lib/impresora";

const COMENTARIO_MAX = 500;

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/**
 * Alta en SERVICIOS_LAVADERO. Los campos son los NOT NULL de la tabla;
 * box y servicio se cargan desde BOX_LAV y SERVICIOS_LAV.
 */
export function RegistrarLavado({ onDone }: { onDone?: () => void }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [idBox, setIdBox] = useState("");
  const [idServicio, setIdServicio] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [precio, setPrecio] = useState("");
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarBoxes(), listarServicios()])
      .then(([b, s]) => {
        if (!vivo) return;
        setBoxes(b);
        setServicios(s);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErrorCarga(e instanceof Error ? e.message : "No se pudieron cargar los datos");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Al elegir el servicio se trae su precio de lista (SERVICIOS_LAV.PRECIO),
   * igual que la acción dinámica de la página 14 de APEX. A diferencia de
   * APEX, queda bloqueado: el operador no puede alterar el precio de lista.
   */
  const onServicioChange = (valor: string) => {
    setIdServicio(valor);
    const elegido = servicios.find((s) => String(s.id_servicio) === valor);
    if (elegido?.precio !== undefined) setPrecio(String(elegido.precio));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!idBox) {
      toast.error("Elegí el box");
      return;
    }
    if (!idServicio) {
      toast.error("Elegí el servicio");
      return;
    }
    if (!precio || Number(precio) <= 0) {
      toast.error("Ingresá un precio válido");
      return;
    }

    const box = boxes.find((b) => String(b.id_box) === idBox);
    const servicio = servicios.find((s) => String(s.id_servicio) === idServicio);
    // Sin observación se guarda la descripción del servicio. El default vive en
    // el backend (INSERTAR en servicios.sql), pero solo se aplica si el
    // comentario llega NULL: una cadena vacía lo saltea y la fila queda sin
    // descripción. Por eso el fallback se resuelve acá antes de mandarlo.
    const comentarioFinal = comentario.trim() || servicio?.descripcion || "";

    setSaving(true);
    try {
      await crearServicioLavadero({
        id_box: Number(idBox),
        id_servicio: Number(idServicio),
        fecha,
        comentario: comentarioFinal,
        precio: Number(precio),
      });
      toast.success("Servicio registrado");
      setTicket({
        fecha,
        box: box?.descripcion ?? "",
        servicio: servicio?.descripcion ?? "",
        comentario: comentarioFinal,
        precio: Number(precio),
      });
      setIdBox("");
      setIdServicio("");
      setPrecio("");
      setComentario("");
      setFecha(todayISO());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el servicio");
    } finally {
      setSaving(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando boxes y servicios…
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-medium text-destructive">No se pudieron cargar los datos</p>
        <p className="mt-1 text-muted-foreground">{errorCarga}</p>
      </div>
    );
  }

  /**
   * Impresión directa por Bluetooth. Sin soporte (iOS, Firefox) se cae al
   * diálogo del navegador, que usa el ticket oculto de <TicketLavado>.
   */
  const onImprimir = async () => {
    if (!bluetoothDisponible()) {
      window.print();
      return;
    }
    setImprimiendo(true);
    try {
      await imprimirTicket(ticket!);
      toast.success("Ticket enviado a la impresora");
    } catch (err) {
      // Cancelar el selector de dispositivos no es un error que valga avisar.
      if (err instanceof DOMException && err.name === "NotFoundError") return;
      toast.error(err instanceof Error ? err.message : "No se pudo imprimir");
    } finally {
      setImprimiendo(false);
    }
  };

  if (ticket) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          <p className="font-medium text-success">Servicio registrado</p>
          <p className="mt-1 text-muted-foreground">
            {ticket.servicio} · {ticket.box}
          </p>
        </div>
        <TicketLavado datos={ticket} />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 text-base"
            disabled={imprimiendo}
            onClick={() => void onImprimir()}
          >
            {imprimiendo ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-4 w-4" />
            )}
            {imprimiendo ? "Imprimiendo…" : "Imprimir"}
          </Button>
          <Button type="button" className="h-12 flex-1 text-base" onClick={onDone}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="box">Box</Label>
          <SelectorModal
            id="box"
            titulo="Elegir box"
            placeholder="Elegir"
            buscarPlaceholder="Buscar box…"
            valor={idBox}
            onChange={setIdBox}
            opciones={boxes.map((b) => ({ valor: String(b.id_box), etiqueta: b.descripcion }))}
          />
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
        <SelectorModal
          id="servicio"
          titulo="Elegir servicio"
          placeholder="Elegir servicio"
          buscarPlaceholder="Buscar servicio…"
          valor={idServicio}
          onChange={onServicioChange}
          opciones={servicios.map((s) => ({
            valor: String(s.id_servicio),
            etiqueta: s.descripcion,
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="precio">Precio</Label>
        <InputMonto
          id="precio"
          value={precio}
          onChange={setPrecio}
          placeholder="0"
          className="tabular-nums disabled:opacity-100"
          disabled
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

      <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
        {saving ? "Guardando…" : "Guardar servicio"}
      </Button>
    </form>
  );
}
