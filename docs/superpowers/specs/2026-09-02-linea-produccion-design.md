# Módulo: Línea de Producción

**Fecha:** 2026-09-02  
**Ruta:** `/linea-produccion`  
**Estado:** Aprobado — listo para implementar

---

## Objetivo

Dashboard de supervisión de producción que consume datos de BinManager (SmartControl) en tiempo real. Permite al supervisor ver liberaciones y defectos por línea, detectar patrones, y hacer drill-down hasta el registro individual con cruce de datos por LPN.

---

## Arquitectura

### Frontend
- **Archivo:** `client/src/pages/LineaProduccion.tsx`
- **Stack:** React + TypeScript, inline styles, TanStack Query, sin librerías de UI externas
- **Colores:** `primary: #0d2b4e`, `white: #ffffff`, `bg: #f4f6f9`, `border: #e2e2e2`
- **Gráficas:** Chart.js + react-chartjs-2 (ya en el proyecto)

### Backend
- **Archivo:** `server/routes.ts` — nuevos endpoints bajo `// ── LÍNEA DE PRODUCCIÓN ──`
- **Cache en memoria:** objeto global `produccionCache` con TTL 60s, poblado por `fetchProduccionData()`
- **Llamada a BinManager:** HTTP fetch a la API de BinManager con auth token de env var `BINMANAGER_TOKEN`
- **Fallback:** Si BinManager no responde, devuelve el último cache disponible con flag `stale: true`

### Rutas de API nuevas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/produccion/defectos` | Defectos filtrados por query params |
| GET | `/api/produccion/liberaciones` | Liberaciones filtradas por query params |
| GET | `/api/produccion/dashboard` | KPIs + datos agregados para el tab Dashboard |

**Query params comunes:** `startDate`, `endDate`, `linea`, `inspector`, `severidad`

---

## Componente: LineaProduccion.tsx

### Estructura de tabs

```
LineaProduccion
├── FilterBar        — fecha inicio/fin, línea, inspector, severidad + countdown auto-refresh
├── TabNav           — Dashboard | Liberaciones | Defectos
├── TabDashboard
│   ├── KPIStrip     — 4 cards: Liberaciones / Defectos / Tasa % / Críticos
│   ├── Charts row 1 — Pareto defectos | Tendencia diaria (lib vs def) | Mapa de calor (línea × día)
│   ├── Charts row 2 — Donut por área | Barras apiladas severidad por línea
│   ├── InspectorTable — lib / def / tasa por inspector con color de tasa
│   └── DefectosList — defectos del período más recientes primero, badge CRÍTICO/MAYOR/MENOR
├── TabLiberaciones
│   ├── SearchInput + contador de registros
│   ├── LiberacionesTable — LPN, Línea, Tamaño, Marca/Modelo, Inspector, col Defectos (⚠ N)
│   └── LPNDetailPanel — slide-in: info TV + accesorios validados (DetailsJSON) + defectos cruzados
└── TabDefectos
    ├── SearchInput + filtros área + severidad + contador
    ├── DefectosTable — LPN, Defecto, Área, Severidad (badge), Línea, Inspector
    └── DefectoDetailPanel — slide-in: info defecto + liberación cruzada por LPN
```

### Auto-refresh
- `refetchInterval: 60000` en TanStack Query
- Countdown visible en FilterBar: "↻ en 47 seg"
- Al completar countdown, refetch automático y reset

### Panel de detalle (compartido)
- Se abre al hacer clic en cualquier fila
- Ancho fijo: 300px, deslizable desde la derecha
- Cerrar con ✕ o clic fuera del panel
- **Liberación:** marca, modelo, tamaño, línea, inspector, fecha, accesorios (from DetailsJSON), defectos del mismo LPN
- **Defecto:** código, nombre, área, severidad, línea, inspector generador, inspector registrador, comentario, liberación del mismo LPN

---

## Datos y tipos

### Defecto
```typescript
interface Defecto {
  DefectsRecordsID: number;
  LicencePlateNumber: string;
  InspectionID: number;
  ProductionLineName: string;
  DefectGeneratedBy: string;
  DefectRecordedBy: string;
  DefectEnteredDate: string;
  CODE: string;
  DefectName: string;
  Description: string;
  Area: "EMPAQUE" | "ACCESORIOS" | "ETIQUETADOR" | "LIMPIEZA DE CAJAS";
  Severity: "MENOR" | "MAYOR" | "CRITICO";
  Commentary: string;
}
```

### Liberación
```typescript
interface Liberacion {
  ProductionQualityReleaseID: number;
  TV_LPN: string;
  TV_SKU: string;
  TV_Brand: string;
  TV_Model: string;
  TV_Size: number;
  TV_Description: string;
  ProductionLineName: string;
  ReleaseEnteredBy: string;
  ReleaseEnteredDate: string;
  ReleaseComment: string;
  DetailsJSON: string; // JSON string → array de accesorios
}
```

---

## Gráficas (Chart.js)

| Gráfica | Tipo | Datos | Dónde |
|---|---|---|---|
| Pareto de defectos | Bar horizontal + línea acumulada | DefectName → count | Dashboard |
| Tendencia diaria | Line (doble eje) | fecha → lib count + def count | Dashboard |
| Mapa de calor | Grid HTML con opacidad | línea × día → def count | Dashboard |
| Defectos por área | Doughnut | Area → count | Dashboard |
| Severidad por línea | Bar apilada horizontal | línea → [MENOR, MAYOR, CRÍTICO] | Dashboard |

**Paleta monocromática:** `#0d2b4e` (crítico/dominante), `#555` (mayor/medio), `#aaa`/`#ddd` (menor/secundario). Sin colores rojo/verde/amarillo excepto la tasa de defecto en la tabla de inspectores (verde=0%, amarillo=<2%, rojo=>2%).

---

## Navegación

- Agregar en `client/src/App.tsx`: `<Route path="/linea-produccion" component={LineaProduccion} />`
- Agregar en `client/src/components/Layout.tsx`: link en sidebar con ícono 🏭 o similar

---

## Filtros por defecto al cargar
- `startDate`: hoy a las 00:00
- `endDate`: hoy a las 23:59
- Línea: todas
- Inspector: todos
- Severidad: todas

---

## Paginación
- Liberaciones y Defectos: 50 registros por página
- Controles: anterior / siguiente + indicador "mostrando X–Y de Z"
