import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Car,
  Droplets,
  LogOut,
  Moon,
  Plus,
  Sun,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/home")({
  component: HomePage,
});

type VehiculoTipo = "auto" | "camioneta";
type Servicio = "basico" | "completo" | "premium" | "detailing";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const [patente, setPatente] = useState("");
  const [tipo, setTipo] = useState<VehiculoTipo>("auto");
  const [servicio, setServicio] = useState<Servicio>("completo");
  const [precio, setPrecio] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/", replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate({ to: "/", replace: true });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!patente.trim()) {
      toast.error("Ingresá la patente");
      return;
    }
    if (!precio || Number(precio) <= 0) {
      toast.error("Ingresá un precio válido");
      return;
    }
    setSaving(true);
    try {
      // TODO: reemplazar por POST a la API Oracle cuando esté disponible.
      await new Promise((r) => setTimeout(r, 500));
      toast.success(`Lavado registrado — ${patente.toUpperCase()}`);
      setPatente("");
      setPrecio("");
      setServicio("completo");
      setTipo("auto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Clean Car</h1>
              <p className="text-xs text-muted-foreground">Nuevo lavado</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Menú">
                <UserIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-xs text-muted-foreground">Sesión</span>
                <span className="truncate font-medium">{user.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggle}>
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" /> Modo claro
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" /> Modo oscuro
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Registrar lavado</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="patente">Patente</Label>
            <Input
              id="patente"
              value={patente}
              onChange={(e) => setPatente(e.target.value.toUpperCase())}
              placeholder="AB123CD"
              maxLength={10}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de vehículo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo("auto")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition ${
                  tipo === "auto"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                <Car className="h-4 w-4" /> Auto
              </button>
              <button
                type="button"
                onClick={() => setTipo("camioneta")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition ${
                  tipo === "camioneta"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                <Truck className="h-4 w-4" /> Camioneta
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servicio">Servicio</Label>
            <Select value={servicio} onValueChange={(v) => setServicio(v as Servicio)}>
              <SelectTrigger id="servicio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="detailing">Detailing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="precio">Precio</Label>
              <Input
                id="precio"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Guardando…" : "Guardar lavado"}
          </Button>
        </form>
      </main>
    </div>
  );
}