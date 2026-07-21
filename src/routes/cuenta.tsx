import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Fingerprint, LogOut, Moon, Smartphone, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useTheme } from "@/lib/theme";
import { AquaBackground } from "@/components/aqua-background";
import { usePwaInstall } from "@/lib/use-pwa-install";
import { IosInstallHint } from "@/components/ios-install-hint";
import {
  biometricAvailable,
  biometricEnabled,
  clearCreds,
  hasRememberedCreds,
  registerBiometric,
} from "@/lib/biometric";

export const Route = createFileRoute("/cuenta")({
  component: CuentaPage,
});

function CuentaPage() {
  const navigate = useNavigate();
  const { user, restaurando, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { canInstall, installed, install, iosHint, dismissIosHint } = usePwaInstall();

  // WebAuthn solo existe en el navegador: leer en efecto para no romper el
  // primer render ni asumir disponibilidad.
  const [bioDisponible, setBioDisponible] = useState(false);
  const [bioActiva, setBioActiva] = useState(false);
  const [hayCreds, setHayCreds] = useState(false);
  const [bioOcupada, setBioOcupada] = useState(false);
  const [salirAbierto, setSalirAbierto] = useState(false);

  useEffect(() => {
    setBioDisponible(biometricAvailable());
    setBioActiva(biometricEnabled());
    setHayCreds(hasRememberedCreds());
  }, []);

  useEffect(() => {
    if (!restaurando && !user) navigate({ to: "/" });
  }, [restaurando, user, navigate]);

  if (restaurando || !user) return null;

  /**
   * La biometría solo desbloquea las credenciales guardadas al marcar
   * "recordarme" en el login: sin ellas no hay nada que desbloquear, así que
   * el switch queda deshabilitado en vez de registrar una credencial inútil.
   */
  const onBiometriaChange = async (activar: boolean) => {
    if (!activar) {
      clearCreds();
      setBioActiva(false);
      setHayCreds(false);
      toast.success("Acceso biométrico desactivado");
      return;
    }

    setBioOcupada(true);
    try {
      const ok = await registerBiometric(user.username);
      if (ok) {
        setBioActiva(true);
        toast.success("Acceso biométrico activado");
      } else {
        toast.error("No se pudo activar el acceso biométrico");
      }
    } finally {
      setBioOcupada(false);
    }
  };

  const confirmarSalida = () => {
    setSalirAbierto(false);
    logout();
    navigate({ to: "/" });
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
            <h1 className="text-[0.95rem] font-semibold">Cuenta</h1>
            <p className="truncate text-xs text-muted-foreground">
              {user.username}
              {esAdmin(user) ? " · Administrador" : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* Apariencia */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold">Apariencia</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <Label htmlFor="modo-oscuro" className="font-medium">
                  Modo oscuro
                </Label>
                <p className="text-xs text-muted-foreground">
                  {theme === "dark" ? "Activado" : "Desactivado"}
                </p>
              </div>
            </div>
            <Switch
              id="modo-oscuro"
              checked={theme === "dark"}
              onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
            />
          </div>
        </section>

        {/* Seguridad */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold">Seguridad</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Fingerprint className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <Label htmlFor="biometria" className="font-medium">
                  Acceso biométrico
                </Label>
                <p className="text-xs text-muted-foreground">
                  {!bioDisponible
                    ? "No disponible en este dispositivo"
                    : !hayCreds && !bioActiva
                      ? "Marcá «recordarme» al iniciar sesión para poder activarlo"
                      : "Ingresá con huella o Face ID"}
                </p>
              </div>
            </div>
            <Switch
              id="biometria"
              checked={bioActiva}
              disabled={!bioDisponible || bioOcupada || (!hayCreds && !bioActiva)}
              onCheckedChange={(v) => void onBiometriaChange(v)}
            />
          </div>
        </section>

        {/* Aplicación */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold">Aplicación</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Smartphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium">Instalar en el dispositivo</p>
                <p className="text-xs text-muted-foreground">
                  {installed
                    ? "Ya está instalada"
                    : canInstall
                      ? "Accedé sin abrir el navegador"
                      : "No disponible en este navegador"}
                </p>
              </div>
            </div>
            {!installed && canInstall && (
              <Button size="sm" variant="outline" onClick={() => void install()}>
                <Download className="mr-1.5 h-4 w-4" /> Instalar
              </Button>
            )}
          </div>
        </section>

        {/* Sesión */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold">Sesión</h2>
          <Button
            variant="outline"
            className="w-full justify-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setSalirAbierto(true)}
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </section>
      </main>

      <AlertDialog open={salirAbierto} onOpenChange={setSalirAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>Vas a volver a la pantalla de ingreso.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarSalida}>Cerrar sesión</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <IosInstallHint open={iosHint} onClose={dismissIosHint} />
    </div>
  );
}
