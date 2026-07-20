import { useMemo, useState } from "react";

/**
 * Búsqueda global + ordenamiento por columna para las listas de ABM.
 *
 * La búsqueda recorre TODOS los campos de cada fila (número o texto), así el
 * usuario puede escribir cualquier dato — descripción, precio, comisión — sin
 * elegir antes en qué columna buscar.
 */

export interface Columna<T> {
  /** Clave del objeto por la que se ordena. */
  campo: keyof T;
  /** Encabezado visible. */
  titulo: string;
  /** Alineación del valor; los números van a la derecha. */
  numerica?: boolean;
}

export type Direccion = "asc" | "desc";

/** Texto buscable de una fila: todos sus valores concatenados. */
function textoDe(fila: object): string {
  return Object.values(fila)
    .filter((v) => v !== null && v !== undefined)
    .join(" ")
    .toLowerCase();
}

/** Compara respetando el tipo: números por valor, texto con locale español. */
function comparar(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "es", { sensitivity: "base" });
}

export function useTabla<T extends object>(filas: T[], campoInicial: keyof T) {
  const [busqueda, setBusqueda] = useState("");
  const [campo, setCampo] = useState<keyof T>(campoInicial);
  const [direccion, setDireccion] = useState<Direccion>("asc");

  /** Clic en un encabezado: alterna dirección si ya estaba activo. */
  const ordenarPor = (nuevo: keyof T) => {
    if (nuevo === campo) {
      setDireccion((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setCampo(nuevo);
      setDireccion("asc");
    }
  };

  const resultado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // Cada palabra debe aparecer en algún campo: "lavado 85000" funciona.
    const terminos = q ? q.split(/\s+/) : [];

    const filtradas = terminos.length
      ? filas.filter((f) => {
          const texto = textoDe(f);
          return terminos.every((t) => texto.includes(t));
        })
      : filas;

    return [...filtradas].sort((a, b) => {
      const r = comparar(a[campo], b[campo]);
      return direccion === "asc" ? r : -r;
    });
  }, [filas, busqueda, campo, direccion]);

  return { busqueda, setBusqueda, campo, direccion, ordenarPor, resultado };
}
