const BUBBLES = [
  { left: "8%", size: 14, duration: 11, delay: 0, opacity: 0.5 },
  { left: "22%", size: 8, duration: 14, delay: 3, opacity: 0.4 },
  { left: "38%", size: 18, duration: 12, delay: 6, opacity: 0.45 },
  { left: "55%", size: 10, duration: 15, delay: 1.5, opacity: 0.35 },
  { left: "70%", size: 22, duration: 13, delay: 4.5, opacity: 0.4 },
  { left: "84%", size: 12, duration: 10, delay: 7.5, opacity: 0.5 },
  { left: "93%", size: 7, duration: 16, delay: 2, opacity: 0.35 },
];

/** Fondo decorativo con aurora, cuadrícula y burbujas. Colocar dentro de un contenedor `relative`. */
export function AquaBackground({ subtle = false }: { subtle?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${subtle ? "opacity-60" : ""}`}
    >
      {/* Cuadrícula superior */}
      <div className="bg-grid-fade absolute inset-0" />
      {/* Blobs aurora */}
      <div
        className="aurora-blob -top-24 left-1/2 h-96 w-96 -translate-x-1/2 bg-primary/25"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="aurora-blob -left-32 top-1/3 h-80 w-80 bg-sky-400/20 dark:bg-sky-500/15"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="aurora-blob -right-32 bottom-0 h-96 w-96 bg-cyan-300/25 dark:bg-cyan-400/10"
        style={{ animationDelay: "-12s" }}
      />
      {/* Burbujas ascendentes */}
      {!subtle &&
        BUBBLES.map((b, i) => (
          <span
            key={i}
            className="bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              ["--bubble-opacity" as string]: b.opacity,
            }}
          />
        ))}
    </div>
  );
}
