import { request } from "./api";

/**
 * Cliente de BOX_LAV, SERVICIOS_LAV y SERVICIOS_LAVADERO.
 *
 * Contrato del backend (ver backend/boxes.sql y backend/servicios.sql):
 * las listas llegan como { success, data: [...] } y el detalle como
 * { success, data: {...} }, con los nombres de columna en minúscula.
 */

interface Envelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

/** Desenvuelve `data`; si falta, devuelve una lista vacía. */
function lista<T>(r: Envelope<T[]>): T[] {
  return r.data ?? [];
}

/* ---------------------------------------------------------------- BOX_LAV */

export interface Box {
  id_box: number;
  descripcion: string;
}

export async function listarBoxes(): Promise<Box[]> {
  return lista(await request<Envelope<Box[]>>("/boxes"));
}

export async function crearBox(descripcion: string) {
  return request<Envelope<never>>("/boxes", {
    method: "POST",
    body: JSON.stringify({ descripcion }),
  });
}

export async function actualizarBox(idBox: number, descripcion: string) {
  return request<Envelope<never>>(`/boxes/${idBox}`, {
    method: "PUT",
    body: JSON.stringify({ descripcion }),
  });
}

export async function borrarBox(idBox: number) {
  return request<Envelope<never>>(`/boxes/${idBox}`, { method: "DELETE" });
}

/* ---------------------------------------------------------- SERVICIOS_LAV */

export interface Servicio {
  id_servicio: number;
  descripcion: string;
  /** 'A' activo / 'I' inactivo. */
  estado: string;
  /** Precio de lista: el formulario lo autocompleta al elegir el servicio. */
  precio: number;
  porc_comision: number;
}

/** Campos editables del catálogo. Todos son NOT NULL en la tabla. */
export interface DatosServicio {
  descripcion: string;
  estado: string;
  precio: number;
  porc_comision: number;
}

/** Solo los activos: alimenta el selector del alta de lavados. */
export async function listarServicios(): Promise<Servicio[]> {
  return lista(await request<Envelope<Servicio[]>>("/servicios"));
}

/** Catálogo completo, incluidos los inactivos (pantalla de Servicios). */
export async function listarCatalogo(): Promise<Servicio[]> {
  return lista(await request<Envelope<Servicio[]>>("/catalogo-servicios"));
}

export async function crearServicio(datos: DatosServicio) {
  return request<Envelope<never>>("/catalogo-servicios", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarServicio(id: number, datos: DatosServicio) {
  return request<Envelope<never>>(`/catalogo-servicios/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export async function borrarServicio(id: number) {
  return request<Envelope<never>>(`/catalogo-servicios/${id}`, { method: "DELETE" });
}

/* ----------------------------------------------------- SERVICIOS_LAVADERO */

export interface ServicioLavadero {
  id_servicio_lavadero: number;
  id_box: number;
  box: string;
  fecha: string;
  id_servicio: number;
  servicio: string;
  comentario: string;
  precio: number;
}

/** Campos que acepta el alta/edición. Todos son NOT NULL en la tabla. */
export interface DatosServicioLavadero {
  id_box: number;
  fecha: string;
  id_servicio: number;
  comentario: string;
  precio: number;
}

/** `fecha` en formato YYYY-MM-DD filtra ese día; omitida trae todo. */
export async function listarServiciosLavadero(fecha?: string): Promise<ServicioLavadero[]> {
  const qs = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return lista(await request<Envelope<ServicioLavadero[]>>(`/servicios-lavadero${qs}`));
}

export async function crearServicioLavadero(datos: DatosServicioLavadero) {
  return request<Envelope<never>>("/servicios-lavadero", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function actualizarServicioLavadero(id: number, datos: DatosServicioLavadero) {
  return request<Envelope<never>>(`/servicios-lavadero/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export async function borrarServicioLavadero(id: number) {
  return request<Envelope<never>>(`/servicios-lavadero/${id}`, { method: "DELETE" });
}
