import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Section {
  id: string;
  titleKey: string;
  icon: string;
  contentKey: string;
}

const SECTIONS: Section[] = [
  {
    id: "intro",
    titleKey: "manual.sections.intro",
    icon: "📋",
    contentKey: "manual.content.intro",
  },
  {
    id: "login",
    titleKey: "manual.sections.login",
    icon: "🔐",
    contentKey: "manual.content.login",
  },
  {
    id: "dashboard",
    titleKey: "manual.sections.dashboard",
    icon: "📊",
    contentKey: "manual.content.dashboard",
  },
  { id: "nc", titleKey: "manual.sections.nc", icon: "⚠️", contentKey: "manual.content.nc" },
  {
    id: "recepciones",
    titleKey: "manual.sections.recepciones",
    icon: "📦",
    contentKey: "manual.content.recepciones",
  },
  { id: "re", titleKey: "manual.sections.re", icon: "↩️", contentKey: "manual.content.re" },
  { id: "ri", titleKey: "manual.sections.ri", icon: "🔍", contentKey: "manual.content.ri" },
  { id: "capa", titleKey: "manual.sections.capa", icon: "✅", contentKey: "manual.content.capa" },
  { id: "aql", titleKey: "manual.sections.aql", icon: "🔬", contentKey: "manual.content.aql" },
  {
    id: "shipping",
    titleKey: "manual.sections.shipping",
    icon: "🚚",
    contentKey: "manual.content.shipping",
  },
  {
    id: "organigrama",
    titleKey: "manual.sections.organigrama",
    icon: "👥",
    contentKey: "manual.content.organigrama",
  },
  {
    id: "calendario",
    titleKey: "manual.sections.calendario",
    icon: "📅",
    contentKey: "manual.content.calendario",
  },
  {
    id: "glosario",
    titleKey: "manual.sections.glosario",
    icon: "📖",
    contentKey: "manual.content.glosario",
  },
];

