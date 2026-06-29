# Matriz de Roles y Permisos — Sistema de Control de Calidad
**MI Technologies | Control de Calidad**
*Versión 1.0 — 2026-06-29*

---

## 1. Descripción de los Roles

El sistema cuenta con dos roles definidos. Toda cuenta de usuario debe tener asignado exactamente uno de ellos.

### Administrador
Tiene acceso completo al sistema, incluyendo la gestión de cuentas de usuario. Es el único rol con capacidad de crear, modificar, activar/desactivar y eliminar usuarios. Se recomienda asignar este rol únicamente al personal de TI o al responsable del sistema de calidad.

### Usuario
Tiene acceso operativo a todos los módulos de registro y consulta del sistema (NC, Recepciones, Rechazos, CAPA, AQL, Shipping, Organigrama, Calendario y Dashboard). No puede gestionar cuentas de usuario. Es el rol adecuado para inspectores, coordinadores de calidad y personal de almacén.

---

## 2. Matriz de Permisos por Módulo

> **Leyenda:** ✅ Permitido | ❌ Denegado

### 2.1 Dashboard

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Ver KPIs generales | ✅ | ✅ |
| Ver gráficas y tendencias | ✅ | ✅ |

---

### 2.2 No Conformidades

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar registros | ✅ | ✅ |
| Registrar nueva NC | ✅ | ✅ |
| Editar NC existente | ✅ | ✅ |
| Cambiar estatus de NC | ✅ | ✅ |
| Eliminar NC | ✅ | ✅ |

---

### 2.3 Recepciones

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar recepciones | ✅ | ✅ |
| Registrar nueva recepción | ✅ | ✅ |
| Editar recepción | ✅ | ✅ |
| Cambiar estatus | ✅ | ✅ |
| Eliminar recepción | ✅ | ✅ |

---

### 2.4 Rechazos Externos

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar rechazos | ✅ | ✅ |
| Registrar nuevo rechazo | ✅ | ✅ |
| Editar rechazo | ✅ | ✅ |
| Subir fotos de evidencia | ✅ | ✅ |
| Generar PDF de NCR | ✅ | ✅ |
| Eliminar rechazo | ✅ | ✅ |

---

### 2.5 Rechazos Internos

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar rechazos internos | ✅ | ✅ |
| Registrar nuevo rechazo interno | ✅ | ✅ |
| Editar rechazo interno | ✅ | ✅ |
| Subir fotos de evidencia | ✅ | ✅ |
| Registrar firma digital | ✅ | ✅ |
| Eliminar rechazo interno | ✅ | ✅ |

---

### 2.6 Acciones Correctivas (CAPA)

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar CAPAs | ✅ | ✅ |
| Registrar nueva CAPA | ✅ | ✅ |
| Editar CAPA | ✅ | ✅ |
| Cambiar estatus de CAPA | ✅ | ✅ |
| Eliminar CAPA | ✅ | ✅ |

---

### 2.7 AQL (Acceptance Quality Limit)

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar inspecciones AQL | ✅ | ✅ |
| Registrar nueva inspección | ✅ | ✅ |
| Eliminar registro AQL | ✅ | ✅ |

---

### 2.8 Liberación Shipping

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar liberaciones | ✅ | ✅ |
| Registrar nueva liberación | ✅ | ✅ |

---

### 2.9 Organigrama QC

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Consultar integrantes | ✅ | ✅ |
| Registrar nuevo integrante | ✅ | ✅ |
| Editar datos de integrante | ✅ | ✅ |
| Subir foto de integrante | ✅ | ✅ |
| Activar / desactivar integrante | ✅ | ✅ |
| Eliminar integrante | ✅ | ✅ |

---

### 2.10 Calendario

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Ver calendario y solicitudes | ✅ | ✅ |
| Crear solicitud (permiso/vacación) | ✅ | ✅ |
| Aprobar o rechazar solicitudes | ✅ | ✅ |
| Registrar días festivos | ✅ | ✅ |
| Gestionar saldo vacacional | ✅ | ✅ |

---

### 2.11 Usuarios *(módulo exclusivo del Administrador)*

| Acción | Usuario | Administrador |
|---|:---:|:---:|
| Ver lista de usuarios | ❌ | ✅ |
| Crear nuevo usuario | ❌ | ✅ |
| Editar datos de otro usuario | ❌ | ✅ |
| Cambiar contraseña de otro usuario | ❌ | ✅ |
| Activar / desactivar cuenta | ❌ | ✅ |
| Eliminar cuenta | ❌ | ✅ |
| Editar su propio perfil (nombre, contraseña) | ✅ | ✅ |

---

## 3. Restricciones Especiales

### 3.1 Automodificación de cuenta

Un usuario **no puede desactivar ni eliminar su propia cuenta**, independientemente de su rol. Esta restricción aplica también al Administrador: si el sistema detecta que el ID de la sesión activa coincide con el usuario objetivo de la operación de desactivación o eliminación, la acción es bloqueada en el servidor.

