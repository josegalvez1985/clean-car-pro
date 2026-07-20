import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  crearServicioLavadero,
  listarBoxes,
  listarServicios,
  type Box,
  type Servicio,
} from "@/lib/servicios";

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
   * igual que la acción dinámica de la página 14 de APEX. Queda editable.
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
    if (!comentario.trim()) {
      toast.error("La observación es obligatoria");
      return;
    }
    if (!precio || Number(precio) <= 0) {
      toast.error("Ingresá un precio válido");
      return;
    }

    setSaving(true);
    try {
      await crearServicioLavadero({
        id_box: Number(idBox),
        id_servicio: Number(idServicio),
        fecha,
        comentario: comentario.trim(),
        precio: Number(precio),
      });
      toast.success("Servicio registrado");
      setIdBox("");
      setIdServicio("");
      setPrecio("");
      setComentario("");
      setFecha(todayISO());
      onDone?.();
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

  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
        <Select value={idServicio} onValueChange={onServicioChange}>
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
        <Input
          id="precio"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="0"
          className="tabular-nums"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="comentario">Observación</Label>
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
          placeholder="Detalle del servicio"
          required
        />
      </div>

      <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
        {saving ? "Guardando…" : "Guardar servicio"}
      </Button>
    </form>
  );
}
