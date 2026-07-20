import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Boxes,
  ClipboardList,
  Download,
  Home as HomeIcon,
  ListOrdered,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { AquaBackground } from "@/components/aqua-background";
import { usePwaInstall } from "@/lib/use-pwa-install";
import { IosInstallHint } from "@/components/ios-install-hint";
import { RegistrarLavado } from "@/components/registrar-lavado";

export const Route = createFileRoute("/home")({
  component: HomePage,
});

const GS = new Intl.NumberFormat("es-PY");

// TODO: reemplazar por datos de la API Oracle (GET /lavados/resumen).
const RESUMEN = {
  facturado: 1_840_000,
  variacion: 12,
  lavados: 24,
  promedioMin: 38,
  boxes: [
    { estado: "ocupado" as const },
    { estado: "ocupado" as const },
    { estado: "porLiberarse" as const },
    { estado: "libre" as const },
    { estado: "libre" as const },
  ],
};

const MOVIMIENTOS = [
  {
    patente: "ABC 123",
    servicio: "Completo",
    detalle: "Box 2 · hace 4 min",
    monto: 85_000,
    estado: "lavando" as const,
  },
  {
    patente: "HJK 908",
    servicio: "Premium + cera",
    detalle: "Box 1 · hace 12 min",
    monto: 150_000,
    estado: "lavando" as const,
  },
  {
    patente: "PQR 441",
    servicio: "Básico",
    detalle: "Box 4 · 11:20",
    monto: 55_000,
    estado: "entregado" as const,
  },
  {
    patente: "MNO 077",
    servicio: "Detailing",
    detalle: "Sin asignar · 11:05",
    monto: 320_000,
    estado: "espera" as const,
  },
];

