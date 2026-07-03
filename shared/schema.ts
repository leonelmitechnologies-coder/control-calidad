import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  smallint,
  date,
  time,
  boolean,
  decimal,
  foreignKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── USUARIOS ────────────────────────────────────────────────────────
export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  usuario: varchar("usuario", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: varchar("rol", { length: 20 }).notNull().default("Usuario"),
  area: varchar("area", { length: 50 }).default(""),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── NO CONFORMIDADES ────────────────────────────────────────────────
export const noConformidades = pgTable("no_conformidades", {
  id: serial("id").primaryKey(),
  hora: time("hora").notNull(),
  area: varchar("area", { length: 50 }).notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  descripcion: text("descripcion").notNull(),
  severidad: varchar("severidad", { length: 10 }).notNull(),
  responsable: varchar("responsable", { length: 100 }).default("—"),
  accion: text("accion").default("—"),
  registradoPor: varchar("registrado_por", { length: 100 }),
  estatus: varchar("estatus", { length: 20 }).notNull().default("Abierta"),
  fecha: date("fecha").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECEPCIONES ─────────────────────────────────────────────────────
export const recepciones = pgTable("recepciones", {
  id: serial("id").primaryKey(),
  hora: time("hora").notNull(),
  company: varchar("company", { length: 100 }).notNull(),
  origen: varchar("origen", { length: 100 }).notNull(),
  cargo: varchar("cargo", { length: 100 }).notNull(),
  unitQty: integer("unit_qty").notNull().default(0),
  palletQty: integer("pallet_qty").notNull().default(0),
  tipo: varchar("tipo", { length: 20 }).notNull().default("Import"),
  estatus: varchar("estatus", { length: 30 }).notNull().default("Confirmado"),
  registradoPor: varchar("registrado_por", { length: 100 }),
  fecha: date("fecha").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECHAZOS EXTERNOS ───────────────────────────────────────────────
export const rechazosExternos = pgTable("rechazos_externos", {
  id: serial("id").primaryKey(),
  returnOrder: varchar("return_order", { length: 100 }).notNull(),
  licensePlate: varchar("license_plate", { length: 50 }).notNull(),
  classification: varchar("classification", { length: 100 }).notNull().default(""),
  inches: varchar("inches", { length: 20 }).notNull().default(""),
  salesChannel: varchar("sales_channel", { length: 100 }).notNull().default(""),
  sku: varchar("sku", { length: 100 }).notNull().default(""),
  brand: varchar("brand", { length: 100 }).notNull().default(""),
  plantEntry: timestamp("plant_entry").notNull(),
  plantExit: timestamp("plant_exit"),
  totalTimeMinutes: integer("total_time_minutes"),
  outboundOrder: varchar("outbound_order", { length: 100 }).notNull().default(""),
  processedBy: varchar("processed_by", { length: 200 }).notNull().default(""),
  registrationDate: date("registration_date"),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  registradoPor: varchar("registrado_por", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECHAZOS EXTERNOS: PROBLEM DESCRIPTIONS ──────────────────────────
export const reProblemDescriptions = pgTable("re_problem_descriptions", {
  id: serial("id").primaryKey(),
  rechazoId: integer("rechazo_id").notNull(),
  orden: smallint("orden").notNull().default(1),
  descripcion: text("descripcion").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECHAZOS EXTERNOS: IMAGES ───────────────────────────────────────
export const reImages = pgTable("re_images", {
  id: serial("id").primaryKey(),
  rechazoId: integer("rechazo_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }),
  dataB64: text("data_b64"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECHAZOS EXTERNOS: CORRECTIVE ACTIONS ───────────────────────────
export const reCorrectiveActions = pgTable("re_corrective_actions", {
  id: serial("id").primaryKey(),
  rechazoId: integer("rechazo_id").notNull(),
  departamento: varchar("departamento", { length: 50 }).notNull(),
  orden: smallint("orden").notNull().default(1),
  accion: text("accion").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECHAZOS INTERNOS ───────────────────────────────────────────────
export const rechazosInternos = pgTable("rechazos_internos", {
  id: serial("id").primaryKey(),
  fechaRegistro: date("fecha_registro").notNull(),
  licensePlate: varchar("license_plate", { length: 50 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().default(""),
  defecto: varchar("defecto", { length: 100 }).notNull(),
  actividadRealizar: text("actividad_realizar").notNull().default(""),
  costoNoCalidad: decimal("costo_no_calidad", { precision: 10, scale: 2 }).notNull().default("0"),
  origenHallazgo: varchar("origen_hallazgo", { length: 50 }).notNull().default(""),
  inspector: varchar("inspector", { length: 100 }).notNull().default(""),
  firmaFilename: varchar("firma_filename", { length: 255 }).notNull().default(""),
  firmaUrl: varchar("firma_url", { length: 500 }),
  firmaDataB64: text("firma_data_b64"),
  marca: varchar("marca", { length: 100 }).notNull().default(""),
  modelo: varchar("modelo", { length: 100 }).notNull().default(""),
  pulgada: varchar("pulgada", { length: 20 }).notNull().default(""),
  descripcion: text("descripcion").notNull().default(""),
  registradoPor: varchar("registrado_por", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── RECHAZOS INTERNOS: IMAGES ───────────────────────────────────────
export const riImages = pgTable(
  "ri_images",
  {
    id: serial("id").primaryKey(),
    rechazoId: integer("rechazo_id").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    url: varchar("url", { length: 500 }),
    dataB64: text("data_b64"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    fkRechazosInternos: foreignKey({
      columns: [table.rechazoId],
      foreignColumns: [rechazosInternos.id],
      name: "ri_images_rechazo_id_fk",
    }).onDelete("cascade"),
  })
);

// ── CAPAS (CAPA) ────────────────────────────────────────────────────
export const capas = pgTable("capas", {
  id: serial("id").primaryKey(),
  origenTipo: varchar("origen_tipo", { length: 5 }).notNull(),
  origenId: integer("origen_id").notNull(),
  titulo: text("titulo").notNull().default(""),
  descripcionProblema: text("descripcion_problema").notNull().default(""),
  metodoAnalisis: varchar("metodo_analisis", { length: 10 }).notNull().default("5porques"),
  responsable: varchar("responsable", { length: 100 }).notNull().default(""),
  fechaApertura: date("fecha_apertura").notNull(),
  fechaCompromiso: date("fecha_compromiso"),
  fechaCierre: date("fecha_cierre"),
  estatus: varchar("estatus", { length: 20 }).notNull().default("Abierta"),
  verificadoPor: varchar("verificado_por", { length: 100 }).notNull().default(""),
  observaciones: text("observaciones").notNull().default(""),
  registradoPor: varchar("registrado_por", { length: 100 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── CAPAS: 5 PORQUES ────────────────────────────────────────────────
export const capa5Porques = pgTable("capa_5porques", {
  id: serial("id").primaryKey(),
  capaId: integer("capa_id").notNull(),
  orden: smallint("orden").notNull(),
  respuesta: text("respuesta").notNull().default(""),
});

// ── CAPAS: ISHIKAWA ─────────────────────────────────────────────────
export const capaIshikawa = pgTable("capa_ishikawa", {
  id: serial("id").primaryKey(),
  capaId: integer("capa_id").notNull(),
  categoria: varchar("categoria", { length: 50 }).notNull(),
  causa: text("causa").notNull().default(""),
});

// ── CAPAS: ACCIONES ─────────────────────────────────────────────────
export const capaAcciones = pgTable("capa_acciones", {
  id: serial("id").primaryKey(),
  capaId: integer("capa_id").notNull(),
  accion: text("accion").notNull().default(""),
  responsable: varchar("responsable", { length: 100 }).notNull().default(""),
  fechaCompromiso: date("fecha_compromiso"),
  estatus: varchar("estatus", { length: 20 }).notNull().default("Pendiente"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── AQL REGISTROS ───────────────────────────────────────────────────
export const aqlRegistros = pgTable("aql_registros", {
  id: serial("id").primaryKey(),
  fechaRegistro: date("fecha_registro").notNull(),
  licensePlate: varchar("license_plate", { length: 50 }).notNull(),
  clasificacion: varchar("clasificacion", { length: 10 }).notNull().default(""),
  sku: varchar("sku", { length: 100 }).notNull().default(""),
  marca: varchar("marca", { length: 100 }).notNull().default(""),
  modelo: varchar("modelo", { length: 100 }).notNull().default(""),
  pulgada: varchar("pulgada", { length: 20 }).notNull().default(""),
  descripcion: text("descripcion").notNull().default(""),
  accesoriosPresentes: varchar("accesorios_presentes", { length: 20 }).notNull().default(""),
  estadoAccesorios: varchar("estado_accesorios", { length: 20 }).notNull().default(""),
  accesoriosDefectos: text("accesorios_defectos").notNull().default(""),
  estadoBolsa: varchar("estado_bolsa", { length: 20 }).notNull().default(""),
  bolsaDefectos: text("bolsa_defectos").notNull().default(""),
  estadoAudio: varchar("estado_audio", { length: 20 }).notNull().default(""),
  audioDefectos: text("audio_defectos").notNull().default(""),
  estadoVideo: varchar("estado_video", { length: 20 }).notNull().default(""),
  videoDefectos: text("video_defectos").notNull().default(""),
  estadoFisicoPantalla: varchar("estado_fisico_pantalla", { length: 20 }).notNull().default(""),
  fisicoPantallaDefectos: text("fisico_pantalla_defectos").notNull().default(""),
  estadoLimpieza: varchar("estado_limpieza", { length: 20 }).notNull().default(""),
  limpiezaDefectos: text("limpieza_defectos").notNull().default(""),
  estadoAql: varchar("estado_aql", { length: 20 }).notNull().default(""),
  fotoLpnFilename: varchar("foto_lpn_filename", { length: 255 }).notNull().default(""),
  fotoLpnUrl: varchar("foto_lpn_url", { length: 500 }),
  fotoLpnDataB64: text("foto_lpn_data_b64"),
  fotoPantallaFilename: varchar("foto_pantalla_filename", { length: 255 }).notNull().default(""),
  fotoPantallaUrl: varchar("foto_pantalla_url", { length: 500 }),
  fotoPantallaDataB64: text("foto_pantalla_data_b64"),
  inspector: varchar("inspector", { length: 100 }).notNull().default(""),
  registradoPor: varchar("registrado_por", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── CATÁLOGO SKU ────────────────────────────────────────────────────
export const catalogoSku = pgTable("catalogo_sku", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  marca: text("marca").notNull().default(""),
  modelo: text("modelo").notNull().default(""),
  descripcion: text("descripcion").notNull().default(""),
  pulgada: text("pulgada").notNull().default(""),
});

// ── LIBERACIÓN SHIPPING ─────────────────────────────────────────────
export const liberacionShipping = pgTable("liberacion_shipping", {
  id: serial("id").primaryKey(),
  fecha: date("fecha").notNull(),
  numeroOrden: varchar("numero_orden", { length: 100 }).notNull().default(""),
  horaInicio: time("hora_inicio").notNull().default("00:00"),
  horaFin: time("hora_fin").notNull().default("00:00"),
  destino: varchar("destino", { length: 50 }).notNull().default(""),
  tipoEnvio: varchar("tipo_envio", { length: 20 }).notNull().default(""),
  tipoOrden: varchar("tipo_orden", { length: 50 }).notNull().default(""),
  paqueteria: varchar("paqueteria", { length: 50 }).notNull().default(""),
  numeroContenedor: varchar("numero_contenedor", { length: 100 }).notNull().default(""),
  numeroSello: varchar("numero_sello", { length: 100 }).notNull().default(""),
  cantidadPallets: integer("cantidad_pallets").notNull().default(0),
  cantidadManifiesto: integer("cantidad_manifiesto").notNull().default(0),
  cantidadFisica: integer("cantidad_fisica").notNull().default(0),
  estado: varchar("estado", { length: 30 }).notNull().default(""),
  cantidadDiferencia: integer("cantidad_diferencia").notNull().default(0),
  resultadoInspeccion: varchar("resultado_inspeccion", { length: 20 }).notNull().default(""),
  fotoContenedorVacio: varchar("foto_contenedor_vacio", { length: 255 }).notNull().default(""),
  fotoContenedorCargado: varchar("foto_contenedor_cargado", { length: 255 }).notNull().default(""),
  fotoCajaSellada: varchar("foto_caja_sellada", { length: 255 }).notNull().default(""),
  fotoPlacas: varchar("foto_placas", { length: 255 }).notNull().default(""),
  fotoManifiesto: varchar("foto_manifiesto", { length: 255 }).notNull().default(""),
  inspector: varchar("inspector", { length: 100 }).notNull().default(""),
  estatusCarga: varchar("estatus_carga", { length: 30 }).notNull().default(""),
  comentarios: text("comentarios").notNull().default(""),
  registradoPor: varchar("registrado_por", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ORGANIGRAMA QC ──────────────────────────────────────────────────
export const organigramaQc = pgTable("organigrama_qc", {
  id: serial("id").primaryKey(),
  nombreCompleto: varchar("nombre_completo", { length: 200 }).notNull(),
  noEmpleado: varchar("no_empleado", { length: 50 }).notNull().default(""),
  puesto: varchar("puesto", { length: 50 }).notNull(),
  area: varchar("area", { length: 100 }).notNull().default(""),
  turno: varchar("turno", { length: 50 }).notNull().default(""),
  estatus: varchar("estatus", { length: 20 }).notNull().default("activo"),
  fechaIngreso: date("fecha_ingreso"),
  telefono: varchar("telefono", { length: 20 }).notNull().default(""),
  correo: varchar("correo", { length: 100 }).notNull().default(""),
  sexo: varchar("sexo", { length: 20 }).notNull().default(""),
  fechaNacimiento: date("fecha_nacimiento"),
  contactoEmergencia: varchar("contacto_emergencia", { length: 200 }).notNull().default(""),
  telEmergencia: varchar("tel_emergencia", { length: 20 }).notNull().default(""),
  fotoFilename: varchar("foto_filename", { length: 255 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── CALENDARIO: SOLICITUDES ─────────────────────────────────────────
export const calendarioSolicitudes = pgTable(
  "calendario_solicitudes",
  {
    id: serial("id").primaryKey(),
    colaboradorId: integer("colaborador_id").notNull(),
    tipo: varchar("tipo", { length: 50 }).notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin").notNull(),
    diasHabiles: integer("dias_habiles").notNull().default(1),
    motivo: text("motivo").notNull().default(""),
    estatus: varchar("estatus", { length: 20 }).notNull().default("pendiente"),
    aprobadoPor: varchar("aprobado_por", { length: 100 }).notNull().default(""),
    observaciones: text("observaciones").notNull().default(""),
    registradoPor: varchar("registrado_por", { length: 100 }).notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    fkColaborador: foreignKey({
      columns: [table.colaboradorId],
      foreignColumns: [organigramaQc.id],
      name: "calendario_solicitudes_colaborador_id_fk",
    }).onDelete("cascade"),
  })
);

// ── CALENDARIO: FESTIVOS ────────────────────────────────────────────
export const calendarioFestivos = pgTable("calendario_festivos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  fecha: date("fecha").notNull(),
  recurrente: boolean("recurrente").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── CALENDARIO: SALDO ───────────────────────────────────────────────
export const calendarioSaldo = pgTable(
  "calendario_saldo",
  {
    id: serial("id").primaryKey(),
    colaboradorId: integer("colaborador_id").notNull(),
    anio: integer("anio").notNull(),
    diasAsignados: integer("dias_asignados").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    fkColaborador: foreignKey({
      columns: [table.colaboradorId],
      foreignColumns: [organigramaQc.id],
      name: "calendario_saldo_colaborador_id_fk",
    }).onDelete("cascade"),
    uniqueColaboradorAnio: uniqueIndex("calendario_saldo_colaborador_id_anio_unique").on(
      table.colaboradorId,
      table.anio
    ),
  })
);
