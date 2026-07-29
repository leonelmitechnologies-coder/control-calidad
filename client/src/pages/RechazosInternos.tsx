/**
 * RechazosInternos Page
 *
 * Full CRUD module for internal rejects (ISO 9001:2015 §8.7).
 *
 * Features:
 *   - Status filter tabs: Todas / Abierto / Cerrado
 *   - Searchable, paginated table (20 rows/page) — debounced 500 ms
 *   - Create / Edit modal form with COPQ auto-fill + mandatory digital signature
 *   - Detail read-only modal with COPQ mapping, photo gallery, signature preview
 *   - Delete with confirmation
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import RiDetailModal from "../components/rechazos-internos/RiDetailModal";
import RiForm, { type RiFormValues } from "../components/rechazos-internos/RiForm";
import RiTable from "../components/rechazos-internos/RiTable";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import type { RechazosInterno, RiListResponse } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const STATUS_TABS = ["Todas", "Abierto", "Cerrado"] as const;
type StatusFilter = (typeof STATUS_TABS)[number];

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.error ?? j?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

function buildListUrl(params: { estatus: StatusFilter; search: string; page: number }): string {
  const qs = new URLSearchParams();
  if (params.estatus !== "Todas") qs.set("estatus", params.estatus);
  if (params.search) qs.set("search", params.search);
  qs.set("page", String(params.page));
  qs.set("limit", String(PAGE_SIZE));
  return `${API_BASE_URL}/api/rechazos-internos?${qs.toString()}`;
}

/** Upload photo files for a given RI record */
async function uploadImages(id: number, files: File[]): Promise<void> {
  if (!files.length) return;
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  const res = await fetch(`${API_BASE_URL}/api/rechazos-internos/${id}/images`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`Error al subir imágenes: HTTP ${res.status}`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RechazosInternos() {
  const { t } = useTranslation();
  const notify = useNotify();
  const confirm = useConfirm();
  const qc = useQueryClient();

  // ── Filters & pagination ──────────────────────────────────────────────────

  const [activeStatus, setActiveStatus] = useState<StatusFilter>("Todas");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // 500 ms debounce on search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus]);

  // ── Modal state ───────────────────────────────────────────────────────────

  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<RechazosInterno | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const listUrl = buildListUrl({ estatus: activeStatus, search: debouncedSearch, page });

  const { data: listRes, isLoading: listLoading } = useQuery<RiListResponse>({
    queryKey: ["ri", activeStatus, debouncedSearch, page],
    queryFn: () => apiFetch<RiListResponse>(listUrl),
    placeholderData: (prev) => prev,
  });

  // Fetch ALL records (no filter) for tab counts
  const { data: allRes } = useQuery<RiListResponse>({
    queryKey: ["ri", "all-counts"],
    queryFn: () => apiFetch<RiListResponse>(`${API_BASE_URL}/api/rechazos-internos?limit=1000`),
    staleTime: 30_000,
  });

  const statusCounts: Record<StatusFilter, number> = {
    Todas: allRes?.total ?? 0,
    Abierto: (allRes?.data ?? []).filter((r) => r.estatus === "Abierto").length,
    Cerrado: (allRes?.data ?? []).filter((r) => r.estatus === "Cerrado").length,
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: RiFormValues) => {
      // 1. Create record
      const created = await apiFetch<RechazosInterno>(`${API_BASE_URL}/api/rechazos-internos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_registro: values.fecha_registro,
          license_plate: values.license_plate,
          sku: values.sku,
          marca: values.marca,
          modelo: values.modelo,
          pulgada: values.pulgada,
          descripcion: values.descripcion,
          defecto: values.defecto,
          actividad_realizar: values.actividad_realizar,
          costo_no_calidad: values.costo_no_calidad,
          origen_hallazgo: values.origen_hallazgo,
          inspector: values.inspector,
          firma_digital: values.firma_digital,
        }),
      });
      const newId = created.id;
      // 2. Upload images if any (non-fatal — record is already saved)
      if (values.newFiles.length > 0) {
        try {
          await uploadImages(newId, values.newFiles);
        } catch {
          notify("El registro se guardó, pero las fotos no pudieron subirse.", "error");
        }
      }
      return created;
    },
    onSuccess: () => {
      notify("Rechazo Interno registrado correctamente.", "success");
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ["ri"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: RiFormValues }) => {
      const updated = await apiFetch<RechazosInterno>(
        `${API_BASE_URL}/api/rechazos-internos/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha_registro: values.fecha_registro,
            license_plate: values.license_plate,
            sku: values.sku,
            marca: values.marca,
            modelo: values.modelo,
            pulgada: values.pulgada,
            descripcion: values.descripcion,
            defecto: values.defecto,
            actividad_realizar: values.actividad_realizar,
            costo_no_calidad: values.costo_no_calidad,
            origen_hallazgo: values.origen_hallazgo,
            inspector: values.inspector,
            firma_digital: values.firma_digital,
          }),
        },
      );
      if (values.newFiles.length > 0) {
        try {
          await uploadImages(id, values.newFiles);
        } catch {
          notify("El registro se actualizó, pero las fotos no pudieron subirse.", "error");
        }
      }
      return updated;
    },
    onSuccess: () => {
      notify("Rechazo Interno actualizado correctamente.", "success");
      setFormOpen(false);
      setEditData(null);
      void qc.invalidateQueries({ queryKey: ["ri"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`${API_BASE_URL}/api/rechazos-internos/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      notify("Rechazo Interno eliminado.", "success");
      void qc.invalidateQueries({ queryKey: ["ri"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenCreate = useCallback(() => {
    setIsEditing(false);
    setEditData(null);
    setFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback(
    (id: number) => {
      const ri = listRes?.data.find((r) => r.id === id) ?? null;
      setIsEditing(true);
      setEditData(ri);
      setFormOpen(true);
    },
    [listRes],
  );

  const handleOpenDetail = useCallback((id: number) => {
    setDetailId(id);
    setDetailOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirm({
        title: "Eliminar Rechazo Interno",
        message: `¿Estás seguro de que deseas eliminar el Rechazo Interno #${id}? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
      });
      if (ok) deleteMutation.mutate(id);
    },
    [confirm, deleteMutation],
  );

  const handleFormSubmit = useCallback(
    (values: RiFormValues) => {
      if (isEditing && editData) {
        updateMutation.mutate({ id: editData.id, values });
      } else {
        createMutation.mutate(values);
      }
    },
    [isEditing, editData, createMutation, updateMutation],
  );

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111111", marginBottom: 2 }}>
            {t("rechazos_internos.title")}
          </h1>
          <p style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
            Gestión de Rechazos Internos y COPQ — ISO 9001:2015 §8.7
          </p>
        </div>
        <button type="button" onClick={handleOpenCreate} className="btn btn-primario">
          + {t("rechazos_internos.add")}
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ borderBottom: "2px solid #e2e2e2", display: "flex", gap: 0 }}>
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setActiveStatus(status);
              setPage(1);
            }}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: "none",
              border: "none",
              borderBottom: activeStatus === status ? "2px solid #0d2b4e" : "2px solid transparent",
              marginBottom: -2,
              color: activeStatus === status ? "#0d2b4e" : "#666",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {status}
            <span
              style={{
                background: activeStatus === status ? "#0d2b4e" : "#e2e2e2",
                color: activeStatus === status ? "#fff" : "#555",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="filtros">
        <div style={{ position: "relative" }}>
          <svg
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: "#999",
              pointerEvents: "none",
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por Placa, SKU o Defecto…"
            style={{ paddingLeft: 28 }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
              }}
              aria-label="Limpiar búsqueda"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#999",
                display: "flex",
                padding: 0,
              }}
            >
              <svg
                style={{ width: 14, height: 14 }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <RiTable
        data={listRes?.data ?? []}
        total={listRes?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onView={handleOpenDetail}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        isLoading={listLoading}
      />

      {/* Create / Edit form modal */}
      <RiForm
        isOpen={formOpen}
        isEditing={isEditing}
        data={editData}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setFormOpen(false);
          setEditData(null);
        }}
        submitting={isMutating}
      />

      {/* Detail modal */}
      <RiDetailModal
        id={detailId}
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailId(null);
        }}
      />
    </div>
  );
}