const PILL: Record<string, { label: string; className: string }> = {
  entregado: { label: "Entregado", className: "bg-success/15 text-success" },
  lavando: { label: "Lavando", className: "bg-warning/20 text-warning" },
  espera: { label: "En espera", className: "bg-muted text-muted-foreground" },
};

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buen día";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga() {
  return new Intl.DateTimeFormat("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function HomePage() {
  const navigate = useNavigate();
  const { user, logout, restaurando } = useAuth();
  const { theme, toggle } = useTheme();
  const { canInstall, install, iosHint, dismissIosHint } = usePwaInstall();
  const [altaAbierta, setAltaAbierta] = useState(false);

  useEffect(() => {
    if (!restaurando && !user) navigate({ to: "/", replace: true });
  }, [user, restaurando, navigate]);

  if (restaurando || !user) return null;

  const handleLogout = () => {
    logout();
    navigate({ to: "/", replace: true });
  };

  const enProceso = RESUMEN.boxes.filter((b) => b.estado !== "libre").length;

  const accesos: Array<{
    icon: typeof UserPlus;
    titulo: string;
    detalle: string;
    color: string;
    fondo: string;
    badge: number | null;
    onClick?: () => void;
  }> = [
    {
      icon: UserPlus,
      titulo: "Servicios a clientes",
      detalle: "Cargar un servicio nuevo",
      color: "text-primary",
      fondo: "bg-primary/12",
      badge: null,
      onClick: () => setAltaAbierta(true),
    },
    {
      icon: ClipboardList,
      titulo: "Consulta",
      detalle: "Servicios del día",
      color: "text-success",
      fondo: "bg-success/15",
      badge: RESUMEN.lavados,
    },
    {
      icon: ListOrdered,
      titulo: "Servicios",
      detalle: "Catálogo y precios",
      color: "text-warning",
      fondo: "bg-warning/20",
      badge: null,
      onClick: () => navigate({ to: "/servicios" }),
    },
    {
      icon: Boxes,
      titulo: "Box",
      detalle: `${enProceso} de ${RESUMEN.boxes.length} ocupados`,
      color: "text-primary",
      fondo: "bg-primary/12",
      badge: enProceso,
      onClick: () => navigate({ to: "/boxes" }),
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AquaBackground subtle />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
            <img src="/logo.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="text-[0.95rem] font-semibold">Clean Car</h1>
            <p className="truncate text-xs text-muted-foreground">{user.username}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Cuenta">
                  <UserIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-xs font-normal text-muted-foreground">Sesión</span>
                  <span className="truncate font-medium">{user.username}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canInstall && (
                  <DropdownMenuItem onClick={install}>
                    <Download className="mr-2 h-4 w-4" /> Instalar app
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* El padding inferior reserva el alto de la barra fija + el safe area
          del iPhone, para que el último movimiento no quede tapado. */}
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            {saludo()}, {user.username}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">
            {fechaLarga()} · {enProceso} vehículos en proceso
          </p>
        </div>

        {/* Estado de la jornada */}
        <section
          aria-label="Resumen de hoy"
          className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/95 via-primary to-sky-700 p-5 text-primary-foreground shadow-xl shadow-primary/25 dark:from-primary/25 dark:via-slate-900 dark:to-slate-950 dark:text-foreground dark:ring-1 dark:ring-border"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl"
          />

          <div className="mb-3.5 flex items-baseline justify-between gap-2">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.13em] opacity-75">
              Jornada de hoy
            </span>
            <span className="text-xs tabular-nums opacity-70">Cierre 18:00</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <div className="col-span-2">
              <div className="flex flex-wrap items-baseline gap-x-2 text-[2.4rem] font-bold leading-none tracking-tight tabular-nums">
                <span>
                  <span className="mr-1 text-base font-semibold opacity-70">Gs.</span>
                  {GS.format(RESUMEN.facturado)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-200 dark:text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {RESUMEN.variacion}%
                </span>
              </div>
              <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] opacity-70">
                Facturado
              </div>
            </div>

            <div>
              <div className="text-2xl font-bold leading-none tracking-tight tabular-nums">
                {RESUMEN.lavados}
              </div>
              <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] opacity-70">
                Lavados
              </div>
            </div>

            <div>
              <div className="text-2xl font-bold leading-none tracking-tight tabular-nums">
                {RESUMEN.promedioMin}
                <span className="ml-0.5 text-sm font-semibold opacity-70">min</span>
              </div>
              <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.1em] opacity-70">
                Promedio
              </div>
            </div>
          </div>

          {/* Ocupación de boxes: una celda por box, el ámbar es el próximo a liberarse. */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] opacity-70">
                Ocupación de boxes
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {enProceso} / {RESUMEN.boxes.length}
              </span>
            </div>
            <div
              className="flex gap-1.5"
              role="img"
              aria-label={`${enProceso} de ${RESUMEN.boxes.length} boxes ocupados`}
            >
              {RESUMEN.boxes.map((b, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    b.estado === "ocupado"
                      ? "bg-emerald-300 dark:bg-success"
                      : b.estado === "porLiberarse"
                        ? "bg-amber-300 dark:bg-warning"
                        : "bg-white/25 dark:bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Accesos */}
        <h3 className="mt-6 mb-2.5 px-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Operación
        </h3>
        <div className="mb-6 grid grid-cols-2 gap-2.5">
          {accesos.map((a) => (
            <button
              key={a.titulo}
              type="button"
              onClick={a.onClick}
              className="relative flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {a.badge != null && (
                <span className="absolute right-3 top-3 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.65rem] font-bold tabular-nums text-primary-foreground">
                  {a.badge}
                </span>
              )}
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${a.fondo} ${a.color}`}>
                <a.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-sm font-semibold leading-tight">{a.titulo}</span>
              <span className="text-xs leading-snug text-muted-foreground">{a.detalle}</span>
            </button>
          ))}
        </div>

        {/* Movimientos */}
        <div className="mb-2.5 flex items-baseline justify-between px-0.5">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Últimos movimientos
          </h3>
          <button type="button" className="text-xs font-semibold text-primary hover:underline">
            Ver todo
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur">
          {MOVIMIENTOS.map((m, i) => (
            <div
              key={m.patente}
              className={`flex items-center gap-3 p-3.5 ${
                i > 0 ? "border-t border-border/60" : ""
              }`}
            >
              <span className="flex-none rounded-lg border border-border bg-muted/60 px-2 py-1 font-mono text-xs font-bold tracking-wider">
                {m.patente}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <b className="truncate text-sm font-semibold">{m.servicio}</b>
                <span className="truncate text-xs text-muted-foreground">{m.detalle}</span>
              </span>
              <span className="flex flex-none flex-col items-end gap-1">
                <span className="text-sm font-bold tabular-nums">{GS.format(m.monto)}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${PILL[m.estado].className}`}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                  {PILL[m.estado].label}
                </span>
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Navegación inferior: PWA de celular, al alcance del pulgar. */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/85 backdrop-blur-xl"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-0.5 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          {[
            { icon: HomeIcon, label: "Inicio", activo: true, onClick: undefined },
            {
              icon: ClipboardList,
              label: "Servicios",
              activo: false,
              onClick: () => navigate({ to: "/servicios" }),
            },
            {
              icon: Boxes,
              label: "Boxes",
              activo: false,
              onClick: () => navigate({ to: "/boxes" }),
            },
            { icon: UserIcon, label: "Cuenta", activo: false, onClick: undefined },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={t.onClick}
              aria-current={t.activo ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 pb-2.5 text-[0.65rem] font-semibold transition ${
                t.activo
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-[18px] w-[18px]" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <Drawer open={altaAbierta} onOpenChange={setAltaAbierta}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>Servicios a clientes</DrawerTitle>
              <DrawerDescription>Registrá un servicio del lavadero.</DrawerDescription>
            </DrawerHeader>
            <RegistrarLavado onDone={() => setAltaAbierta(false)} />
          </div>
        </DrawerContent>
      </Drawer>

      <IosInstallHint open={iosHint} onClose={dismissIosHint} />
    </div>
  );
}
