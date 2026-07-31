/**
 * COPQ Mapping — Cost of Poor Quality
 * Defect → Activity + Cost (MXN) for Rechazos Internos
 *
 * Source of truth: public/index.html RI_DEFECTOS object (lines 2832-2844)
 * DO NOT modify costs here without updating the legacy SPA as well.
 */

export interface CopqEntry {
  actividad: string;
  costo: number;
}

export const RI_DEFECTOS: Record<string, CopqEntry> = {
  Duplicado: { actividad: "Verificacion de LPN correcto y Reproceso en Linea", costo: 105.0 },
  "Pulgada Incorrecta": { actividad: "Inspeccion de TV", costo: 17.5 },
  "Clasificacion Incorrecta": { actividad: "Inspeccion de TV y Reproceso en Linea", costo: 17.5 },
  "Marca Incorrecta": { actividad: "Inspeccion de TV", costo: 17.5 },
  "Pantalla Caida": { actividad: "Reproceso en Linea", costo: 43.75 },
  "Etiqueta Quemada": { actividad: "Reimpresion de Etiqueta", costo: 5.83 },
  "Sin Etiqueta": { actividad: "Reimpresion de Etiqueta", costo: 5.83 },
  "Falta de Tape": { actividad: "Colocacion de Tape", costo: 5.83 },
  "Falta de Limpieza en Caja": { actividad: "Reproceso en Limpieza de Cajas", costo: 14.0 },
  "Tv con Salida": { actividad: "Inspeccion de TV y Reproceso en Linea", costo: 52.5 },
  "Modelo Incorrecto": { actividad: "Inspeccion de TV", costo: 35.0 },
};

/**
 * Look up the COPQ entry for a given defect name.
 * Returns null when the defect is not in the catalogue.
 */
export function getCopqMapping(defecto: string): CopqEntry | null {
  return RI_DEFECTOS[defecto] ?? null;
}

/**
 * All defect names in catalogue order (useful for <select> options).
 */
export const DEFECTO_NAMES = Object.keys(RI_DEFECTOS) as (keyof typeof RI_DEFECTOS)[];
