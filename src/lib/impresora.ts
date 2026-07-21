/**
 * Impresión directa a térmica 58mm por Web Bluetooth (ESC/POS).
 *
 * Evita el diálogo de impresión del navegador: se conecta a la impresora y le
 * manda los bytes del ticket. Solo funciona en Chrome/Edge (Android y
 * escritorio) sobre HTTPS — iOS no implementa Web Bluetooth.
 *
 * La conexión se guarda en memoria: el primer ticket abre el selector de
 * dispositivos (lo exige el navegador, requiere gesto del usuario), y los
 * siguientes imprimen sin preguntar mientras la página siga abierta.
 */

// UUID estándar de las térmicas genéricas chinas (GOOJPRT, Zjiang, MTP-2…).
const SERVICIO_IMPRESORA = "000018f0-0000-1000-8000-00805f9b34fb";
const CARACTERISTICA_ESCRITURA = "00002af1-0000-1000-8000-00805f9b34fb";

// Estas impresoras tienen un buffer chico: mandar el ticket entero de una vez
// lo desborda y salen caracteres basura o se corta a la mitad.
const TAM_BLOQUE = 180;

const ESC = 0x1b;
const GS_ = 0x1d;

/** El navegador no expone Web Bluetooth (iOS, Firefox, contexto no seguro). */
export function bluetoothDisponible(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

let dispositivo: BluetoothDevice | null = null;
let caracteristica: BluetoothRemoteGATTCharacteristic | null = null;

/** Olvida la impresora emparejada: el próximo ticket vuelve a preguntar. */
export function olvidarImpresora() {
  try {
    dispositivo?.gatt?.disconnect();
  } catch {
    /* ya desconectada */
  }
  dispositivo = null;
  caracteristica = null;
}

async function conectar(): Promise<BluetoothRemoteGATTCharacteristic> {
  // Reusar la conexión viva evita volver a abrir el selector en cada ticket.
  if (caracteristica && dispositivo?.gatt?.connected) return caracteristica;

  if (!dispositivo) {
    // requestDevice necesita un gesto del usuario: solo se llama desde el
    // handler del botón Imprimir.
    dispositivo = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICIO_IMPRESORA] }],
      optionalServices: [SERVICIO_IMPRESORA],
    });
    // Si el usuario apaga la impresora, limpiar para reconectar después.
    dispositivo.addEventListener("gattserverdisconnected", () => {
      caracteristica = null;
    });
  }

  const server = await dispositivo.gatt!.connect();
  const servicio = await server.getPrimaryService(SERVICIO_IMPRESORA);
  caracteristica = await servicio.getCharacteristic(CARACTERISTICA_ESCRITURA);
  return caracteristica;
}

/**
 * Texto a bytes en CP437, la tabla que estas impresoras traen por defecto.
 * Las acentuadas se transliteran: mandarlas en UTF-8 imprime basura.
 */
function aBytes(texto: string): number[] {
  const sinAcentos = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "");
  return Array.from(sinAcentos, (c) => c.charCodeAt(0));
}

interface LineaTicket {
  fecha: string;
  box: string;
  servicio: string;
  comentario: string;
  precio: number;
}

const GS_FMT = new Intl.NumberFormat("es-PY");

/** Arma el ticket en ESC/POS, 32 caracteres de ancho (58mm a fuente A). */
function construirTicket(d: LineaTicket): Uint8Array<ArrayBuffer> {
  const b: number[] = [];

  b.push(ESC, 0x40); // reset
  b.push(ESC, 0x74, 0x00); // CP437

  // Encabezado: centrado, doble alto y ancho.
  b.push(ESC, 0x61, 0x01);
  b.push(GS_, 0x21, 0x11);
  b.push(...aBytes("Clean Car\n"));
  b.push(GS_, 0x21, 0x00);
  b.push(...aBytes("Lavadero\n\n"));

  // Cuerpo: alineado a la izquierda.
  b.push(ESC, 0x61, 0x00);
  b.push(...aBytes(`Fecha: ${d.fecha}\n`));
  b.push(...aBytes(`Box: ${d.box}\n`));
  b.push(...aBytes(`Servicio: ${d.servicio}\n`));
  if (d.comentario) b.push(...aBytes(`Obs: ${d.comentario}\n`));
  b.push(...aBytes("--------------------------------\n"));

  // Precio en negrita y doble alto: es lo que se lee de un vistazo.
  b.push(ESC, 0x45, 0x01);
  b.push(GS_, 0x21, 0x01);
  b.push(...aBytes(`TOTAL: ${GS_FMT.format(d.precio)} Gs\n`));
  b.push(GS_, 0x21, 0x00);
  b.push(ESC, 0x45, 0x00);

  b.push(ESC, 0x61, 0x01);
  b.push(...aBytes("\nGRACIAS POR SU PREFERENCIA\n"));

  // Avance final: sin esto el corte queda pegado al texto.
  b.push(...aBytes("\n\n\n"));

  return new Uint8Array(b);
}

/**
 * Imprime el ticket directo. Debe llamarse desde un handler de clic: el
 * navegador exige gesto del usuario para abrir el selector de dispositivos.
 */
export async function imprimirTicket(datos: LineaTicket): Promise<void> {
  if (!bluetoothDisponible()) {
    throw new Error("Este navegador no soporta impresión Bluetooth. Usá Chrome en Android.");
  }

  const car = await conectar();
  const bytes = construirTicket(datos);

  // writeValueWithoutResponse es bastante más rápido, pero no todas las
  // térmicas lo exponen: se cae a la versión con confirmación.
  const escribir = async (bloque: Uint8Array<ArrayBuffer>) => {
    if (car.properties.writeWithoutResponse) await car.writeValueWithoutResponse(bloque);
    else await car.writeValue(bloque);
  };

  for (let i = 0; i < bytes.length; i += TAM_BLOQUE) {
    await escribir(bytes.slice(i, i + TAM_BLOQUE));
  }
}