const CONTENT: Record<string, Record<string, string>> = {
  "es-MX": {
    intro: `El Sistema de Control de Calidad de MI Technologies es una herramienta interna orientada a la certificación ISO 9001:2015. Permite registrar, dar seguimiento y analizar todas las operaciones de calidad del área de warehouse y logística.\n\n**Módulos disponibles:**\n- Dashboard con KPIs en tiempo real\n- No Conformidades (NC)\n- Recepciones de carga\n- Rechazos Externos (Return Orders)\n- Rechazos Internos con COPQ\n- Acciones Correctivas (CAPA)\n- Inspecciones AQL\n- Liberación de Shipping\n- Organigrama del equipo QC\n- Calendario de permisos y vacaciones`,
    login: `**Acceso al sistema**\n\nURL: La que te proporcionó tu administrador\nSesión: 8 horas de duración\n\n**Inicio de sesión:**\nEl sistema usa el Single Sign-On (SSO) de MI Technologies. Ingresa con tu cuenta corporativa de Nextcloud.\n\n**Cierre de sesión:**\nHaz clic en tu nombre en la esquina superior derecha → Cerrar sesión.\n\n**Si no puedes ingresar:**\nContacta al administrador del sistema para verificar que tu cuenta esté activa.`,
    dashboard: `**Dashboard — KPIs en tiempo real**\n\nMuestra los indicadores principales del área de calidad.\n\n**KPIs mostrados:**\n- External Rejects Cost (suma de precios de rechazos externos)\n- Internal Rejects Cost (suma COPQ en MXN)\n- Total Rejects Cost (suma de ambos)\n- NCs Abiertas (No Conformidades sin cerrar)\n- Colaboradores Activos (equipo QC)\n- Total Rechazos Externos del período\n\n**Filtros:**\n- Toggle Mes / YTD (Year to Date)\n- Selector de año\n\n**Gráficas:**\n- Sale Price por Marca (top 6)\n- Rechazos por Clasificación (top 6)\n- NCs por Severidad (Alta/Media/Baja)\n- NCs por Área (top 6)`,
    nc: `**No Conformidades (NC)**\n\n**Registrar una NC:**\n1. Haz clic en "Nueva NC"\n2. Llena: hora, área, tipo, descripción, severidad, responsable, acción inmediata\n3. Guarda el registro\n\n**Tipos disponibles:** Producto no conforme, Proceso fuera de parámetro, Documentación incorrecta, Equipo defectuoso, Incumplimiento de procedimiento, Proveedor, Otro\n\n**Severidades:** Alta (🔴), Media (🟡), Baja (🟢)\n\n**Ciclo de vida:**\nAbierta → En proceso → Cerrada\n\nCambia el estatus desde el detalle de la NC. Solo se puede avanzar, no retroceder.`,
    recepciones: `**Recepciones de Carga**\n\n**Registrar una recepción:**\n1. Haz clic en "Nueva Recepción"\n2. Llena: hora, transportista, origen, descripción de carga, unidades, pallets, tipo (Import/Export)\n3. Guarda\n\n**Estatus del flujo:**\nConfirmado → En descarga → Descargado (o Rechazado)\n\nActualiza el estatus conforme avanza la operación.`,
    re: `**Rechazos Externos (Return Orders)**\n\n**Registrar un rechazo externo:**\n1. Llena los datos del vehículo y orden (Return Order, placa, SKU, marca, canal de ventas)\n2. Agrega las descripciones del problema (puedes agregar varias)\n3. Agrega las acciones correctivas por departamento\n4. Sube fotos de evidencia\n5. Registra hora de entrada a planta\n\n**PDF NCR:**\nDesde el detalle del registro, haz clic en "Generar PDF NCR" para descargar el reporte oficial.\n\n**SKU Autocomplete:**\nAl escribir en el campo SKU, el sistema sugiere opciones del catálogo y autocompleta marca, modelo y pulgadas.`,
    ri: `**Rechazos Internos**\n\n**COPQ (Cost of Poor Quality):**\nAl seleccionar el tipo de defecto, el sistema calcula automáticamente:\n- La actividad a realizar\n- El costo de no calidad en MXN\n\nEste cálculo es automático basado en el catálogo interno. Puedes editarlo manualmente si es necesario.\n\n**Firma digital:**\nEl inspector debe firmar en el canvas antes de guardar el registro. La firma es obligatoria.\n\n**Fotos:**\nPuedes subir hasta 5 fotos de evidencia por registro.`,
    capa: `**Acciones Correctivas — CAPA**\n\n**Crear una CAPA:**\n1. Selecciona el origen (NC o Rechazo Externo)\n2. Elige el método de análisis: 5 Por Qués o Ishikawa\n3. Llena el análisis de causa raíz\n4. Agrega las acciones de seguimiento con responsable y fecha compromiso\n\n**5 Por Qués:** Responde secuencialmente los 5 niveles del análisis.\n\n**Ishikawa:** Identifica causas en las 6 categorías: Hombre, Máquina, Método, Material, Medición, Medio Ambiente.\n\n**Estatus:** Abierta → En proceso → Cerrada`,
    aql: `**Inspecciones AQL**\n\n**Registrar una inspección:**\n1. Llena los datos del producto (SKU, marca, modelo, pulgadas)\n2. Completa el checklist de inspección para cada categoría:\n   - Accesorios, Bolsa, Audio, Video, Físico de pantalla, Limpieza\n3. Marca OK o Defecto en cada categoría y describe los defectos encontrados\n4. El Estado AQL (Aprobado/Rechazado) se calcula automáticamente\n5. Sube foto del LPN y foto de pantalla (obligatorias)\n\n**SKU Autocomplete:** Al escribir en el campo SKU, se completan marca, modelo y descripción automáticamente.`,
    shipping: `**Liberación de Shipping**\n\n**Registrar una liberación:**\n1. Llena los datos de la orden (número, destino, paquetería, contenedor, sello)\n2. Registra las cantidades (pallets, manifiesto, física)\n3. El campo "Diferencia" se calcula automáticamente\n4. Sube las 5 fotos obligatorias:\n   - Contenedor vacío\n   - Contenedor cargado\n   - Caja sellada\n   - Placas del vehículo\n   - Manifiesto\n5. Registra el resultado de inspección y estatus de carga`,
    organigrama: `**Organigrama QC**\n\n**Gestión del equipo:**\nVista de cards con foto, nombre, puesto y turno de cada colaborador.\n\n**Agregar colaborador:**\nLlena nombre, número de empleado, puesto, área, turno, datos de contacto y contacto de emergencia.\n\n**Puestos disponibles:** Ingeniero de Calidad, Supervisor de Calidad, Técnico de Calidad, Especialista de Calidad, Inspector de Calidad\n\n**Áreas:** Incoming, Sorting, FFT, Paletizado, Almacén, Shipping\n\n**Foto:** Sube la foto del colaborador desde su tarjeta o formulario de edición.`,
    calendario: `**Calendario de Permisos y Vacaciones**\n\n**Solicitar ausencia:**\n1. Selecciona el colaborador\n2. Elige el tipo: Vacaciones, Permiso, Incapacidad o Capacitación\n3. Selecciona fechas de inicio y fin\n4. Los días hábiles se calculan automáticamente (excluye fines de semana y festivos)\n5. Agrega el motivo y envía la solicitud\n\n**Aprobación:** Solo el administrador puede aprobar o rechazar solicitudes.\n\n**Saldo Vacacional:** Gestiona los días asignados por colaborador y por año en la pestaña de Saldo.\n\n**Festivos:** El sistema incluye los festivos oficiales de México. El administrador puede agregar festivos adicionales.`,
    glosario: `**Glosario de términos**\n\n**NC / NCR:** No Conformidad / Non-Conformance Report — registro de un incumplimiento a los estándares de calidad.\n\n**CAPA:** Corrective and Preventive Action — acción correctiva y preventiva para eliminar la causa raíz de un problema.\n\n**COPQ:** Cost of Poor Quality — costo de la no calidad, expresado en pesos mexicanos (MXN).\n\n**AQL:** Acceptable Quality Level — nivel de calidad aceptable, estándar de muestreo para inspección.\n\n**SKU:** Stock Keeping Unit — código único de identificación de producto.\n\n**KPI:** Key Performance Indicator — indicador clave de desempeño.\n\n**YTD:** Year to Date — acumulado del año en curso.\n\n**5 Por Qués:** Método de análisis de causa raíz que consiste en preguntar "¿Por qué?" cinco veces de forma sucesiva.\n\n**Ishikawa:** Diagrama de causa-efecto (también llamado espina de pescado) con 6 categorías de análisis.\n\n**Return Order:** Orden de devolución de mercancía — asociada a los Rechazos Externos.\n\n**LPN:** License Plate Number — etiqueta de identificación de pallet o caja.`,
  },
  en: {
    intro: `The MI Technologies Quality Control System is an internal tool oriented towards ISO 9001:2015 certification. It enables registering, tracking, and analyzing all quality operations in the warehouse and logistics area.\n\n**Available modules:**\n- Real-time KPI Dashboard\n- Non-Conformances (NC)\n- Cargo Receptions\n- External Rejections (Return Orders)\n- Internal Rejections with COPQ\n- Corrective Actions (CAPA)\n- AQL Inspections\n- Shipping Release\n- QC Team Organigram\n- Permissions and Vacation Calendar`,
    login: `**System Access**\n\nURL: As provided by your administrator\nSession: 8-hour duration\n\n**Login:**\nThe system uses MI Technologies Single Sign-On (SSO). Log in with your Nextcloud corporate account.\n\n**Logout:**\nClick your name in the top-right corner → Log out.\n\n**If you can't log in:**\nContact the system administrator to verify your account is active.`,
    dashboard: `**Dashboard — Real-time KPIs**\n\nShows the main quality area indicators.\n\n**KPIs shown:**\n- External Rejects Cost (sum of external rejection prices)\n- Internal Rejects Cost (COPQ sum in MXN)\n- Total Rejects Cost (sum of both)\n- Open NCs (Non-Conformances not yet closed)\n- Active Collaborators (QC team)\n- Total External Rejections for the period\n\n**Filters:** Month / YTD toggle and year selector\n\n**Charts:** Sale Price by Brand, Rejections by Classification, NCs by Severity, NCs by Area`,
    nc: `**Non-Conformances (NC)**\n\nRegister quality non-conformances, track their status through the lifecycle:\n\nOpen → In Progress → Closed\n\nSeverity levels: High, Medium, Low`,
    recepciones: `**Cargo Receptions**\n\nLog incoming and outgoing cargo with carrier, origin, quantities, and pallet counts. Track status from Confirmed through Unloaded.`,
    re: `**External Rejections (Return Orders)**\n\nLog return orders with vehicle info, product SKU, problem descriptions, corrective actions by department, and photo evidence. Generate official NCR PDF reports.`,
    ri: `**Internal Rejections**\n\nLog internal defects with automatic COPQ calculation in MXN based on defect type. Mandatory digital signature and photo evidence required.`,
    capa: `**Corrective Actions (CAPA)**\n\nCreate corrective and preventive actions linked to NCs or External Rejections. Supports 5 Why and Ishikawa (fishbone) analysis methods with action tracking.`,
    aql: `**AQL Inspections**\n\nRecord product inspections with a full checklist: accessories, bag, audio, video, screen physical condition, and cleanliness. AQL status is automatically calculated.`,
    shipping: `**Shipping Release**\n\nRecord shipping order releases with container info, quantity verification, and 5 mandatory photos (empty container, loaded container, sealed box, plates, manifest).`,
    organigrama: `**QC Team Organigram**\n\nDirectory of the quality control team with photos, positions, schedules, and contact information. Manage active/inactive status.`,
    calendario: `**Permissions & Vacation Calendar**\n\nManage vacation, permission, disability, and training requests. Business days are automatically calculated excluding weekends and official holidays.`,
    glosario: `**Glossary**\n\n**NC/NCR:** Non-Conformance / Non-Conformance Report\n**CAPA:** Corrective and Preventive Action\n**COPQ:** Cost of Poor Quality (in MXN)\n**AQL:** Acceptable Quality Level\n**SKU:** Stock Keeping Unit\n**KPI:** Key Performance Indicator\n**YTD:** Year to Date\n**5 Whys:** Root cause analysis method\n**Ishikawa:** Fishbone/cause-effect diagram\n**Return Order:** Merchandise return order\n**LPN:** License Plate Number`,
  },
  "zh-CN": {
    intro: `MI Technologies质量控制系统是一个面向ISO 9001:2015认证的内部工具，用于记录、跟踪和分析仓库及物流区域的所有质量操作。\n\n**可用模块：**\n- 实时KPI仪表板\n- 不合格品(NC)\n- 货物接收\n- 外部拒收(退货单)\n- 内部拒收与COPQ\n- 纠正措施(CAPA)\n- AQL检验\n- 发货放行\n- QC团队组织架构\n- 假期与休假日历`,
    login: `**系统访问**\n\n使用您的Nextcloud企业账户登录。会话时长为8小时。如无法登录，请联系系统管理员。`,
    dashboard: `**仪表板 — 实时KPI**\n\n显示主要质量指标：外部拒收成本、内部拒收成本(COPQ)、NC数量、活跃员工数和期间总拒收量。`,
    nc: `**不合格品(NC)**\n\n记录质量不合格品，跟踪状态：待处理 → 处理中 → 已关闭。严重程度：高、中、低。`,
    recepciones: `**货物接收**\n\n记录进出货物信息：承运商、来源、数量和托盘数，跟踪从确认到卸货完成的状态。`,
    re: `**外部拒收(退货单)**\n\n记录退货单信息，包括车辆信息、产品SKU、问题描述、部门纠正措施和照片证据。可生成NCR报告PDF。`,
    ri: `**内部拒收**\n\n记录内部缺陷，根据缺陷类型自动计算COPQ（墨西哥比索）。需要强制数字签名和照片证据。`,
    capa: `**纠正措施(CAPA)**\n\n创建与NC或外部拒收关联的纠正和预防措施，支持5为什么和石川图（鱼骨图）分析方法。`,
    aql: `**AQL检验**\n\n使用完整检查清单记录产品检验：配件、包装、音频、视频、屏幕外观和清洁度。AQL状态自动计算。`,
    shipping: `**发货放行**\n\n记录发货放行信息，验证集装箱数量，上传5张强制照片（空集装箱、装载集装箱、密封箱、车牌、货运清单）。`,
    organigrama: `**QC团队组织架构**\n\n质量控制团队名录，含照片、职位、班次和联系信息。管理在职/离职状态。`,
    calendario: `**假期与休假日历**\n\n管理年假、请假、病假和培训申请。自动计算工作日（排除周末和法定节假日）。`,
    glosario: `**术语表**\n\n**NC/NCR：** 不合格品/不合格报告\n**CAPA：** 纠正和预防措施\n**COPQ：** 低质量成本（墨西哥比索）\n**AQL：** 可接受质量水平\n**SKU：** 库存单位编码\n**KPI：** 关键绩效指标\n**YTD：** 年初至今`,
  },
};

