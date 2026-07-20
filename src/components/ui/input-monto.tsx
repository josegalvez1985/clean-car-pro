import * as React from "react";
import { Input } from "@/components/ui/input";

const GS = new Intl.NumberFormat("es-PY");

/** Deja solo dígitos; el separador de miles es puramente visual. */
function soloDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Input de monto con separador de miles en vivo (p.ej. "85.000" mientras se
 * escribe). El valor que maneja el formulario es siempre un string de solo
 * dígitos ("85000"), igual que un <input type="number"> pero mostrando el
 * separador. Usar en cualquier campo de precio/monto del proyecto.
 */
export const InputMonto = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
    value: string;
    onChange: (value: string) => void;
  }
>(({ value, onChange, ...props }, ref) => {
  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={value ? GS.format(Number(value)) : ""}
      onChange={(e) => onChange(soloDigitos(e.target.value))}
    />
  );
});
InputMonto.displayName = "InputMonto";
