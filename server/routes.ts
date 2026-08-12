/**
 * Additional routes for Dashboard, Organigrama, Calendario, Usuarios, Liberación Shipping
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import multer from "multer";
import * as schema from "../shared/schema.js";
import { requireAdmin, requireAuth } from "./auth.js";
import { getBMPool } from "./binmanager.js";
import {
  beginTransaction,
  commitTransaction,
  db,
  getClient,
  pool,
  rollbackTransaction,
} from "./db.js";
import * as s3 from "./s3.js";

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
  // ── MEDIA PROXY ────────────────────────────────────────────────
  // Streams S3/MinIO files through the app server so the browser
  // never needs direct (often private) MinIO access.
  app.get("/api/media/:folder/:filename", async (req: Request, res: Response) => {
    const { folder, filename } = req.params;
    // Path safety: no dots in folder, no traversal in filename
    if (folder.includes(".") || filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({ error: "Invalid path" });
    }

    // 1) Try local disk first (fast, no network) — covers legacy monolith files and local-dev uploads
    const localPath = path.resolve(process.cwd(), "public", "uploads", folder, filename);
    if (existsSync(localPath)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(localPath);
    }

    // 2) Try S3/MinIO (only when credentials are configured)
    if (s3.s3Available) {
      try {
        const { stream, contentType } = await s3.streamFileFromS3(folder, filename);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        (stream as NodeJS.ReadableStream).pipe(res);
        return;
      } catch (s3Err: any) {
        const isNotFound =
          s3Err?.name === "NoSuchKey" || s3Err?.$metadata?.httpStatusCode === 404;
        if (!isNotFound) {
          console.error("[API/media] S3 error:", s3Err?.message ?? s3Err);
        }
      }
    }

    return res.status(404).json({ error: "Not found" });
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
          schema.organigramaQc.nombreCompleto,
        );

      const withUrls = result.map((emp) => ({
        ...emp,
        fotoUrl: emp.fotoFilename ? s3.getFileUrl("organigrama", emp.fotoFilename) : null,
      }));
      res.json(withUrls);
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
        nfc_id,
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
          nfcId: nfc_id || "",
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
        nfc_id,
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
          nfcId: nfc_id !== undefined ? nfc_id : undefined,
        })
        .where(eq(schema.organigramaQc.id, parseInt(id)))
        .returning();

      res.json(result[0]);
    } catch (err) {
      console.error("[API] PUT /api/organigrama-qc/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/organigrama-qc/:id/estatus", requireAuth, async (req: Request, res: Response) => {
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
  });

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
          `org-${orgId}`,
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
    },
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

      await db.delete(schema.organigramaQc).where(eq(schema.organigramaQc.id, orgId));

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
      const { colaborador_id, tipo, fecha_inicio, fecha_fin, dias_habiles, motivo, estatus } =
        req.body;

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
      const { colaborador_id, tipo, fecha_inicio, fecha_fin, dias_habiles, motivo, estatus } =
        req.body;

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
        [colaborador_id, anio, dias_asignados],
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

      await db.delete(schema.liberacionShipping).where(eq(schema.liberacionShipping.id, shipId));

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
            const oldFoto = current[0][column as keyof (typeof current)[0]];
            if (oldFoto) {
              await s3.deleteFileFromS3(`shipping/${oldFoto}`);
            }
          }

          const url = await s3.uploadFileToS3(
            file.buffer,
            file.originalname,
            "shipping",
            `ship-${shipId}`,
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
      },
    );
  });

  // ── USUARIOS (admin only) ──────────────────────────────────────
  // SECURITY FIX (2026-08-02, found during the GAC retrofit): these 5 routes
  // were gated by requireAuth only (any logged-in "Usuario" could edit rol/
  // permisos of ANY account, self-promote to Administrador, toggle anyone's
  // activo, or delete any account outright) — the TODO comments below
  // ("Check admin role from database") were never actually done. This is a
  // separate, pre-existing bug from the GAC login-allowlist gap, but directly
  // undermines the same admin/rol boundary GAC depends on, so it's fixed here
  // too. GET /api/usuarios below is shadowed by index.ts's own admin-gated
  // GET /api/usuarios (registered first, at module load) so this GET is dead
  // code in practice — left requireAdmin'd anyway for correctness.

  app.get("/api/usuarios", requireAdmin, async (req: Request, res: Response) => {
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

  app.post("/api/usuarios", requireAdmin, async (req: Request, res: Response) => {
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

  app.put("/api/usuarios/:id", requireAdmin, async (req: Request, res: Response) => {
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

  app.patch("/api/usuarios/:id/toggle", requireAdmin, async (req: Request, res: Response) => {
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

  app.delete("/api/usuarios/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db.delete(schema.usuarios).where(eq(schema.usuarios.id, parseInt(id)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/usuarios/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── REGISTRO COMIDA ──────────────────────────────────────────────

  // GET /api/registro-comida — historial con soporte diario/semanal/mensual
  app.get("/api/registro-comida", requireAuth, async (req: Request, res: Response) => {
    try {
      const { fecha, turno, tipo_movimiento, fecha_inicio, fecha_fin } = req.query as Record<string, string>;
      const hoy = new Date().toISOString().slice(0, 10);

      // Date range: explicit range wins, then single fecha, default today
      const desde = fecha_inicio || fecha || hoy;
      const hasta = fecha_fin || fecha || hoy;

      let query = `
        SELECT rc.id, rc.colaborador_id, rc.fecha, rc.hora_registro, rc.turno,
               rc.tipo_movimiento, rc.observaciones, rc.registrado_por, rc.created_at,
               oq.nombre_completo, oq.area, oq.puesto, oq.turno AS turno_colaborador,
               oq.foto_filename
        FROM registro_comida rc
        JOIN organigrama_qc oq ON oq.id = rc.colaborador_id
        WHERE rc.fecha BETWEEN $1 AND $2
      `;
      const params: any[] = [desde, hasta];

      if (turno) {
        query += ` AND rc.turno = $${params.length + 1}`;
        params.push(turno);
      }
      if (tipo_movimiento) {
        query += ` AND rc.tipo_movimiento = $${params.length + 1}`;
        params.push(tipo_movimiento);
      }

      query += " ORDER BY rc.fecha DESC, rc.hora_registro DESC, rc.id DESC";

      const result = await pool.query(query, params);
      const rows = result.rows.map((r: any) => ({
        ...r,
        foto_url: r.foto_filename ? s3.getFileUrl("organigrama", r.foto_filename) : null,
      }));
      res.json({ data: rows, total: rows.length, desde, hasta });
    } catch (err) {
      console.error("[API] GET /api/registro-comida error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/registro-comida/colaboradores — colaboradores activos del organigrama
  app.get("/api/registro-comida/colaboradores", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT id, nombre_completo, area, puesto, turno, foto_filename, nfc_id
        FROM organigrama_qc
        WHERE estatus = 'activo'
        ORDER BY nombre_completo ASC
      `);
      const rows = result.rows.map((r: any) => ({
        ...r,
        foto_url: r.foto_filename ? s3.getFileUrl("organigrama", r.foto_filename) : null,
      }));
      res.json(rows);
    } catch (err) {
      console.error("[API] GET /api/registro-comida/colaboradores error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/registro-comida/escaneo — registro automático por NFC
  app.post("/api/registro-comida/escaneo", requireAuth, async (req: Request, res: Response) => {
    try {
      const { nfc_id, fecha, turno } = req.body;
      if (!nfc_id) return res.status(400).json({ error: "nfc_id es requerido" });

      const hoy = fecha || new Date().toISOString().slice(0, 10);

      // Buscar colaborador por nfc_id
      const colab = await pool.query(
        `SELECT id, nombre_completo, area, puesto, turno, foto_filename
         FROM organigrama_qc WHERE nfc_id = $1 AND estatus = 'activo' LIMIT 1`,
        [nfc_id],
      );
      if (colab.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador no encontrado para este tag NFC" });
      }
      const colaborador = colab.rows[0];

      // Determinar tipo de movimiento según el último registro del día
      const ultimo = await pool.query(
        `SELECT tipo_movimiento FROM registro_comida
         WHERE colaborador_id = $1 AND fecha = $2
         ORDER BY hora_registro DESC, id DESC LIMIT 1`,
        [colaborador.id, hoy],
      );
      const ultimoTipo = ultimo.rows[0]?.tipo_movimiento ?? null;
      const tipoMovimiento = ultimoTipo === "salida_comedor" ? "entrada_produccion" : "salida_comedor";

      const registrado_por = (req.user as any)?.name || (req.user as any)?.email || "NFC";
      const hora = new Date().toTimeString().slice(0, 5);

      const inserted = await pool.query(
        `INSERT INTO registro_comida (colaborador_id, fecha, hora_registro, turno, tipo_movimiento, observaciones, registrado_por)
         VALUES ($1, $2, $3, $4, $5, '', $6) RETURNING *`,
        [colaborador.id, hoy, hora, turno || colaborador.turno || "", tipoMovimiento, registrado_por],
      );

      res.status(201).json({
        ...inserted.rows[0],
        nombre_completo: colaborador.nombre_completo,
        area: colaborador.area,
        puesto: colaborador.puesto,
        turno_colaborador: colaborador.turno,
        foto_url: colaborador.foto_filename ? s3.getFileUrl("organigrama", colaborador.foto_filename) : null,
      });
    } catch (err) {
      console.error("[API] POST /api/registro-comida/escaneo error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/registro-comida — registro manual
  app.post("/api/registro-comida", requireAuth, async (req: Request, res: Response) => {
    try {
      const { colaborador_id, fecha, hora_registro, turno, tipo_movimiento, observaciones } = req.body;
      if (!colaborador_id || !fecha) {
        return res.status(400).json({ error: "colaborador_id y fecha son requeridos" });
      }

      const registrado_por = (req.user as any)?.name || (req.user as any)?.email || "Sistema";
      const hora = hora_registro || new Date().toTimeString().slice(0, 5);

      const inserted = await pool.query(
        `INSERT INTO registro_comida (colaborador_id, fecha, hora_registro, turno, tipo_movimiento, observaciones, registrado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [colaborador_id, fecha, hora, turno || "", tipo_movimiento || "salida_comedor", observaciones || "", registrado_por],
      );

      const row = await pool.query(
        `SELECT rc.*, oq.nombre_completo, oq.area, oq.puesto, oq.foto_filename
         FROM registro_comida rc
         JOIN organigrama_qc oq ON oq.id = rc.colaborador_id
         WHERE rc.id = $1`,
        [inserted.rows[0].id],
      );

      res.status(201).json(row.rows[0]);
    } catch (err) {
      console.error("[API] POST /api/registro-comida error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/registro-comida/:id/hora — editar hora de un registro
  app.patch("/api/registro-comida/:id/hora", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { hora_registro } = req.body as { hora_registro: string };
      if (!hora_registro || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora_registro)) {
        return res.status(400).json({ error: "hora_registro inválida (formato HH:MM o HH:MM:SS)" });
      }
      const hora = hora_registro.length === 5 ? hora_registro + ":00" : hora_registro;
      await pool.query("UPDATE registro_comida SET hora_registro = $1 WHERE id = $2", [hora, parseInt(id)]);
      res.json({ ok: true });
    } catch (err) {
      console.error("[API] PATCH /api/registro-comida/:id/hora error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/registro-comida/:id
  app.delete("/api/registro-comida/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM registro_comida WHERE id = $1", [parseInt(id)]);
      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/registro-comida/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

}
