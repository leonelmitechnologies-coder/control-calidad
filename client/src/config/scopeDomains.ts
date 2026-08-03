/**
 * Requestable GAC module scopes — MUST match server/auth.ts's SCOPE_DOMAINS
 * exactly (server validates against the same list). Also matches the keys
 * client/src/pages/Usuarios.tsx's MODULOS_PERMISOS already used (minus ""
 * dashboard and "manual", which stay open to any listed user by default).
 */
export const SCOPE_DOMAINS = [
  "nc",
  "recepciones",
  "rechazos-ext",
  "rechazos-int",
  "capas",
  "aql",
  "liberacion-shipping",
  "organigrama-qc",
  "calendario",
] as const;

export type ScopeDomain = (typeof SCOPE_DOMAINS)[number];

export const SCOPE_LABELS: Record<ScopeDomain, string> = {
  nc: "No Conformidades",
  recepciones: "Recepciones",
  "rechazos-ext": "Rechazos Externos",
  "rechazos-int": "Rechazos Internos",
  capas: "CAPA (Acciones Correctivas)",
  aql: "AQL",
  "liberacion-shipping": "Liberación Shipping",
  "organigrama-qc": "Organigrama QC",
  calendario: "Calendario",
};
