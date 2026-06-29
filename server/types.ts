/**
 * Type definitions for the server application
 */

// ── Response Types ──────────────────────────────────────────────

export interface ApiResponse<T = any> {
  ok?: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ── No Conformidades ────────────────────────────────────────────

export interface NoConformidadCreateInput {
  hora: string;
  area: string;
  tipo: string;
  descripcion: string;
  severidad: string;
  responsable?: string;
  accion?: string;
  fecha?: string;
}

export interface NoConformidadResponse extends NoConformidadCreateInput {
  id: number;
  estatus: string;
  registrado_por: string | null;
  created_at: string;
  capas_count?: number;
}

// ── Recepciones ────────────────────────────────────────────────

export interface RecepcionCreateInput {
  hora: string;
  company: string;
  origen: string;
  cargo: string;
  unit_qty: number;
  pallet_qty: number;
  tipo?: string;
  fecha?: string;
}

export interface RecepcionResponse extends RecepcionCreateInput {
  id: number;
  estatus: string;
  registrado_por: string | null;
  created_at: string;
}

// ── Rechazos Externos ──────────────────────────────────────────

export interface RechazosExternosCreateInput {
  return_order: string;
  license_plate: string;
  classification?: string;
  inches?: string;
  sales_channel?: string;
  sku?: string;
  brand?: string;
  plant_entry: string; // ISO timestamp
  plant_exit?: string;
  outbound_order?: string;
  processed_by?: string;
  registration_date?: string;
  sale_price?: number;
  problem_descriptions?: Array<{ orden: number; descripcion: string }>;
  corrective_actions?: Array<{ departamento: string; orden: number; accion: string }>;
}

export interface RechazosExternosResponse extends RechazosExternosCreateInput {
  id: number;
  total_time_minutes?: number;
  registrado_por: string | null;
  created_at: string;
  problem_descriptions?: Array<{ id: number; orden: number; descripcion: string }>;
  corrective_actions?: Array<{ id: number; departamento: string; orden: number; accion: string }>;
  images?: Array<{ id: number; filename: string }>;
  cnt_problemas?: number;
  cnt_acciones?: number;
  cnt_capas?: number;
}

// ── Rechazos Internos ──────────────────────────────────────────

export interface RechazosInternosCreateInput {
  fecha_registro: string;
  license_plate: string;
  sku?: string;
  marca?: string;
  modelo?: string;
  pulgada?: string;
  descripcion?: string;
  defecto: string;
  actividad_realizar?: string;
  costo_no_calidad?: number;
  origen_hallazgo?: string;
  inspector?: string;
}

export interface RechazosInternosResponse extends RechazosInternosCreateInput {
  id: number;
  firma_filename?: string;
  registrado_por: string | null;
  created_at: string;
  images?: Array<{ id: number; filename: string }>;
}

// ── Catálogo SKU ───────────────────────────────────────────────

export interface CatalogoSkuResponse {
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
}

// ── AQL ────────────────────────────────────────────────────────

export interface AqlCreateInput {
  fecha_registro: string;
  license_plate: string;
  clasificacion?: string;
  sku?: string;
  marca?: string;
  modelo?: string;
  pulgada?: string;
  descripcion?: string;
  accesorios_presentes?: string;
  estado_accesorios?: string;
  accesorios_defectos?: string;
  estado_bolsa?: string;
  bolsa_defectos?: string;
  estado_audio?: string;
  audio_defectos?: string;
  estado_video?: string;
  video_defectos?: string;
  estado_fisico_pantalla?: string;
  fisico_pantalla_defectos?: string;
  estado_limpieza?: string;
  limpieza_defectos?: string;
  estado_aql?: string;
  inspector?: string;
}

export interface AqlResponse extends AqlCreateInput {
  id: number;
  foto_lpn_filename?: string;
  foto_pantalla_filename?: string;
  registrado_por: string | null;
  created_at: string;
}

// ── CAPAS (Acciones Correctivas) ───────────────────────────────

export interface CapaCreateInput {
  origen_tipo: string; // 'nc' | 're'
  origen_id: number;
  titulo?: string;
  descripcion_problema?: string;
  metodo_analisis: string; // '5porques' | 'ishikawa'
  responsable?: string;
  fecha_apertura: string;
  fecha_compromiso?: string;
  porques?: Array<{ orden: number; respuesta: string }>;
  ishikawa?: Array<{ categoria: string; causa: string }>;
  acciones?: Array<{ accion: string; responsable?: string; fecha_compromiso?: string }>;
}

export interface CapaResponse extends Omit<CapaCreateInput, 'porques' | 'ishikawa' | 'acciones'> {
  id: number;
  fecha_cierre?: string;
  estatus: string;
  verificado_por?: string;
  observaciones?: string;
  registrado_por: string | null;
  created_at: string;
  origen_ref?: string;
  porques?: Array<{ id: number; orden: number; respuesta: string }>;
  ishikawa?: Array<{ id: number; categoria: string; causa: string }>;
  acciones?: Array<{ id: number; accion: string; responsable: string; fecha_compromiso?: string; estatus: string; created_at: string }>;
}

// ── Liberación Shipping ────────────────────────────────────────

export interface LiberacionShippingCreateInput {
  fecha: string;
  numero_orden?: string;
  hora_inicio?: string;
  hora_fin?: string;
  destino?: string;
  tipo_envio?: string;
  tipo_orden?: string;
  paqueteria?: string;
  numero_contenedor?: string;
  numero_sello?: string;
  cantidad_pallets?: number;
  cantidad_manifiesto?: number;
  cantidad_fisica?: number;
  estado?: string;
  cantidad_diferencia?: number;
  resultado_inspeccion?: string;
  inspector?: string;
  estatus_carga?: string;
  comentarios?: string;
}

export interface LiberacionShippingResponse extends LiberacionShippingCreateInput {
  id: number;
  foto_contenedor_vacio?: string;
  foto_contenedor_cargado?: string;
  foto_caja_sellada?: string;
  foto_placas?: string;
  foto_manifiesto?: string;
  registrado_por: string | null;
  created_at: string;
}

// ── Organigrama QC ─────────────────────────────────────────────

export interface OrganigramaQcCreateInput {
  nombre_completo: string;
  no_empleado?: string;
  puesto: string;
  area?: string;
  turno?: string;
  estatus?: string;
  fecha_ingreso?: string;
  telefono?: string;
  correo?: string;
  sexo?: string;
  fecha_nacimiento?: string;
  contacto_emergencia?: string;
  tel_emergencia?: string;
}

export interface OrganigramaQcResponse extends OrganigramaQcCreateInput {
  id: number;
  foto_filename?: string;
  created_at: string;
}

// ── Calendario Solicitudes ────────────────────────────────────

export interface CalendarioSolicitudCreateInput {
  colaborador_id: number;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_habiles?: number;
  motivo?: string;
  estatus?: string;
}

export interface CalendarioSolicitudResponse extends CalendarioSolicitudCreateInput {
  id: number;
  aprobado_por?: string;
  observaciones?: string;
  registrado_por?: string;
  created_at: string;
  nombre_completo?: string;
  area?: string;
  puesto?: string;
}

// ── Calendario Festivos ────────────────────────────────────────

export interface CalendarioFestivoCreateInput {
  nombre: string;
  fecha: string;
  recurrente?: boolean;
}

export interface CalendarioFestivoResponse extends CalendarioFestivoCreateInput {
  id: number;
  created_at: string;
}

// ── Calendario Saldo ───────────────────────────────────────────

export interface CalendarioSaldoCreateInput {
  colaborador_id: number;
  anio: number;
  dias_asignados: number;
}

export interface CalendarioSaldoResponse extends CalendarioSaldoCreateInput {
  id: number;
  created_at: string;
  nombre_completo?: string;
}

// ── Dashboard ──────────────────────────────────────────────────

export interface DashboardMetrics {
  sale_price_total: number;
  copq_interno_total: number;
  total_rejects_cost: number;
  rechazos_total: number;
  nc_abiertas: number;
  colaboradores_activos: number;
  sale_price_por_marca: Array<{ brand: string; total: number }>;
  rechazos_por_clasif: Array<{ classification: string; count: number }>;
  nc_por_severidad: Array<{ severidad: string; count: number }>;
  nc_por_area: Array<{ area: string; count: number }>;
}

// ── Usuarios ───────────────────────────────────────────────────

export interface UsuarioCreateInput {
  nombre: string;
  usuario: string;
  password: string;
  rol?: string;
  area?: string;
}

export interface UsuarioResponse {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
  area: string;
  activo: boolean;
  created_at: string;
}

// ── S3 Upload Response ─────────────────────────────────────────

export interface S3UploadResponse {
  filename: string;
  url: string;
}

export interface FileUploadResponse {
  [key: string]: string; // { filename: url }
}
