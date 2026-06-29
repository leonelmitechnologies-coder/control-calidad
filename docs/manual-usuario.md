# Manual de Usuario — Sistema de Control de Calidad
## MI Technologies | Versión 1.0 | Junio 2026

---

## Tabla de Contenidos

1. [Introducción y Propósito del Sistema](#1-introducción-y-propósito-del-sistema)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Navegación General](#3-navegación-general)
4. [Módulos del Sistema](#4-módulos-del-sistema)
   - 4.1 [Dashboard](#41-dashboard)
   - 4.2 [No Conformidades](#42-no-conformidades)
   - 4.3 [Recepciones](#43-recepciones)
   - 4.4 [Rechazos Externos](#44-rechazos-externos)
   - 4.5 [Rechazos Internos](#45-rechazos-internos)
   - 4.6 [Acciones Correctivas (CAPA)](#46-acciones-correctivas-capa)
   - 4.7 [AQL](#47-aql)
   - 4.8 [Liberación Shipping](#48-liberación-shipping)
   - 4.9 [Organigrama QC](#49-organigrama-qc)
   - 4.10 [Calendario](#410-calendario)
   - 4.11 [Usuarios](#411-usuarios)
5. [Preguntas Frecuentes](#5-preguntas-frecuentes)
6. [Glosario](#6-glosario)

---

## 1. Introducción y Propósito del Sistema

El **Sistema de Control de Calidad de MI Technologies** es una herramienta web interna diseñada para registrar, dar seguimiento y analizar todos los eventos de calidad que ocurren en las operaciones de la planta logística y de warehouse.

### ¿Para qué sirve?

El sistema centraliza la información de calidad en un solo lugar, eliminando el uso de hojas de cálculo dispersas y papeles que se pueden perder. Permite a los equipos de inspección, supervisión y administración de calidad:

- Registrar y resolver **No Conformidades** de forma trazable.
- Documentar **Rechazos** (tanto externos como internos) con evidencia fotográfica.
- Abrir y dar seguimiento a **Acciones Correctivas (CAPA)** con metodologías estructuradas como 5 Por Qués o Ishikawa.
- Registrar **inspecciones AQL** y **liberaciones de envíos**.
- Gestionar **recepciones de carga** y su estado en el almacén.
- Administrar **vacaciones y permisos** del equipo de calidad.
- Consultar **indicadores clave (KPIs)** en tiempo real desde el Dashboard.

### Relación con ISO 9001:2015

El sistema está construido para apoyar el cumplimiento de los requisitos de la norma ISO 9001:2015, en particular los relacionados con el control de no conformidades (cláusula 10.2), acciones correctivas (cláusula 10.2), control de salidas no conformes (cláusula 8.7) y seguimiento de objetivos de calidad (cláusula 9.1).

### Audiencia de este manual

Este manual está dirigido a **inspectores, supervisores y administradores** del área de Control de Calidad. No se requieren conocimientos técnicos de computación. Sí es útil conocer los procesos de calidad en operaciones de warehouse y logística.

---

## 2. Acceso al Sistema

### 2.1 Cómo ingresar

1. Abra su navegador web (se recomienda Google Chrome o Microsoft Edge).
2. En la barra de dirección escriba: `http://localhost:3001`
3. Verá la pantalla de inicio de sesión.
4. Ingrese su **usuario** y **contraseña**.
5. Haga clic en **Iniciar Sesión**.

> **Nota:** La sesión tiene una duración de **8 horas**. Pasado ese tiempo, el sistema le pedirá que inicie sesión nuevamente.

### 2.2 Usuario administrador inicial

La primera vez que se instala el sistema, existe una cuenta predeterminada:

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `admin123` |

**Es obligatorio cambiar la contraseña en el primer uso.** Consulte la sección [4.11 Usuarios](#411-usuarios) para saber cómo hacerlo.

### 2.3 Cómo cerrar sesión

Haga clic en su nombre de usuario en la parte superior del menú lateral izquierdo (sidebar) y seleccione **Cerrar Sesión**. También puede cerrar la pestaña del navegador; al volver a abrir el sistema, se le pedirá ingresar nuevamente si la sesión ya expiró.

### 2.4 Si olvidó su contraseña

Contacte al **Administrador del sistema** para que restablezca su contraseña desde el módulo de Usuarios.

---

## 3. Navegación General

### 3.1 Estructura de la pantalla

Cuando inicia sesión, la pantalla se divide en dos áreas principales:

```
+------------------+----------------------------------+
|                  |                                  |
|  MENÚ LATERAL    |      ÁREA DE CONTENIDO           |
|  (Sidebar)       |                                  |
|                  |  Aquí se muestra el módulo       |
|  - Dashboard     |  que seleccionó en el menú       |
|  - No Conform.   |                                  |
|  - Recepciones   |                                  |
|  - ...           |                                  |
|                  |                                  |
+------------------+----------------------------------+
```

### 3.2 El menú lateral (Sidebar)

El menú lateral izquierdo contiene los accesos a todos los módulos del sistema. Haga clic en cualquier opción para navegar directamente a ese módulo. No es necesario usar los botones de "Atrás" y "Adelante" del navegador, aunque también funcionan.

### 3.3 Notificaciones del sistema

El sistema muestra mensajes de confirmación o error mediante una **barra de notificación** que aparece en la parte superior de la pantalla:

- **Verde:** La operación se completó con éxito (ej. "Registro guardado correctamente").
- **Rojo:** Ocurrió un error o faltaron datos obligatorios (ej. "El campo Folio es requerido").

Estas notificaciones desaparecen solas después de unos segundos. El sistema **no usa ventanas emergentes (pop-ups)** del navegador.

### 3.4 Roles de usuario

Existen dos roles en el sistema:

| Rol | Permisos |
|---|---|
| **Usuario** | Puede registrar, editar y consultar en todos los módulos excepto Usuarios |
| **Administrador** | Todo lo anterior, más la gestión completa del módulo Usuarios (crear, editar, activar, desactivar, eliminar cuentas) |

---

## 4. Módulos del Sistema

---

### 4.1 Dashboard

**Ruta:** `/` (página de inicio)

El Dashboard es la pantalla principal que verá al iniciar sesión. Muestra un resumen visual del estado actual de la operación de calidad.

#### ¿Qué muestra?

El Dashboard presenta **indicadores clave de desempeño (KPIs)** y gráficos que se actualizan automáticamente con la información registrada en los demás módulos.

#### Toggle Mes / YTD

En la parte superior del Dashboard encontrará un selector con dos opciones:

- **Mes:** Muestra los datos del mes actual.
- **YTD** (Year-to-Date): Muestra los datos acumulados del año en curso.

Haga clic en la opción que desee para actualizar todos los gráficos y contadores.

#### Indicadores principales

| Indicador | Descripción |
|---|---|
| No Conformidades abiertas | Cuántas NCs están pendientes de cerrar |
| Rechazos Externos | Número de órdenes rechazadas en el período |
| Rechazos Internos | Defectos detectados internamente |
| COPQ (MXN) | Costo total de no calidad en pesos mexicanos |
| CAPAs abiertas | Acciones correctivas pendientes |
| Recepciones | Cargas procesadas en el período |

#### Gráficos

Los gráficos muestran tendencias a lo largo del tiempo, distribución de defectos por tipo, y comparativos entre períodos. Puede pasar el cursor sobre las barras o puntos de los gráficos para ver el valor exacto de cada dato.

---

### 4.2 No Conformidades

**Ruta:** `/nc`

Este módulo registra las **No Conformidades (NC)** detectadas en los procesos de la planta. Una No Conformidad es cualquier incumplimiento con un requisito establecido (especificación del cliente, procedimiento interno, requisito normativo).

#### Ciclo de vida de una NC

```
Abierta → En proceso → Cerrada
```

- **Abierta:** La NC fue registrada pero aún no se ha tomado acción.
- **En proceso:** Se está trabajando en su resolución.
- **Cerrada:** La NC fue resuelta y verificada.

#### Cómo registrar una No Conformidad

1. En el módulo No Conformidades, haga clic en el botón **Nueva NC** (o equivalente).
2. Complete los campos del formulario:

| Campo | Descripción |
|---|---|
| Folio | Número único de la NC (puede ser automático o manual) |
| Fecha | Fecha en que se detectó |
| Descripción | Descripción clara del problema encontrado |
| Severidad | Alta, Media o Baja (ver criterios abajo) |
| Área | Área o proceso donde se detectó la NC |
| Responsable | Persona encargada de resolver la NC |

3. Haga clic en **Guardar**.

#### Niveles de severidad

| Severidad | Criterio |
|---|---|
| **Alta** | Impacta directamente al cliente o detiene la operación |
| **Media** | Afecta la calidad pero no detiene el proceso |
| **Baja** | Desviación menor, no impacta al cliente |

#### Cómo actualizar el estatus

1. Localice la NC en la lista.
2. Haga clic sobre ella para abrirla.
3. Cambie el campo **Estatus** al valor correspondiente.
4. Guarde los cambios.

#### Cómo consultar NCs existentes

La lista principal muestra todas las NCs registradas. Puede filtrar por estatus, fecha o área según los controles disponibles en la parte superior de la lista.

---

### 4.3 Recepciones

**Ruta:** `/recepciones`

Este módulo registra y da seguimiento a las **cargas recibidas** en el almacén, tanto de importación como de exportación.

#### Tipos de carga

- **Import:** Mercancía que ingresa al almacén.
- **Export:** Mercancía que sale del almacén hacia el cliente o destino final.

#### Ciclo de vida de una recepción

```
Confirmado → En descarga → Descargado / Rechazado
```

| Estatus | Significado |
|---|---|
| **Confirmado** | La carga llegó y está confirmada para proceso |
| **En descarga** | Se está descargando activamente |
| **Descargado** | La descarga finalizó correctamente |
| **Rechazado** | La carga fue rechazada por no cumplir especificaciones |

#### Cómo registrar una recepción

1. Haga clic en **Nueva Recepción**.
2. Complete los datos de la carga: número de referencia, tipo (Import/Export), fecha, proveedor o cliente, descripción de la carga.
3. Establezca el estatus inicial (**Confirmado**).
4. Guarde el registro.

#### Visualización por fecha

Las recepciones se muestran **agrupadas por fecha**, lo que facilita ver todas las cargas de un día determinado en un solo bloque.

#### Actualizar el estatus

Abra el registro correspondiente, cambie el estatus conforme avanza el proceso y guarde. Esto genera un historial de cambios de la carga.

---

### 4.4 Rechazos Externos

**Ruta:** `/rechazos-ext`

Este módulo registra los **rechazos que provienen del exterior**, es decir, devoluciones de clientes o mercancía que no cumple con los requisitos al momento de ser recibida o enviada.

#### ¿Para qué sirve?

- Documentar el problema con evidencia fotográfica.
- Asignar acciones correctivas a los departamentos responsables.
- Generar el **NCR (Non-Conformance Report)** en formato PDF para enviar al cliente o proveedor.

#### Cómo registrar un Rechazo Externo

1. Haga clic en **Nuevo Rechazo Externo**.
2. Complete el formulario:

| Campo | Descripción |
|---|---|
| Número de orden | Identificador de la orden de retorno |
| Cliente / Proveedor | Quién genera el rechazo |
| Fecha | Fecha del rechazo |
| Descripción del problema | Detalle del defecto o inconformidad encontrada |
| Fotos | Imágenes de evidencia del problema (puede adjuntar varias) |
| Departamento responsable | Área a quien se asigna la acción correctiva |
| Acción correctiva | Descripción de qué se hará para resolver el problema |

3. Guarde el registro.

#### Generar el PDF del NCR

Una vez registrado el rechazo y completados todos los campos:

1. Abra el registro del Rechazo Externo.
2. Haga clic en el botón **Generar PDF** o **Descargar NCR**.
3. El sistema generará un documento PDF con toda la información del rechazo, listo para compartir con el cliente o proveedor.

> **Nota:** Para que el PDF sea completo y profesional, asegúrese de llenar todos los campos antes de generarlo, incluyendo las fotos de evidencia.

---

### 4.5 Rechazos Internos

**Ruta:** `/rechazos-int`

Este módulo registra los **defectos detectados internamente**, es decir, problemas encontrados durante los procesos internos de la planta antes de que lleguen al cliente.

#### Característica especial: Cálculo automático de COPQ

Al seleccionar el **tipo de defecto**, el sistema calcula automáticamente el **Costo de No Calidad (COPQ)** en pesos mexicanos (MXN). Este cálculo es automático; no es necesario ingresar el costo manualmente.

#### Campos del formulario

| Campo | Descripción |
|---|---|
| SKU | Código del producto (tiene autocomplete: empiece a escribir y el sistema sugerirá opciones) |
| Marca | Marca del producto (se llena automáticamente al seleccionar el SKU) |
| Modelo | Modelo del producto |
| Pulgada | Medida del producto |
| Descripción | Descripción del producto |
| Tipo de defecto | Categoría del defecto encontrado |
| Cantidad | Número de piezas afectadas |
| Costo de No Calidad (MXN) | Se calcula automáticamente según el tipo de defecto |
| Fotos | Evidencia fotográfica del defecto |
| Firma digital | Firma del inspector o responsable |

#### Autocomplete de SKU

El campo SKU cuenta con un buscador inteligente:

1. Empiece a escribir el código SKU o el nombre del producto.
2. El sistema mostrará una lista de sugerencias.
3. Seleccione el producto correcto y los demás campos relacionados (Marca, Modelo, Pulgada, Descripción) se llenarán automáticamente.

#### Firma digital

El formulario incluye un espacio para capturar la **firma digital** del inspector. Use el mouse o la pantalla táctil para firmar directamente en el recuadro designado.

#### Adjuntar fotos

Haga clic en el botón de cámara o de adjuntar imagen para subir una o varias fotografías del defecto. Las imágenes quedan guardadas junto con el registro.

---

### 4.6 Acciones Correctivas (CAPA)

**Ruta:** `/capas`

El módulo CAPA (Corrective and Preventive Action) gestiona las **acciones correctivas y preventivas** que se toman para resolver la causa raíz de los problemas de calidad.

#### ¿Cuándo se abre una CAPA?

Una CAPA se abre cuando:
- Una No Conformidad es recurrente o de alta severidad.
- Un Rechazo Externo requiere análisis de causa raíz formal.
- Se detecta una tendencia negativa en los indicadores de calidad.

#### Ciclo de vida de una CAPA

```
Abierta → En proceso → Cerrada
```

#### Metodologías de análisis disponibles

El sistema soporta dos metodologías para el análisis de causa raíz:

| Metodología | Descripción |
|---|---|
| **5 Por Qués** | Se pregunta "¿Por qué?" cinco veces para llegar a la causa raíz del problema |
| **Ishikawa** | Diagrama de causa-efecto que organiza las causas en categorías (Máquina, Método, Material, Mano de Obra, etc.) |

#### Cómo registrar una CAPA

1. Haga clic en **Nueva CAPA**.
2. Complete los datos generales:

| Campo | Descripción |
|---|---|
| Folio | Número de la CAPA |
| Fecha de apertura | Fecha en que se abre la acción |
| Origen | NC o Rechazo Externo que origina la CAPA |
| Descripción del problema | Resumen del problema a resolver |
| Metodología | Seleccione 5 Por Qués o Ishikawa |

3. Complete el análisis de causa raíz según la metodología elegida.
4. Registre las **acciones de seguimiento**: qué se hará, quién es responsable y para qué fecha.
5. Guarde el registro.

#### Ligar a una NC o Rechazo Externo

Al crear una CAPA, puede vincularla a una No Conformidad o a un Rechazo Externo existente. Esto permite la trazabilidad completa del problema y su solución.

#### Cerrar una CAPA

Una CAPA se cierra cuando todas las acciones de seguimiento fueron completadas y se verificó que el problema no volvió a ocurrir. Cambie el estatus a **Cerrada** y guarde.

---

### 4.7 AQL

**Ruta:** `/aql`

El módulo AQL (Acceptable Quality Level) registra las **inspecciones de muestreo** realizadas a los productos, siguiendo el estándar AQL para determinar si un lote es aceptable o rechazable.

#### Cómo registrar una inspección AQL

1. Haga clic en **Nueva Inspección AQL**.
2. Complete los datos de la inspección:

| Campo | Descripción |
|---|---|
| SKU | Código del producto (con autocomplete igual que en Rechazos Internos) |
| Marca / Modelo | Se llenan automáticamente al seleccionar el SKU |
| Fecha | Fecha de la inspección |
| Tamaño del lote | Cantidad total de piezas en el lote inspeccionado |
| Muestra | Número de piezas inspeccionadas |
| Defectos encontrados | Cantidad de piezas con defecto en la muestra |
| Resultado | Aceptado o Rechazado según los criterios AQL |
| Inspector | Nombre del inspector que realizó la inspección |
| Observaciones | Notas adicionales relevantes |

3. Guarde el registro.

#### Autocomplete de SKU

Funciona igual que en Rechazos Internos: escriba las primeras letras del SKU y seleccione de la lista de sugerencias.

---

### 4.8 Liberación Shipping

**Ruta:** `/liberacion-shipping`

Este módulo registra las **órdenes de envío que han sido liberadas** por el equipo de calidad para su despacho al cliente.

#### ¿Para qué sirve?

Proporciona un registro formal de que el equipo de Control de Calidad revisó y aprobó el envío antes de que salga de las instalaciones. Es un punto de control clave para evitar que mercancía no conforme llegue al cliente.

#### Cómo registrar una liberación

1. Haga clic en **Nueva Liberación**.
2. Complete el formulario:

| Campo | Descripción |
|---|---|
| Número de orden | Identificador de la orden de envío |
| Fecha | Fecha de la liberación |
| Cliente | Destinatario del envío |
| SKU / Producto | Producto o productos que se envían |
| Cantidad | Número de piezas liberadas |
| Inspector | Quien liberó el envío |
| Observaciones | Cualquier nota relevante sobre el envío |

3. Guarde el registro.

---

### 4.9 Organigrama QC

**Ruta:** `/organigrama-qc`

Este módulo es el **directorio del equipo de Control de Calidad**. Permite visualizar quién forma parte del equipo, su puesto, turno y datos de contacto.

#### Información por integrante

Cada miembro del equipo tiene un perfil con:

| Campo | Descripción |
|---|---|
| Nombre completo | Nombre del integrante |
| Puesto | Cargo dentro del área de QC |
| Turno | Turno en que labora (matutino, vespertino, nocturno) |
| Foto | Fotografía del integrante |
| Contacto de emergencia | Nombre y teléfono del contacto en caso de emergencia |

#### Cómo agregar un integrante

1. Haga clic en **Agregar Integrante**.
2. Complete los datos del perfil.
3. Adjunte una fotografía (opcional pero recomendado).
4. Guarde el registro.

#### Cómo editar un perfil

Haga clic sobre el nombre o la tarjeta del integrante, modifique los datos que desee y guarde.

---

### 4.10 Calendario

**Ruta:** `/calendario`

El módulo Calendario gestiona las **solicitudes de vacaciones, permisos e incapacidades** del personal del área de QC, así como los **días festivos oficiales** y el **saldo vacacional** de cada integrante.

#### Tipos de solicitud

| Tipo | Descripción |
|---|---|
| **Vacaciones** | Días de descanso correspondientes por ley |
| **Permiso** | Día libre por causa personal o familiar |
| **Incapacidad** | Ausencia por motivos médicos |

#### Cómo registrar una solicitud

1. Haga clic en **Nueva Solicitud** o directamente sobre un día en el calendario.
2. Seleccione el integrante del equipo.
3. Elija el tipo de solicitud (Vacaciones, Permiso, Incapacidad).
4. Seleccione la fecha de inicio y la fecha de fin.
5. Agregue una nota si es necesario.
6. Guarde la solicitud.

#### Saldo vacacional

El sistema lleva un control del **saldo de días de vacaciones disponibles** por integrante y por año. Al registrar una solicitud de vacaciones, el saldo se descuenta automáticamente.

Para consultar el saldo de un integrante:
1. Seleccione el nombre del integrante en el calendario.
2. El sistema mostrará los días disponibles para el año en curso.

#### Festivos oficiales

El calendario incluye los **días festivos oficiales de México** ya marcados. Estos días no se descuentan del saldo vacacional.

---

### 4.11 Usuarios

**Ruta:** `/usuarios`

> **Acceso exclusivo para Administradores.** Los usuarios con rol "Usuario" no pueden acceder a este módulo.

Este módulo permite al Administrador gestionar las cuentas de acceso al sistema.

#### Cómo crear un usuario nuevo

1. Haga clic en **Nuevo Usuario**.
2. Complete el formulario:

| Campo | Descripción |
|---|---|
| Nombre completo | Nombre real del usuario |
| Usuario | Nombre de usuario para iniciar sesión (sin espacios) |
| Contraseña | Contraseña inicial (el usuario deberá cambiarla) |
| Rol | Administrador o Usuario |

3. Haga clic en **Guardar**.
4. Comparta las credenciales con el nuevo usuario de forma segura.

#### Cómo editar un usuario

1. Localice el usuario en la lista.
2. Haga clic en el botón de edición (lápiz o equivalente).
3. Modifique los datos necesarios (nombre, rol, contraseña).
4. Guarde los cambios.

#### Activar o desactivar un usuario

Si un usuario ya no debe tener acceso al sistema (por ejemplo, si dejó la empresa), puede **desactivar** su cuenta sin eliminarla:

1. Localice el usuario.
2. Use el interruptor o botón de **Activar / Desactivar**.
3. Un usuario desactivado no puede iniciar sesión, pero su historial de registros se conserva.

#### Eliminar un usuario

Use esta opción con precaución. Solo elimine un usuario cuando sea completamente necesario. El sistema pedirá confirmación antes de realizar la eliminación.

#### Cambiar la contraseña del administrador

Se recomienda hacer esto en el primer uso del sistema:

1. Vaya al módulo Usuarios.
2. Localice el usuario `admin`.
3. Haga clic en editar.
4. Ingrese la nueva contraseña en el campo correspondiente.
5. Guarde los cambios.

---

## 5. Preguntas Frecuentes

**P1: Olvidé mi contraseña, ¿qué hago?**

No existe una opción de "recuperar contraseña" por correo. Contacte al **Administrador del sistema** para que restablezca su contraseña desde el módulo de Usuarios. El Administrador le asignará una contraseña temporal y usted podrá cambiarla posteriormente.

---

**P2: Registré algo con error, ¿puedo corregirlo?**

Sí. En la mayoría de los módulos puede abrir un registro existente y editarlo. Busque el botón de edición (generalmente un ícono de lápiz o el texto "Editar") junto al registro que desea corregir. Haga los cambios necesarios y guarde.

---

**P3: El sistema me muestra una barra roja con un mensaje de error, ¿qué significa?**

La barra roja indica que la operación no se pudo completar. El mensaje dentro de la barra describe la causa, por ejemplo: "El campo Folio es requerido" o "No se pudo guardar el registro". Lea el mensaje, corrija el problema indicado y vuelva a intentarlo.

---

**P4: ¿Por qué el costo COPQ se llena solo en Rechazos Internos?**

El sistema tiene configurado un **mapa de costos** que asocia cada tipo de defecto con un costo estándar en pesos mexicanos. Al seleccionar el tipo de defecto en el formulario, el sistema aplica automáticamente el costo correspondiente. Este valor puede variar si el Administrador actualiza los parámetros del sistema. Si el costo automático no corresponde a su situación, consulte con su supervisor.

---

**P5: ¿Puedo consultar registros de meses anteriores?**

Sí. En cada módulo hay controles de filtro por fecha. Use los campos de fecha de inicio y fecha de fin para delimitar el período que desea consultar y haga clic en buscar o filtrar. El Dashboard también tiene el toggle **Mes / YTD** para cambiar el período de los indicadores.

---

**P6: ¿Qué diferencia hay entre un Rechazo Externo y un Rechazo Interno?**

- **Rechazo Externo:** El problema fue reportado o devuelto por un **cliente o proveedor externo** (return order). Requiere generar un NCR formal.
- **Rechazo Interno:** El defecto fue detectado **dentro de la planta**, durante los procesos internos, antes de llegar al cliente. Se calcula el COPQ automáticamente.

---

**P7: ¿Cómo sé si mi sesión sigue activa?**

Si puede navegar entre módulos y ver información, la sesión está activa. Si al intentar navegar el sistema lo lleva de vuelta a la pantalla de inicio de sesión, significa que su sesión de 8 horas expiró. Ingrese sus credenciales nuevamente; sus datos guardados no se pierden.

---

**P8: ¿Puedo usar el sistema desde mi celular o tableta?**

El sistema está diseñado principalmente para computadoras de escritorio o laptops conectadas a la red interna de MI Technologies. Aunque puede funcionar en dispositivos móviles con navegador web, la experiencia es más cómoda en pantallas grandes. Para el uso de la firma digital en Rechazos Internos, una tableta puede ser más práctica.

---

## 6. Glosario

| Término | Definición |
|---|---|
| **NC / No Conformidad** | Incumplimiento de un requisito. Puede ser un requisito del cliente, un procedimiento interno o un requisito de la norma ISO 9001. |
| **NCR** | *Non-Conformance Report* (Reporte de No Conformidad). Documento formal que describe un problema de calidad, su evidencia y las acciones tomadas. Se genera en formato PDF desde el módulo de Rechazos Externos. |
| **CAPA** | *Corrective and Preventive Action* (Acción Correctiva y Preventiva). Plan estructurado para identificar la causa raíz de un problema y eliminarla para que no se repita. |
| **COPQ** | *Cost of Poor Quality* (Costo de No Calidad). Representa el dinero que se pierde por no hacer las cosas bien a la primera: retrabajos, rechazos, devoluciones, tiempo perdido. En este sistema se expresa en pesos mexicanos (MXN). |
| **AQL** | *Acceptable Quality Level* (Nivel de Calidad Aceptable). Estándar estadístico de muestreo que define cuántos defectos puede tener una muestra antes de rechazar el lote completo. |
| **SKU** | *Stock Keeping Unit* (Unidad de Mantenimiento de Inventario). Código único que identifica un producto específico en el catálogo. Cada combinación de marca, modelo y medida tiene su propio SKU. |
| **KPI** | *Key Performance Indicator* (Indicador Clave de Desempeño). Métrica que mide el rendimiento de un proceso. En el Dashboard, los KPIs muestran el estado de la calidad en números y gráficos. |
| **YTD** | *Year-to-Date* (Acumulado del año). Se refiere a la suma de los datos desde el 1° de enero hasta la fecha actual. |
| **5 Por Qués** | Técnica de análisis de causa raíz que consiste en preguntar "¿Por qué?" repetidamente (típicamente cinco veces) hasta llegar a la causa fundamental del problema. |
| **Ishikawa** | También llamado "diagrama de espina de pescado" o "diagrama de causa-efecto". Herramienta visual para identificar y categorizar las causas de un problema. Las categorías típicas son: Máquina, Método, Material, Mano de Obra, Medio Ambiente y Medición. |
| **Return Order** | Orden de devolución. Se genera cuando un cliente regresa mercancía por no cumplir con las especificaciones acordadas. Se registra en el módulo de Rechazos Externos. |
| **Import / Export** | En el contexto de Recepciones: **Import** es la mercancía que ingresa al almacén; **Export** es la mercancía que sale del almacén hacia el cliente o destino final. |
| **Turno** | Jornada laboral asignada a un integrante del equipo: matutino, vespertino o nocturno. |
| **SPA** | *Single Page Application*. Tipo de aplicación web que carga en una sola página y actualiza el contenido dinámicamente sin recargar el navegador. El sistema de Control de Calidad usa esta tecnología para una navegación más fluida. |

---

*Manual de Usuario — Sistema de Control de Calidad MI Technologies*
*Versión 1.0 | Junio 2026*
*Para soporte técnico, contacte al administrador del sistema o al área de TI de MI Technologies.*