export default function Manual() {
  const { t, i18n } = useTranslation();
  const [activeSection, setActiveSection] = useState("intro");
  const [search, setSearch] = useState("");

  const lang = i18n.language?.startsWith("zh")
    ? "zh-CN"
    : i18n.language?.startsWith("es")
      ? "es-MX"
      : "en";

  const content = CONTENT[lang] ?? CONTENT["es-MX"];

  const filtered = search.trim()
    ? SECTIONS.filter(
        (s) =>
          t(s.titleKey).toLowerCase().includes(search.toLowerCase()) ||
          (content[s.id] ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : SECTIONS;

  const current = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];
  const currentContent = content[current.id] ?? "";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">
          {t("manual.title", "Manual de Usuario")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("manual.subtitle", "Sistema de Control de Calidad — MI Technologies")}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-50 border-r flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b">
            <input
              type="text"
              placeholder={t("manual.search", "Buscar...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filtered.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  activeSection === section.id
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{section.icon}</span>
                <span>{t(section.titleKey)}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-4 text-center">
                {t("manual.noResults", "Sin resultados")}
              </p>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{current.icon}</span>
              <h2 className="text-xl font-bold text-gray-800">{t(current.titleKey)}</h2>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {currentContent.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <p key={i} className="font-semibold text-gray-900 mt-4 mb-1">
                      {line.slice(2, -2)}
                    </p>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <p key={i} className="ml-4 text-gray-700">
                      • {line.slice(2)}
                    </p>
                  );
                }
                if (line.trim() === "") {
                  return <div key={i} className="h-2" />;
                }
                // Inline bold
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <p key={i} className="text-gray-700">
                    {parts.map((part, j) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={j}>{part.slice(2, -2)}</strong>
                      ) : (
                        part
                      ),
                    )}
                  </p>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
