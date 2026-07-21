import { createPortal } from "react-dom";

const GS = new Intl.NumberFormat("es-PY");

export interface DatosTicket {
  fecha: string;
  box: string;
  servicio: string;
  comentario: string;
  precio: number;
}

/**
 * Ticket de 57mm. Solo se ve al imprimir (ver .ticket-imprimir en
 * styles.css) — en pantalla queda oculto, igual que el `pdfMake` de la
 * página 14 de APEX no se ve hasta hacer clic en Imprimir.
 *
 * Se renderiza en <body> vía portal: el alta vive dentro de un Drawer (vaul),
 * que aplica `transform` a sus ancestros; eso crea un containing block y el
 * ticket salía corrido o escalado al imprimir.
 */
export function TicketLavado({ datos }: { datos: DatosTicket }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="ticket-imprimir">
      <p style={{ textAlign: "center", fontWeight: "bold", fontSize: "14px" }}>
        Lavadero Clean Car
      </p>
      <p style={{ fontSize: "10px", margin: "4px 0" }}>Fecha: {datos.fecha}</p>
      <p style={{ fontSize: "10px", margin: "4px 0" }}>Box: {datos.box}</p>
      <p style={{ fontSize: "10px", margin: "4px 0" }}>Servicio: {datos.servicio}</p>
      <p style={{ fontSize: "10px", margin: "4px 0" }}>Observación: {datos.comentario}</p>
      <p style={{ fontSize: "10px", margin: "4px 0" }}>Precio: {GS.format(datos.precio)}</p>
      <p style={{ textAlign: "center", fontSize: "10px", marginTop: "8px" }}>
        *** GRACIAS POR SU PREFERENCIA ***
      </p>
    </div>,
    document.body,
  );
}
