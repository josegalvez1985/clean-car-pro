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

/**
 * Paginado; sin `fechaDesde`/`fechaHasta` trae solo el mes en curso (evita
 * cargar toda la tabla), salvo `todoElPeriodo: true` (p.ej. "últimos
 * movimientos" del home, que quiere los N más recientes de cualquier mes).
 * `total` en la respuesta indica si hay más páginas.
 */
export async function listarServiciosLavadero(filtros?: {
  fechaDesde?: string;
  fechaHasta?: string;
  idBox?: number;
  pagina?: number;
  tamPagina?: number;
  todoElPeriodo?: boolean;
}): Promise<{ data: ServicioLavadero[]; total: number }> {
  const params = new URLSearchParams();
  if (filtros?.fechaDesde) params.set("fecha_desde", filtros.fechaDesde);
  if (filtros?.fechaHasta) params.set("fecha_hasta", filtros.fechaHasta);
  if (filtros?.idBox) params.set("id_box", String(filtros.idBox));
  if (filtros?.pagina) params.set("pagina", String(filtros.pagina));
  if (filtros?.tamPagina) params.set("tam_pagina", String(filtros.tamPagina));
  if (filtros?.todoElPeriodo) params.set("todo_periodo", "S");
  const qs = params.size ? `?${params.toString()}` : "";
  const r = await request<Envelope<ServicioLavadero[]> & { total?: number }>(
    `/servicios-lavadero${qs}`,
  );
  return { data: r.data ?? [], total: r.total ?? 0 };
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
