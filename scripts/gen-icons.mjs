import sharp from "sharp";
import { join } from "node:path";

const PUB = "c:/Users/Josegal/Desktop/proyectos/clean-car-pro/public";
const SRC = join(PUB, "logo.png");

// Safe zone maskable: el contenido debe caber en el circulo central del 80%.
// 72% deja margen de sobra para el recorte squircle de Android.
const ESCALA = 0.72;
/**
 * El logo es una imagen cuadrada con fondo propio, asi que un color plano
 * detras deja un borde visible. En vez de eso, el fondo es el mismo logo
 * ampliado y desenfocado: el padding se funde y no se nota el recorte.
 */
async function fondoExtendido(size) {
  return sharp(SRC).resize(size, size, { fit: "cover" }).blur(size * 0.04).toBuffer();
}

async function maskable(size, out) {
  const inner = Math.round(size * ESCALA);
  const logo = await sharp(SRC).resize(inner, inner, { fit: "contain" }).toBuffer();
  const pad = Math.round((size - inner) / 2);

  await sharp(await fondoExtendido(size))
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(join(PUB, out));

  console.log(`${out}: ${size}px, logo ${inner}px, padding ${pad}px`);
}

// iOS no aplica mascara: recorta el icono a un squircle fijo y no reserva
// safe zone, asi que un padding grande se ve como un logo chico. Menos margen.
async function appleTouch() {
  const size = 180;
  const inner = Math.round(size * 0.86);
  const logo = await sharp(SRC).resize(inner, inner, { fit: "contain" }).toBuffer();
  const pad = Math.round((size - inner) / 2);

  await sharp(await fondoExtendido(size))
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(join(PUB, "apple-touch-icon.png"));

  console.log(`apple-touch-icon.png: ${size}px, logo ${inner}px, padding ${pad}px`);
}

// "any" se muestra sin recortar: mantiene el logo a sangre, sin padding.
async function any(size, out) {
  await sharp(SRC).resize(size, size, { fit: "contain" }).png().toFile(join(PUB, out));
  console.log(`${out}: ${size}px, sin padding (purpose any)`);
}

await any(192, "icon-192.png");
await any(512, "icon-512.png");
await maskable(192, "icon-192-maskable.png");
await maskable(512, "icon-512-maskable.png");
await appleTouch();
