import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Columna, Direccion } from "@/lib/use-tabla";

/** Buscador global de la lista. Filtra por cualquier campo de la fila. */
export function BuscadorTabla({
  valor,
  onChange,
  placeholder = "Buscar…",
  resultados,
  total,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  resultados: number;
  total: number;
}) {
  return (
    <div className="mb-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar"
          className="pl-9 pr-9"
        />
        {valor && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {valor && (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          {resultados === 0
            ? "Sin resultados"
            : `${resultados} de ${total} ${total === 1 ? "resultado" : "resultados"}`}
        </p>
      )}
    </div>
  );
}

/**
 * Encabezados de columna clicables. Un clic ordena ascendente; otro invierte.
 * Reemplaza los filtros por columna del Interactive Grid de APEX, que en
 * pantalla de celular no entran.
 */
export function EncabezadosTabla<T extends Record<string, unknown>>({
  columnas,
  campo,
  direccion,
  onOrdenar,
}: {
  columnas: Columna<T>[];
  campo: keyof T;
  direccion: Direccion;
  onOrdenar: (c: keyof T) => void;
}) {
  return (
    <div
      role="row"
      className="flex items-center gap-1 border-b border-border/60 bg-muted/40 px-2 py-1.5"
    >
      {columnas.map((c) => {
        const activa = c.campo === campo;
        const Icono = !activa ? ChevronsUpDown : direccion === "asc" ? ArrowUp : ArrowDown;
        return (
          <button
            key={String(c.campo)}
            type="button"
            onClick={() => onOrdenar(c.campo)}
            aria-sort={activa ? (direccion === "asc" ? "ascending" : "descending") : "none"}
            title={`Ordenar por ${c.titulo}`}
            className={`flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide transition hover:bg-accent ${
              c.numerica ? "ml-auto flex-none" : "flex-1"
            } ${activa ? "text-primary" : "text-muted-foreground"}`}
          >
            <span className="truncate">{c.titulo}</span>
            <Icono className="h-3 w-3 flex-none" />
          </button>
        );
      })}
    </div>
  );
}