El propósito de esta restricción es evitar que el sistema quede sin ningún administrador activo por error.

### 3.2 Edición del propio perfil

Cualquier usuario con sesión activa (rol Usuario o Administrador) puede actualizar su **propio nombre y contraseña**. Esta operación no requiere privilegios de Administrador. Los cambios se aplican a través del mismo módulo de Usuarios, pero el servidor valida que el usuario solo modifique sus propios datos cuando el rol es Usuario.

### 3.3 Captura automática del autor (`registrado_por`)

En todos los módulos operativos (NC, Rechazos, CAPA, AQL, Shipping, Recepciones, Organigrama, Calendario), el campo `registrado_por` se captura automáticamente del nombre del usuario con sesión activa al momento de crear el registro. Este campo **no es editable por el usuario** desde el formulario; garantiza trazabilidad de autoría sin intervención manual.

### 3.4 Sesión y expiración

Las sesiones tienen una duración máxima de **8 horas**. Tras ese período, el usuario deberá iniciar sesión nuevamente. Las contraseñas se almacenan con hash bcrypt (cost factor = 10); nunca se guardan en texto plano ni se transmiten por la API.

---

## 4. Asignación de Roles — Proceso en el Módulo Usuarios

Solo un usuario con rol **Administrador** puede gestionar cuentas. El proceso para crear o modificar un usuario es el siguiente:

1. Navegar al módulo **Usuarios** en el menú lateral (disponible únicamente para Administradores).
2. Para **crear un usuario nuevo**:
   - Hacer clic en **Nuevo Usuario**.
   - Completar: nombre completo, nombre de usuario (login), contraseña inicial y rol (`Administrador` o `Usuario`).
   - Guardar. El sistema hashea la contraseña automáticamente antes de almacenarla.
3. Para **cambiar el rol de un usuario existente**:
   - Localizar al usuario en la tabla.
   - Hacer clic en **Editar**.
   - Modificar el campo Rol y guardar.
4. Para **desactivar una cuenta** (sin eliminarla):
   - Usar el toggle de activación en la fila correspondiente.
   - Un usuario desactivado no puede iniciar sesión, pero sus registros históricos se conservan íntegros.
5. Para **eliminar una cuenta**:
   - Hacer clic en **Eliminar** y confirmar la acción en el diálogo de confirmación.
   - Esta acción es **permanente**. Se recomienda preferir la desactivación cuando el historial del usuario debe conservarse para trazabilidad.

> **Importante:** Antes de desactivar o eliminar la única cuenta de Administrador activa, asegurarse de que exista al menos otro Administrador activo en el sistema.

---

## 5. Recomendaciones de Gestión de Accesos (ISO 9001:2015 — Cláusula 7.1.6)

La cláusula 7.1.6 de la norma ISO 9001:2015 establece que la organización debe determinar y gestionar el **conocimiento necesario** para la operación de sus procesos y para lograr la conformidad de productos y servicios. El control de accesos al sistema de calidad es parte de este requisito, ya que protege la integridad de los datos que soportan las decisiones del sistema de gestión.

Se recomiendan las siguientes prácticas:

### 5.1 Principio de mínimo privilegio
Asignar a cada usuario el rol estrictamente necesario para sus funciones. Salvo el responsable del sistema de calidad y el personal de TI, los demás colaboradores deben operar con rol **Usuario**.

### 5.2 Revisión periódica de cuentas
Realizar una revisión trimestral de la lista de usuarios activos. Desactivar de inmediato las cuentas de personal que haya cambiado de puesto o dado de baja. Documentar esta revisión como registro de calidad.

### 5.3 Contraseñas seguras
Instruir a los usuarios para que cambien su contraseña inicial en el primer inicio de sesión. Establecer una política interna de contraseñas (mínimo 8 caracteres, combinación de letras y números). El sistema no impone esto de forma automática; la política debe comunicarse como procedimiento interno.

### 5.4 Trazabilidad de registros
Dado que el campo `registrado_por` se captura automáticamente, cada registro del sistema queda asociado al usuario que lo creó. Esto cumple con el requisito de trazabilidad de la información documentada (cláusula 7.5.3 — Control de la información documentada).

### 5.5 Cuentas compartidas
**No se recomienda** el uso de cuentas compartidas entre varios operadores. Cada persona debe tener su propia cuenta para mantener la trazabilidad individual de las acciones registradas.

### 5.6 Custodio del rol Administrador
Designar formalmente a un responsable del rol Administrador (preferentemente el Coordinador de Calidad o el administrador de TI). Documentar esta designación en el procedimiento de control de accesos del SGC.

---

*Documento generado para uso interno — MI Technologies | Sistema de Control de Calidad*
*Para actualizar este documento, consultar el responsable del sistema de calidad.*
