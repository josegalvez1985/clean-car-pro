import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Fingerprint, Loader2, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { AquaBackground } from "@/components/aqua-background";
import { InstallButton } from "@/components/install-button";
import {
  biometricAvailable,
  biometricEnabled,
  clearCreds,
  getRememberedUsername,
  registerBiometric,
  saveCreds,
  unlockWithBiometric,
} from "@/lib/biometric";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, login, loading, restaurando } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [canBiometric, setCanBiometric] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!restaurando && user) navigate({ to: "/home", replace: true });
  }, [user, restaurando, navigate]);

  useEffect(() => {
    const remembered = getRememberedUsername();
    if (remembered) {
      setUsername(remembered);
      setRemember(true);
    }
    setCanBiometric(biometricEnabled());
  }, []);

  const doLogin = async (u: string, p: string) => {
    await login(u, p);
    if (remember) {
      saveCreds({ username: u, password: p });
      // Ofrecer registrar biométrico si está disponible y aún no configurado.
      if (biometricAvailable() && !biometricEnabled()) {
        const ok = await registerBiometric(u);
        if (ok) toast.success("Acceso biométrico activado");
      }
    } else {
      clearCreds();
    }
    toast.success("Bienvenido a Clean Car");
    navigate({ to: "/home", replace: true });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await doLogin(username.trim(), password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Usuario o contraseña incorrectos");
    } finally {
      setBusy(false);
    }
  };

  const onBiometric = async () => {
    setBusy(true);
    try {
      const creds = await unlockWithBiometric();
      if (!creds) {
        toast.error("No se pudo verificar la identidad");
        return;
      }
      await login(creds.username, creds.password);
      toast.success("Bienvenido a Clean Car");
      navigate({ to: "/home", replace: true });
    } catch {
      toast.error("El acceso guardado ya no es válido, ingresá de nuevo");
      clearCreds();
      setCanBiometric(false);
    } finally {
      setBusy(false);
    }
  };

  const disabled = loading || busy;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <AquaBackground />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-primary/30 blur-2xl" />
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[2rem] bg-card/80 shadow-xl shadow-primary/25 ring-1 ring-border backdrop-blur">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="Clean Car"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-primary via-sky-500 to-cyan-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:via-sky-400 dark:to-cyan-300">
            Clean Car
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Carga de lavados de autos y camionetas
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl"
        >
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu.usuario"
                required
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={verPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pl-9 pr-9"
              />
              {/* tabIndex -1: el tab va del campo al botón Ingresar, no al ojo. */}
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                tabIndex={-1}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={verPassword}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
              Recordar usuario y contraseña
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={disabled}>
            {disabled ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </Button>

          {canBiometric && (
            <Button
              type="button"
              variant="outline"
              className="w-full bg-card/60"
              onClick={onBiometric}
              disabled={disabled}
            >
              <Fingerprint className="mr-2 h-4 w-4" /> Ingresar con biometría
            </Button>
          )}
        </form>

        <InstallButton variant="outline" className="mt-4 w-full bg-card/60 backdrop-blur" />
      </div>
    </main>
  );
}
