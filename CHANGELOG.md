# Historial de Cambios — Sistema de Control de Calidad

MI Technologies · Planta Logística / Warehouse
Orientado a la certificación ISO 9001:2015

Este archivo documenta todos los cambios relevantes del sistema agrupados por versión,
siguiendo el formato [Keep a Changelog](https://keepachangelog.com/es-ES/) y
[Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-06-30

### Migración al MI Stack

- **Frontend React 18 + TypeScript + Vite:** migración del SPA monolítico vanilla JS a
  React 18 con TypeScript 5 y Vite 5 como bundler.
- **TanStack Query v5:** gestión de estado del servidor con caché y revalidación automática.
- **Drizzle ORM:** acceso tipado a PostgreSQL; migraciones en `drizzle/`.
- **react-i18next trilingüe:** soporte completo en español (es-MX), English (en) y
  简体中文 (zh-CN).
- **PM2 en producción:** pm2-runtime con reinicio automático y límite de 512 MB.

### Seguridad

- **Autenticación exclusiva por Nextcloud OIDC:** eliminado el login con usuario/contraseña
  local. El único proveedor de identidad es `cloud.miglobal.com.mx`.
- **Sesiones httpOnly + secure:** cookies de 8 horas con `httpOnly: true` y `secure: true`
  en producción (connect-pg-simple).

---

## [0.9.0] — 2026-06-26

### Agregado
- **Módulo Liberación Shipping:** nuevo módulo para gestionar la liberación de envíos, con registro de inspecciones y aprobaciones antes del despacho.

---

## [0.8.0] — 2026-06-25

### Agregado
- **Módulo Registro AQL:** nuevo módulo para realizar y registrar inspecciones de muestreo bajo el estándar AQL (Acceptable Quality Level).
- **Campo Pulgada en AQL:** se agregó el campo de pulgada al formulario del módulo AQL para mayor detalle del producto inspeccionado.
- **Campos Marca, Modelo, Pulgada y Descripción en Rechazos Internos:** el formulario de rechazo interno ahora captura estos atributos del producto para trazabilidad completa.
- **Autocompletado de SKU en Rechazos Internos y AQL:** al escribir un SKU, el sistema sugiere coincidencias del catálogo y rellena automáticamente Marca, Modelo, Pulgada y Descripción.

### Corregido
- **Mapeo incorrecto de Pulgada / Descripción en el autocompletado de SKU:** los valores de ambos campos aparecían intercambiados; ahora se muestran correctamente según el catálogo.

### Cambiado
- **Reorganización de la estructura del proyecto:** archivos de log reubicados y estructura de carpetas ordenada para facilitar el mantenimiento.
- **Documentación actualizada:** la documentación refleja los 9 módulos y 17 tablas existentes hasta esta fecha.

---

## [0.1.0] — 2026-06-24

### Agregado
- **Módulo Dashboard / KPIs:** panel principal con indicadores clave de calidad, gráficas interactivas (Chart.js) y resumen de actividad del sistema.
- **KPIs de costos de rechazos en el Dashboard:** tarjeta unificada con el total de costos de no calidad (COPQ) de rechazos internos y externos, consolidando tres indicadores anteriores en uno solo.
- **Módulo Rechazos Internos con COPQ y firma digital:** registro de rechazos dentro de planta con cálculo automático del costo de no calidad según tipo de defecto, y captura de firma digital del responsable.
- **Módulo CAPA — Acciones Correctivas y Preventivas:** gestión del ciclo completo de acciones correctivas vinculadas a No Conformidades y Rechazos Externos, conforme a la cláusula 8.5 de ISO 9001:2015.
- **Módulo Calendario:** gestión de permisos y vacaciones del personal, con vista de calendario y seguimiento de saldo de días disponibles.
- **Pestañas en Calendario:** la vista de calendario y el saldo de vacaciones ahora se presentan en pestañas separadas dentro del mismo módulo.
- **Módulo Rechazos Externos:** registro y seguimiento de rechazos reportados por clientes, con generación de PDF mediante Puppeteer.
- **Módulo Organigrama QC:** directorio visual del equipo de Control de Calidad con foto de colaborador, cargo y tiempo en planta.
- **Foto de colaborador y campo Tiempo en Planta en Organigrama QC:** se agregaron estos campos al perfil de cada integrante del equipo QC.
- **Redirección automática al inicio de sesión:** cuando la sesión expira, el sistema redirige automáticamente al login sin necesidad de intervención del usuario.
- **Modal de pregunta personalizado (`ui.preguntar`):** se reemplazaron todos los `prompt()` nativos del navegador por un modal propio, consistente con el diseño del sistema.
- **Módulos base del sistema:** No Conformidades, Recepciones, Usuarios, y Autenticación con control de sesión.

### Corregido
- **Etiqueta de moneda en COPQ:** el costo de no calidad ahora se muestra correctamente en MXN (pesos mexicanos) en lugar de USD.
- **Desbordamiento de vista previa de imágenes en Rechazos Internos:** las imágenes adjuntas ya no se salen del formulario.
- **`z-index` de modales de confirmación y notificación:** estos modales ahora aparecen correctamente sobre cualquier otro modal abierto.
- **`z-index` del modal de pregunta:** el modal de pregunta ahora se muestra por encima de otros modales abiertos simultáneamente.
- **Desbordamiento de botones en modal de No Conformidades:** los botones de acción ahora se ajustan correctamente sin salirse del contenedor.
- **Scroll en modales:** el desplazamiento se aplica sobre el contenido del modal, no sobre la página completa.
- **Esquema de base de datos sincronizado:** el archivo `docs/schema.sql` actualizado para reflejar el estado real de la base de datos.

### Cambiado
- **README del proyecto:** documentación inicial del sistema agregada al repositorio.

---

*Generado el 2026-06-29. Para reportar incidencias o solicitar mejoras, contactar al equipo de TI de MI Technologies.*
