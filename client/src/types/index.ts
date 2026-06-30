/**
 * Shared TypeScript type definitions
 * Used across components, hooks, and contexts
 */

// ── Toast / Notifications ──

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  duration?: number;
}

// ── Confirm Dialog ──

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

// ── Pagination ──

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// ── SKU catalog ──

export interface SkuRecord {
  id: string;
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
}

// ── COPQ (Cost of Poor Quality) ──

export interface RI_COPQ {
  actividad: string;
  costo: number;
}

// ── No Conformidades ──

export interface NoConformidad {
  id: number;
  fecha: string;          // DATE stored as ISO string "YYYY-MM-DD"
  hora: string;           // TIME "HH:MM"
  area: string;
  tipo: string;
  descripcion: string;
  severidad: 'Crítica' | 'Mayor' | 'Menor';
  responsable: string;
  accion: string;
  estatus: 'Abierta' | 'En Progreso' | 'Cerrada' | 'Rechazada';
  registrado_por: string;
  cnt_capas?: number;
}

export type InsertNoConformidad = Omit<NoConformidad, 'id' | 'estatus' | 'registrado_por' | 'cnt_capas'>;

export interface NcListResponse {
  data: NoConformidad[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Recepciones ──

export interface Recepcion {
  id: number;
  fecha: string;
  hora: string;
  company: string;
  origen: string;
  cargo: string;
  unit_qty: number;
  pallet_qty: number;
  tipo: 'Import' | 'Export';
  estatus: 'Confirmado' | 'En descarga' | 'Descargado' | 'Rechazado';
  registrado_por: string;
  fecha_actualizado: string;
  created_at?: string;
}

export interface RecepcionesResponse {
  data: Recepcion[];
  total: number;
  page: number;
  limit: number;
}

// ── Rechazos Internos ──

export interface RiImage {
  id: string;
  filename: string;
  url: string;
}

export interface RechazosInterno {
  id: number;
  fecha_registro: string;
  license_plate: string;
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  defecto: string;
  actividad_realizar: string;
  costo_no_calidad: number;
  origen_hallazgo: string;
  inspector: string;
  observaciones: string;
  firma_filename: string;
  firma_digital: string;
  estatus: 'Abierto' | 'Cerrado';
  registrado_por: string;
  created_at: string;
  cnt_images?: number;
  images?: RiImage[];
}

export type InsertRechazosInterno = Omit<
  RechazosInterno,
  'id' | 'registrado_por' | 'created_at' | 'cnt_images' | 'images' | 'firma_filename'
>;

export interface RiListResponse {
  data: RechazosInterno[];
  total: number;
  page: number;
  limit: number;
}

// ── Rechazos Externos ──

export interface RechazosExternoProblem {
  descripcion: string;
  accion: string;
}

export interface RechazosExternoImage {
  id: number;
  rechazo_id: number;
  filename: string;
  created_at?: string;
  /** Derived URL — computed client-side */
  url?: string;
}

export interface RechazosExterno {
  id: number;
  return_order: string;
  license_plate: string;
  classification: string;
  inches: string;
  sales_channel: string;
  sku: string;
  brand: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  plant_entry: string;
  plant_exit: string | null;
  total_time_minutes: number | null;
  outbound_order: string;
  processed_by: string;
  registration_date: string | null;
  sale_price: number | null;
  estatus: 'Pendiente' | 'Aceptado' | 'Rechazado';
  registrado_por: string;
  created_at: string;
  // Aggregates from list endpoint
  cnt_problemas?: number;
  cnt_acciones?: number;
  cnt_images?: number;
  // Detail endpoint nested data
  problem_descriptions?: Array<{ id: number; orden: number; descripcion: string }>;
  corrective_actions?: Array<{ id: number; departamento: string; orden: number; accion: string }>;
  images?: RechazosExternoImage[];
}

export type RechazosExternoEstatus = RechazosExterno['estatus'];

export interface ReListResponse {
  data: RechazosExterno[];
  total: number;
  page: number;
  limit: number;
}

// ── Organigrama QC ──

export interface OrganigramaQc {
  id: number;
  nombre_completo: string;
  no_empleado: string;
  sexo: string;
  fecha_nacimiento?: string;
  puesto: string;
  area: string;
  turno: string;
  fecha_ingreso: string;
  estatus: string;          // lowercase: 'activo' | 'inactivo'
  telefono?: string;
  correo?: string;
  contactoEmergencia?: string;
  telEmergencia?: string;
  foto_filename?: string;   // server stores filename, URL derived client-side
  created_at: string;
}

export type InsertOrganigramaQc = Omit<OrganigramaQc, 'id' | 'created_at'>;

// ── Liberación Shipping ──

export interface LiberacionShippingFotos {
  contenedor_vacio:   string;
  contenedor_cargado: string;
  caja_sellada:       string;
  placas:             string;
  manifiesto:         string;
}

export interface LiberacionShipping {
  id: number;
  fecha: string;
  order_id: string;
  destino: string;
  referencia?: string;
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  numero_contenedor: string;
  tipo_contenedor: string;
  peso_total: number;
  volumen_cubico: number;
  bill_of_lading?: string;
  pro_number?: string;
  purchase_order?: string;
  observaciones?: string;
  estatus: 'Programado' | 'En Tránsito' | 'Entregado' | 'Cancelado';
  registrado_por: string;
  created_at: string;
  fotos: LiberacionShippingFotos;
}

export interface LsListResponse {
  data: LiberacionShipping[];
  total: number;
  page: number;
  limit: number;
}

// ── API generic envelope ──

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
