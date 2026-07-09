/**
 * Additional routes for Dashboard, Organigrama, Calendario, Usuarios, Liberación Shipping
 */

import { Express, Request, Response } from "express";
import { db, pool, getClient, beginTransaction, commitTransaction, rollbackTransaction } from "./db.js";
import { requireAuth, requireAdmin } from "./auth.js";
import * as schema from "../shared/schema.js";
import * as s3 from "./s3.js";
import { eq, desc, sql, count, and } from "drizzle-orm";
import multer from "multer";
import { getBMPool } from "./binmanager.js";

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function registerRoutes(app: Express) {
  // ── DASHBOARD ──────────────────────────────────────────────────

  app.get("/api/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      const { periodo, anio, mes } = req.query;

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const year = anio ? parseInt(anio as string) : currentYear;
      const month = mes ? parseInt(mes as string) : currentMonth;

      // Each table has a different date column name
      let reFilter: string;   // rechazos_externos: registration_date
      let riFilter: string;   // rechazos_internos: fecha_registro
      let ncFilter: string;   // no_conformidades:  fecha

      if (periodo === "ytd") {
        reFilter = `EXTRACT(year FROM re.registration_date) = ${year}`;
        riFilter = `EXTRACT(year FROM ri.fecha_registro) = ${year}`;
        ncFilter = `EXTRACT(year FROM nc.fecha) = ${year}`;
      } else {
        reFilter = `EXTRACT(year FROM re.registration_date) = ${year} AND EXTRACT(month FROM re.registration_date) = ${month}`;
        riFilter = `EXTRACT(year FROM ri.fecha_registro) = ${year} AND EXTRACT(month FROM ri.fecha_registro) = ${month}`;
        ncFilter = `EXTRACT(year FROM nc.fecha) = ${year} AND EXTRACT(month FROM nc.fecha) = ${month}`;
      }

      const dashboardData = await pool.query(`
        SELECT
          (SELECT COALESCE(SUM(sale_price), 0) FROM rechazos_externos re WHERE ${reFilter}) as sale_price_total,
          (SELECT COALESCE(SUM(costo_no_calidad), 0) FROM rechazos_internos ri WHERE ${riFilter}) as copq_interno_total,
          (SELECT COUNT(*) FROM rechazos_externos re WHERE ${reFilter}) as rechazos_total,
          (SELECT COUNT(*) FROM no_conformidades nc WHERE ${ncFilter} AND nc.estatus = 'Abierta') as nc_abiertas,
          (SELECT COUNT(*) FROM organigrama_qc WHERE estatus = 'activo') as colaboradores_activos
      `);

      const marksQuery = await pool.query(`
        SELECT brand, SUM(sale_price) as total
        FROM rechazos_externos re
        WHERE ${reFilter}
        GROUP BY brand
        ORDER BY total DESC
        LIMIT 6
      `);

      const clasifQuery = await pool.query(`
        SELECT classification, COUNT(*) as count
        FROM rechazos_externos re
        WHERE ${reFilter}
        GROUP BY classification
        ORDER BY count DESC
      `);

      const severityQuery = await pool.query(`
        SELECT severidad, COUNT(*) as count
        FROM no_conformidades nc
        WHERE ${ncFilter}
        GROUP BY severidad
      `);

      const areaQuery = await pool.query(`
        SELECT area, COUNT(*) as count
        FROM no_conformidades nc
        WHERE ${ncFilter}
        GROUP BY area
      `);

      const metrics = dashboardData.rows[0];

      res.json({
        sale_price_total: parseFloat(metrics.sale_price_total) || 0,
        copq_interno_total: parseFloat(metrics.copq_interno_total) || 0,
        total_rejects_cost: parseFloat(metrics.sale_price_total) || 0,
        rechazos_total: parseInt(metrics.rechazos_total) || 0,
        nc_abiertas: parseInt(metrics.nc_abiertas) || 0,
        colaboradores_activos: parseInt(metrics.colaboradores_activos) || 0,
        sale_price_por_marca: marksQuery.rows,
        rechazos_por_clasif: clasifQuery.rows,
        nc_por_severidad: severityQuery.rows,
        nc_por_area: areaQuery.rows,
      });
    } catch (err) {
      console.error("[API] GET /api/dashboard error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── ORGANIGRAMA QC ─────────────────────────────────────────────

  app.get("/api/organigrama-qc", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(schema.organigramaQc)
        .orderBy(
          sql`CASE
            WHEN ${schema.organigramaQc.puesto} = 'Jefe QC' THEN 1
            WHEN ${schema.organigramaQc.puesto} = 'Supervisor QC' THEN 2
            WHEN ${schema.organigramaQc.puesto} = 'Inspector' THEN 3
            ELSE 4
          END`,
          schema.organigramaQc.nombreCompleto
        );

      res.json(result);
    } catch (err) {
      console.error("[API] GET /api/organigrama-qc error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/organigrama-qc", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        nombre_completo,
        no_empleado,
        puesto,
        area,
        turno,
        estatus,
        fecha_ingreso,
        telefono,
        correo,
        sexo,
        fecha_nacimiento,
        contacto_emergencia,
        tel_emergencia,
      } = req.body;

      const result = await db
        .insert(schema.organigramaQc)
        .values({
          nombreCompleto: nombre_completo,
          noEmpleado: no_empleado || "",
          puesto,
          area: area || "",
          turno: turno || "",
          estatus: estatus || "activo",
          fechaIngreso: fecha_ingreso || null,
          telefono: telefono || "",
          correo: correo || "",
          sexo: sexo || "",
          fechaNacimiento: fecha_nacimiento || null,
          contactoEmergencia: contacto_emergencia || "",
          telEmergencia: tel_emergencia || "",
        })
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] POST /api/organigrama-qc error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/organigrama-qc/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        nombre_completo,
        no_empleado,
        puesto,
        area,
        turno,
        estatus,
        fecha_ingreso,
        telefono,
        correo,
        sexo,
        fecha_nacimiento,
        contacto_emergencia,
        tel_emergencia,
      } = req.body;

      const result = await db
        .update(schema.organigramaQc)
        .set({
          nombreCompleto: nombre_completo,
          noEmpleado: no_empleado || "",
          puesto,
          area: area || "",
          turno: turno || "",
          estatus: estatus || "activo",
          fechaIngreso: fecha_ingreso || null,
          telefono: telefono || "",
          correo: correo || "",
          sexo: sexo || "",
          fechaNacimiento: fecha_nacimiento || null,
          contactoEmergencia: contacto_emergencia || "",
          telEmergencia: tel_emergencia || "",
        })
        .where(eq(schema.organigramaQc.id, parseInt(id)))
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] PUT /api/organigrama-qc/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch(
    "/api/organigrama-qc/:id/estatus",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const newStatus = (await db
          .select({
            estatus: sql`CASE WHEN ${schema.organigramaQc.estatus} = 'activo' THEN 'inactivo' ELSE 'activo' END`,
          })
          .from(schema.organigramaQc)
          .where(eq(schema.organigramaQc.id, parseInt(id)))
          .limit(1)) as any;

        if (newStatus.length === 0) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const result = await db
          .update(schema.organigramaQc)
          .set({ estatus: newStatus[0].estatus })
          .where(eq(schema.organigramaQc.id, parseInt(id)))
          .returning();

        res.json(result[0]);
      } catch (err) {
        console.error("[API] PATCH /api/organigrama-qc/:id/estatus error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/organigrama-qc/:id/foto",
    requireAuth,
    upload.single("foto"),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const orgId = parseInt(id);
        const file = req.file as Express.Multer.File | undefined;

        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const current = await db
          .select()
          .from(schema.organigramaQc)
          .where(eq(schema.organigramaQc.id, orgId))
          .limit(1);

        if (current.length > 0 && current[0].fotoFilename) {
          await s3.deleteFileFromS3(`organigrama/${current[0].fotoFilename}`);
        }

        const url = await s3.uploadFileToS3(
          file.buffer,
          file.originalname,
          "organigrama",
          `org-${orgId}`
        );

        const filename = url.split("/").pop() || file.originalname;

        await db
          .update(schema.organigramaQc)
          .set({ fotoFilename: filename })
          .where(eq(schema.organigramaQc.id, orgId));

        res.json({ foto: url });
      } catch (err) {
        console.error("[API] POST /api/organigrama-qc/:id/foto error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  app.delete("/api/organigrama-qc/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = parseInt(id);

      const orgRecord = await db
        .select()
        .from(schema.organigramaQc)
        .where(eq(schema.organigramaQc.id, orgId))
        .limit(1);

      if (orgRecord.length > 0 && orgRecord[0].fotoFilename) {
        await s3.deleteFileFromS3(`organigrama/${orgRecord[0].fotoFilename}`);
      }

      await db
        .delete(schema.organigramaQc)
        .where(eq(schema.organigramaQc.id, orgId));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/organigrama-qc/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── CALENDARIO ─────────────────────────────────────────────────

  // Solicitudes
  app.get("/api/calendario", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          cs.*,
          org.nombre_completo,
          org.area,
          org.puesto
        FROM calendario_solicitudes cs
        LEFT JOIN organigrama_qc org ON org.id = cs.colaborador_id
        ORDER BY cs.fecha_inicio DESC
      `);

      res.json(result.rows);
    } catch (err) {
      console.error("[API] GET /api/calendario error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/calendario", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        colaborador_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        dias_habiles,
        motivo,
        estatus,
      } = req.body;

      const result = await db
        .insert(schema.calendarioSolicitudes)
        .values({
          colaboradorId: colaborador_id,
          tipo,
          fechaInicio: fecha_inicio,
          fechaFin: fecha_fin,
          diasHabiles: dias_habiles || 1,
          motivo: motivo || "",
          estatus: estatus || "pendiente",
          registradoPor: req.user?.name || "",
        })
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] POST /api/calendario error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/calendario/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        colaborador_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        dias_habiles,
        motivo,
        estatus,
      } = req.body;

      const result = await db
        .update(schema.calendarioSolicitudes)
        .set({
          colaboradorId: colaborador_id,
          tipo,
          fechaInicio: fecha_inicio,
          fechaFin: fecha_fin,
          diasHabiles: dias_habiles || 1,
          motivo: motivo || "",
          estatus: estatus || "pendiente",
        })
        .where(eq(schema.calendarioSolicitudes.id, parseInt(id)))
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] PUT /api/calendario/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/calendario/:id/estatus", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { estatus, observaciones } = req.body;

      const result = await db
        .update(schema.calendarioSolicitudes)
        .set({
          estatus,
          aprobadoPor: req.user?.name || "",
          observaciones: observaciones || "",
        })
        .where(eq(schema.calendarioSolicitudes.id, parseInt(id)))
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] PATCH /api/calendario/:id/estatus error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/calendario/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(schema.calendarioSolicitudes)
        .where(eq(schema.calendarioSolicitudes.id, parseInt(id)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/calendario/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Festivos
  app.get("/api/calendario/festivos", async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(schema.calendarioFestivos)
        .orderBy(schema.calendarioFestivos.fecha);

      res.json(result);
    } catch (err) {
      console.error("[API] GET /api/calendario/festivos error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/calendario/festivos", requireAuth, async (req: Request, res: Response) => {
    try {
      const { nombre, fecha, recurrente } = req.body;

      const result = await db
        .insert(schema.calendarioFestivos)
        .values({
          nombre,
          fecha,
          recurrente: recurrente ?? true,
        })
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] POST /api/calendario/festivos error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/calendario/festivos/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(schema.calendarioFestivos)
        .where(eq(schema.calendarioFestivos.id, parseInt(id)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/calendario/festivos/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Saldo
  app.get("/api/calendario/saldo", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          cs.*,
          org.nombre_completo
        FROM calendario_saldo cs
        LEFT JOIN organigrama_qc org ON org.id = cs.colaborador_id
        ORDER BY cs.anio DESC
      `);

      res.json(result.rows);
    } catch (err) {
      console.error("[API] GET /api/calendario/saldo error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/calendario/saldo", requireAuth, async (req: Request, res: Response) => {
    try {
      const { colaborador_id, anio, dias_asignados } = req.body;

      // Upsert: insert or update on conflict
      const result = await pool.query(
        `INSERT INTO calendario_saldo (colaborador_id, anio, dias_asignados)
         VALUES ($1, $2, $3)
         ON CONFLICT (colaborador_id, anio) DO UPDATE SET dias_asignados = $3
         RETURNING *`,
        [colaborador_id, anio, dias_asignados]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("[API] POST /api/calendario/saldo error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── LIBERACIÓN SHIPPING ────────────────────────────────────────

  app.get("/api/liberacion-shipping", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(schema.liberacionShipping)
        .orderBy(desc(schema.liberacionShipping.fecha), desc(schema.liberacionShipping.createdAt));

      res.json(result);
    } catch (err) {
      console.error("[API] GET /api/liberacion-shipping error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/liberacion-shipping/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await db
        .select()
        .from(schema.liberacionShipping)
        .where(eq(schema.liberacionShipping.id, parseInt(id)))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }

      res.json(result[0]);
    } catch (err) {
      console.error("[API] GET /api/liberacion-shipping/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/liberacion-shipping", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        fecha,
        numero_orden,
        hora_inicio,
        hora_fin,
        destino,
        tipo_envio,
        tipo_orden,
        paqueteria,
        numero_contenedor,
        numero_sello,
        cantidad_pallets,
        cantidad_manifiesto,
        cantidad_fisica,
        estado,
        cantidad_diferencia,
        resultado_inspeccion,
        inspector,
        estatus_carga,
        comentarios,
      } = req.body;

      const result = await db
        .insert(schema.liberacionShipping)
        .values({
          fecha,
          numeroOrden: numero_orden || "",
          horaInicio: hora_inicio || "00:00",
          horaFin: hora_fin || "00:00",
          destino: destino || "",
          tipoEnvio: tipo_envio || "",
          tipoOrden: tipo_orden || "",
          paqueteria: paqueteria || "",
          numeroContenedor: numero_contenedor || "",
          numeroSello: numero_sello || "",
          cantidadPallets: cantidad_pallets || 0,
          cantidadManifiesto: cantidad_manifiesto || 0,
          cantidadFisica: cantidad_fisica || 0,
          estado: estado || "",
          cantidadDiferencia: cantidad_diferencia || 0,
          resultadoInspeccion: resultado_inspeccion || "",
          inspector: inspector || "",
          estatusCarga: estatus_carga || "",
          comentarios: comentarios || "",
          registradoPor: req.user?.name || "",
        })
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] POST /api/liberacion-shipping error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/liberacion-shipping/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        fecha,
        numero_orden,
        hora_inicio,
        hora_fin,
        destino,
        tipo_envio,
        tipo_orden,
        paqueteria,
        numero_contenedor,
        numero_sello,
        cantidad_pallets,
        cantidad_manifiesto,
        cantidad_fisica,
        estado,
        cantidad_diferencia,
        resultado_inspeccion,
        inspector,
        estatus_carga,
        comentarios,
      } = req.body;

      const result = await db
        .update(schema.liberacionShipping)
        .set({
          fecha,
          numeroOrden: numero_orden || "",
          horaInicio: hora_inicio || "00:00",
          horaFin: hora_fin || "00:00",
          destino: destino || "",
          tipoEnvio: tipo_envio || "",
          tipoOrden: tipo_orden || "",
          paqueteria: paqueteria || "",
          numeroContenedor: numero_contenedor || "",
          numeroSello: numero_sello || "",
          cantidadPallets: cantidad_pallets || 0,
          cantidadManifiesto: cantidad_manifiesto || 0,
          cantidadFisica: cantidad_fisica || 0,
          estado: estado || "",
          cantidadDiferencia: cantidad_diferencia || 0,
          resultadoInspeccion: resultado_inspeccion || "",
          inspector: inspector || "",
          estatusCarga: estatus_carga || "",
          comentarios: comentarios || "",
        })
        .where(eq(schema.liberacionShipping.id, parseInt(id)))
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] PUT /api/liberacion-shipping/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/liberacion-shipping/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const shipId = parseInt(id);

      const shipRecord = await db
        .select()
        .from(schema.liberacionShipping)
        .where(eq(schema.liberacionShipping.id, shipId))
        .limit(1);

      if (shipRecord.length > 0) {
        const fotos = [
          shipRecord[0].fotoContenedorVacio,
          shipRecord[0].fotoContenedorCargado,
          shipRecord[0].fotoCajaSellada,
          shipRecord[0].fotoPlacas,
          shipRecord[0].fotoManifiesto,
        ];

        for (const foto of fotos) {
          if (foto) {
            await s3.deleteFileFromS3(`shipping/${foto}`);
          }
        }
      }

      await db
        .delete(schema.liberacionShipping)
        .where(eq(schema.liberacionShipping.id, shipId));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/liberacion-shipping/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Foto endpoints for Liberación Shipping
  const fotoColumns = [
    { field: "foto_contenedor_vacio", column: "fotoContenedorVacio" },
    { field: "foto_contenedor_cargado", column: "fotoContenedorCargado" },
    { field: "foto_caja_sellada", column: "fotoCajaSellada" },
    { field: "foto_placas", column: "fotoPlacas" },
    { field: "foto_manifiesto", column: "fotoManifiesto" },
  ];

  fotoColumns.forEach(({ field, column }) => {
    app.post(
      `/api/liberacion-shipping/:id/${field}`,
      requireAuth,
      upload.single("foto"),
      async (req: Request, res: Response) => {
        try {
          const { id } = req.params;
          const shipId = parseInt(id);
          const file = req.file as Express.Multer.File | undefined;

          if (!file) {
            return res.status(400).json({ error: "No file provided" });
          }

          const current = await db
            .select()
            .from(schema.liberacionShipping)
            .where(eq(schema.liberacionShipping.id, shipId))
            .limit(1);

          if (current.length > 0) {
            const oldFoto = current[0][column as keyof typeof current[0]];
            if (oldFoto) {
              await s3.deleteFileFromS3(`shipping/${oldFoto}`);
            }
          }

          const url = await s3.uploadFileToS3(
            file.buffer,
            file.originalname,
            "shipping",
            `ship-${shipId}`
          );

          const filename = url.split("/").pop() || file.originalname;

          const updateData: any = {};
          updateData[column] = filename;

          await db
            .update(schema.liberacionShipping)
            .set(updateData)
            .where(eq(schema.liberacionShipping.id, shipId));

          res.json({ [field]: url });
        } catch (err) {
          console.error(`[API] POST /api/liberacion-shipping/:id/${field} error:`, err);
          res.status(500).json({ error: "Internal server error" });
        }
      }
    );
  });

  // ── USUARIOS (admin only) ──────────────────────────────────────

  app.get("/api/usuarios", requireAuth, async (req: Request, res: Response) => {
    try {
      // TODO: Check admin role from database
      const result = await db
        .select({
          id: schema.usuarios.id,
          nombre: schema.usuarios.nombre,
          usuario: schema.usuarios.usuario,
          rol: schema.usuarios.rol,
          area: schema.usuarios.area,
          activo: schema.usuarios.activo,
          createdAt: schema.usuarios.createdAt,
        })
        .from(schema.usuarios);

      res.json(result);
    } catch (err) {
      console.error("[API] GET /api/usuarios error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/usuarios", requireAuth, async (req: Request, res: Response) => {
    try {
      // TODO: Check admin role from database
      const { nombre, usuario, password, rol, area } = req.body;

      if (!nombre || !usuario || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Hash password (placeholder - requires bcrypt)
      const hashedPassword = password; // TODO: hash with bcrypt

      const result = await db
        .insert(schema.usuarios)
        .values({
          nombre,
          usuario,
          passwordHash: hashedPassword,
          rol: rol || "Usuario",
          area: area || "",
          activo: true,
        })
        .returning({
          id: schema.usuarios.id,
          nombre: schema.usuarios.nombre,
          usuario: schema.usuarios.usuario,
          rol: schema.usuarios.rol,
          area: schema.usuarios.area,
          activo: schema.usuarios.activo,
        });

      res.json(result[0]);
    } catch (err) {
      console.error("[API] POST /api/usuarios error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/usuarios/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, usuario, password, rol, area } = req.body;

      const hashedPassword = password; // TODO: hash with bcrypt if provided

      const result = await db
        .update(schema.usuarios)
        .set({
          nombre,
          usuario,
          ...(password && { passwordHash: hashedPassword }),
          rol,
          area,
        })
        .where(eq(schema.usuarios.id, parseInt(id)))
        .returning({
          id: schema.usuarios.id,
          nombre: schema.usuarios.nombre,
          usuario: schema.usuarios.usuario,
          rol: schema.usuarios.rol,
          area: schema.usuarios.area,
          activo: schema.usuarios.activo,
        });

      // TODO: Update session if user is editing themselves

      res.json(result[0]);
    } catch (err) {
      console.error("[API] PUT /api/usuarios/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/usuarios/:id/toggle", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await db.execute(sql`
        UPDATE ${schema.usuarios}
        SET ${schema.usuarios.activo} = NOT ${schema.usuarios.activo}
        WHERE ${eq(schema.usuarios.id, parseInt(id))}
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("[API] PATCH /api/usuarios/:id/toggle error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/usuarios/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(schema.usuarios)
        .where(eq(schema.usuarios.id, parseInt(id)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/usuarios/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── BINMANAGER — B2C DASHBOARD ────────────────────────────────────────────

  app.get("/api/b2c-orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const bm = await getBMPool();

      // Default: last 30 days
      const startDate = (req.query.startDate as string) ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const endDate = (req.query.endDate as string) ||
        new Date().toISOString().slice(0, 10);

      // One row per item; group into orders in Node.js
      const result = await bm.request()
        .input("startDate", startDate)
        .input("endDate",   endDate)
        .query(`
          SELECT
            ot.OrderID,
            ot.OrderEntryID,
            o.EnteredDate                                                       AS FechaIngreso,
            ot.ShipDate,
            o.AccountName,
            ot.ShipBy,
            ISNULL(psi.FirstName + ' ' + ISNULL(psi.LastName, ''), '')         AS CustomerShippingName,
            ot.WebSKU,
            ot.MappedSKU                                                        AS MitSKU,
            ot.LPN,
            CASE
              WHEN CHARINDEX('-', REVERSE(ot.MappedSKU)) > 0
              THEN REVERSE(LEFT(REVERSE(ot.MappedSKU),
                   CHARINDEX('-', REVERSE(ot.MappedSKU)) - 1))
              ELSE NULL
            END                                                                 AS Clasificacion,
            sku.Description                                                     AS DescripcionProducto,
            ot.Qty,
            o.Source                                                            AS CanalVenta,
            o.MarketplaceOrderStatus                                            AS Status,
            ot.Tracking,
            ot.Shipment_ID,
            wl.LocationName
          FROM FFM.OrderTracking ot
          LEFT JOIN OM.Orders o              ON ot.OrderID   = o.WebOrderID
          LEFT JOIN OM.PortalShipInfo psi    ON o.OrderID    = psi.OrderID
          LEFT JOIN PRO.SKUData sku          ON ot.WebSKU    = sku.SKU
          LEFT JOIN BM.WarehouseLocations wl ON o.LocationID = wl.LocationID
          WHERE o.EnteredDate >= @startDate
            AND o.EnteredDate <  DATEADD(day, 1, CAST(@endDate AS date))
          ORDER BY o.EnteredDate DESC
        `);

      // Group rows by OrderID → orders with Items[]
      const ordersMap = new Map<string, Record<string, unknown>>();
      for (const row of result.recordset) {
        const key = String(row.OrderID);
        if (!ordersMap.has(key)) {
          ordersMap.set(key, {
            OrderID:             row.OrderID,
            OrderEntryID:        row.OrderEntryID,
            FechaIngreso:        row.FechaIngreso,
            ShipDate:            row.ShipDate,
            AccountName:         row.AccountName,
            ShipBy:              row.ShipBy,
            CustomerShippingName:row.CustomerShippingName,
            Qty:                 0,
            CanalVenta:          row.CanalVenta,
            Status:              row.Status,
            Tracking:            row.Tracking,
            Shipment_ID:         row.Shipment_ID,
            LocationName:        row.LocationName,
            Items:               [] as Record<string, unknown>[],
          });
        }
        const order = ordersMap.get(key)!;
        (order.Qty as number);
        order.Qty = (order.Qty as number) + (row.Qty ?? 0);
        (order.Items as Record<string, unknown>[]).push({
          WebSKU:              row.WebSKU,
          MitSKU:              row.MitSKU,
          LPN:                 row.LPN,
          Clasificacion:       row.Clasificacion,
          DescripcionProducto: row.DescripcionProducto,
          Qty:                 row.Qty,
        });
      }

      res.json(Array.from(ordersMap.values()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[API] GET /api/b2c-orders error:", msg);
      res.status(500).json({ error: "Error al conectar con BinManager", detail: msg });
    }
  });

  // ── TEMP: BinManager schema introspection ─────────────────────────────────
  app.get("/api/debug/bm-schema", requireAuth, async (_req: Request, res: Response) => {
    try {
      const bm = await getBMPool();
      const r = await bm.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'OM' AND TABLE_NAME = 'OrderItems'
        ORDER BY ORDINAL_POSITION
      `);
      const cols = r.recordset.map((c: Record<string, unknown>) => `${c.COLUMN_NAME} (${c.DATA_TYPE})`);
      res.json({ columns: cols });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── BINMANAGER — B2B DASHBOARD ────────────────────────────────────────────

  app.get("/api/b2b-orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const bm = await getBMPool();

      const startDate = (req.query.startDate as string) ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const endDate = (req.query.endDate as string) ||
        new Date().toISOString().slice(0, 10);

      // Query 1: Orders with aggregated totals (one row per order)
      const ordersResult = await bm.request()
        .input("startDate", startDate)
        .input("endDate",   endDate)
        .query(`
          SELECT
            o.OrderID,
            ISNULL(
              c.FullName + ' CID(' + CAST(o.CustomerID AS VARCHAR) + ')',
              ISNULL(o.AccountName, 'Sin nombre')
            )                                                          AS CustomerName,
            ISNULL(o.Total, 0)                                         AS Total,
            CASE o.OrderStatus
              WHEN 0 THEN 'Cancelled'
              ELSE CASE o.StatusInternal
                WHEN 2  THEN 'Processing'
                WHEN 4  THEN 'In Transit'
                WHEN 6  THEN 'Complete'
                WHEN 7  THEN 'Cancelled'
                WHEN 8  THEN 'Partial'
                WHEN 16 THEN 'In Transit'
                WHEN 17 THEN 'Complete'
                ELSE 'Pending'
              END
            END                                                        AS Status,
            ISNULL(o.Location, '')                                     AS Location,
            o.EnteredDate,
            ISNULL(o.EnteredBy, '')                                    AS EnteredBy,
            o.InvoiceDate,
            o.DueDate,
            o.CurrencyCode,
            ISNULL(sr1.FullName, 'Not Assigned')                       AS SalesRep1Name,
            ISNULL(sr2.FullName, 'Not Assigned')                       AS SalesRep2Name,
            ISNULL(ship.BillingAddress, '')                            AS BillingAddress,
            ISNULL(units.UnitsOrdered, 0)                              AS UnitsOrdered,
            ISNULL(delivered.UnitsDelivered, 0)                        AS UnitsDelivered,
            ISNULL(pay_agg.Paid, 0)                                    AS Paid
          FROM OM.Orders o
          LEFT JOIN OM.Customers c ON o.CustomerID = c.CustomerID
          LEFT JOIN OM.SalesRep sr1 ON o.SalesRep1 = sr1.SalesRepId
          LEFT JOIN OM.SalesRep sr2 ON o.SalesRep2 = sr2.SalesRepId
          LEFT JOIN (
            SELECT OrderID, MIN(BillingAddress) AS BillingAddress
            FROM OM.OrderShippings GROUP BY OrderID
          ) ship ON o.OrderID = ship.OrderID
          LEFT JOIN (
            SELECT OrderID, SUM(Qty) AS UnitsOrdered
            FROM OM.OrderItems GROUP BY OrderID
          ) units ON o.OrderID = units.OrderID
          LEFT JOIN (
            SELECT OrderID, SUM(Qty) AS UnitsDelivered
            FROM OM.OrderDeliveryDetails GROUP BY OrderID
          ) delivered ON o.OrderID = delivered.OrderID
          LEFT JOIN (
            SELECT OrderID, SUM(Amount * ISNULL(CurrencyValue, 1)) AS Paid
            FROM OM.OrderPayments GROUP BY OrderID
          ) pay_agg ON o.OrderID = pay_agg.OrderID
          WHERE o.OrderTypeID = 1
            AND o.EnteredDate >= @startDate
            AND o.EnteredDate < DATEADD(day, 1, CAST(@endDate AS date))
          ORDER BY o.EnteredDate DESC
        `);

      const orders = ordersResult.recordset;
      if (orders.length === 0) return res.json([]);

      // Query 2: Items grouped by SKU for those orders
      const orderIds = orders.map((o: Record<string, unknown>) => o.OrderID).join(",");
      const itemsResult = await bm.request().query(`
        SELECT
          oi.OrderID,
          oi.SKU,
          MIN(oi.LPN)              AS LPN,
          MIN(oi.ItemDescription)  AS ItemDescription,
          COUNT(oi.OrderItemsID)   AS QtyOrdered,
          AVG(ISNULL(oi.Rate, 0))  AS Rate,
          SUM(ISNULL(oi.Amount, 0)) AS Amount,
          ISNULL(d.Delivered, 0)   AS QtyDelivered
        FROM OM.OrderItems oi
        LEFT JOIN (
          SELECT OrderID, SKU, SUM(Qty) AS Delivered
          FROM OM.OrderDeliveryDetails GROUP BY OrderID, SKU
        ) d ON oi.OrderID = d.OrderID AND oi.SKU = d.SKU
        WHERE oi.OrderID IN (${orderIds})
        GROUP BY oi.OrderID, oi.SKU, d.Delivered
        ORDER BY oi.OrderID, oi.SKU
      `);

      // Attach items to orders
      const ordersMap = new Map<number, Record<string, unknown>>();
      for (const row of orders) {
        ordersMap.set(row.OrderID as number, { ...row, Items: [] });
      }
      for (const item of itemsResult.recordset) {
        const order = ordersMap.get(item.OrderID as number);
        if (order) (order.Items as unknown[]).push(item);
      }

      res.json(Array.from(ordersMap.values()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[API] GET /api/b2b-orders error:", msg);
      res.status(500).json({ error: "Error al conectar con BinManager", detail: msg });
    }
  });
}
