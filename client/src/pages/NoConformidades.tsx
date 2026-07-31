/**
 * No Conformidades Page
 *
 * Full CRUD module for managing Non-Conformity reports.
 * Features:
 *   - Status filter tabs with per-tab counts
 *   - Searchable, paginated table (20 rows/page)
 *   - Create / Edit modal form
 *   - Detail (read-only) modal with status advancement
 *   - Delete with confirmation
 *   - 500 ms debounced search
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import NcDetailModal from "../components/nc/NcDetailModal";
import NcForm, { type FormValues as NcFormValues } from "../components/nc/NcForm";
import NcTable from "../components/nc/NcTable";
import StatusTabs from "../components/nc/StatusTabs";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import type { NcListResponse, NoConformidad } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const ALL_STATUSES = ["Todas", "Abierta", "En proceso", "Cerrada"] as const;
type StatusFilter = (typeof ALL_STATUSES)[number];

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

function buildListUrl(params: {
  estatus: StatusFilter;
  search: string;
  page: number;
  startDate: string;
  endDate: string;
}): string {
  const qs = new URLSearchParams();
  if (params.estatus !== "Todas") qs.set("estatus", params.estatus);
  if (params.search) qs.set("search", params.search);
  if (params.startDate) qs.set("start_date", params.startDate);
  if (params.endDate) qs.set("end_date", params.endDate);
  qs.set("page", String(params.page));
  qs.set("limit", String(PAGE_SIZE));
  return `${API_BASE_URL}/api/nc?${qs.toString()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NoConformidades() {
  const { t } = useTranslation();
  const notify = useNotify();
  const confirm = useConfirm();
  const qc = useQueryClient();

  // ── Filter / pagination state ───────────────────────────────────────────────
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("Todas");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search input (500 ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // reset to first page on new search
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Reset page when tab or date filters change
  useEffect(() => {
    setPage(1);
  }, [activeStatus, startDate, endDate]);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<NoConformidad | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<NoConformidad | null>(null);

  // ── Query: list (paginated + filtered) ─────────────────────────────────────
  const listUrl = buildListUrl({
    estatus: activeStatus,
    search: debouncedSearch,
    page,
    startDate,
    endDate,
  });

  const { data: listRes, isLoading: listLoading } = useQuery<NcListResponse>({
    queryKey: ["nc", activeStatus, debouncedSearch, page, startDate, endDate],
    queryFn: () => apiFetch<NcListResponse>(listUrl),
    placeholderData: (prev) => prev, // keep previous data while fetching
  });

  // ── Query: all records (for tab counts) ─────────────────────────────────────
  // Fetch all without pagination to compute counts per status.
  const allCountUrl = `${API_BASE_URL}/api/nc?limit=1000`;
  const { data: allRes } = useQuery<NcListResponse>({
    queryKey: ["nc", "all-counts"],
    queryFn: () => apiFetch<NcListResponse>(allCountUrl),
    staleTime: 30_000,
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todas: allRes?.total ?? 0,
      Abierta: 0,
      "En proceso": 0,
      Cerrada: 0,
    };
    (allRes?.data ?? []).forEach((nc) => {
      if (nc.estatus in counts) counts[nc.estatus]++;
    });
    return counts;
  }, [allRes]);

  const tabs = ALL_STATUSES.map((s) => ({
    label: s === "Todas" ? "Todas" : s === "En proceso" ? "En proceso" : s,
    value: s,
    count: statusCounts[s] ?? 0,
  }));

  // ── Mutation: create ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: NcFormValues) =>
      apiFetch<NoConformidad>(`${API_BASE_URL}/api/nc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      notify("No Conformidad registrada correctamente.", "success");
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ["nc"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  // ── Mutation: update ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: NcFormValues }) =>
      apiFetch<NoConformidad>(`${API_BASE_URL}/api/nc/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      notify("No Conformidad actualizada correctamente.", "success");
      setFormOpen(false);
      setEditData(null);
      void qc.invalidateQueries({ queryKey: ["nc"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  // ── Mutation: change estatus ─────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ id, estatus }: { id: number; estatus: string }) =>
      apiFetch<NoConformidad>(`${API_BASE_URL}/api/nc/${id}/estatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus }),
      }),
    onSuccess: (updated) => {
      notify(`Estatus actualizado a "${updated.estatus}".`, "success");
      setDetailOpen(false);
      setDetailData(null);
      void qc.invalidateQueries({ queryKey: ["nc"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  // ── Mutation: delete ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`${API_BASE_URL}/api/nc/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      notify("No Conformidad eliminada.", "success");
      void qc.invalidateQueries({ queryKey: ["nc"] });
    },
    onError: (err: Error) => notify(err.message, "error"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleOpenCreate = useCallback(() => {
    setIsEditing(false);
    setEditData(null);
    setFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback(
    (id: number) => {
      const nc = listRes?.data.find((r) => r.id === id) ?? null;
      setIsEditing(true);
      setEditData(nc);
      setFormOpen(true);
    },
    [listRes],
  );

  const handleOpenDetail = useCallback(
    (id: number) => {
      const nc = listRes?.data.find((r) => r.id === id) ?? null;
      setDetailData(nc);
      setDetailOpen(true);
    },
    [listRes],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirm({
        title: "Eliminar No Conformidad",
        message: `¿Estás seguro de que deseas eliminar la NC #${id}? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
      });
      if (ok) deleteMutation.mutate(id);
    },
    [confirm, deleteMutation],
  );

  const handleFormSubmit = useCallback(
    (values: NcFormValues) => {
      if (isEditing && editData) {
        updateMutation.mutate({ id: editData.id, body: values });
      } else {
        createMutation.mutate(values);
      }
    },
    [isEditing, editData, createMutation, updateMutation],
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!detailData) return;
      statusMutation.mutate({ id: detailData.id, estatus: newStatus });
    },
    [detailData, statusMutation],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111111", marginBottom: 2 }}>
            {t("nc.title")}
          </h1>
          <p style={{ fontSize: 13, color: "#666" }}>
            Gestión de No Conformidades — ISO 9001:2015 §8.7
          </p>
        </div>
        <button onClick={handleOpenCreate} className="btn btn-primario">
          + {t("nc.add")}
        </button>
      </div>

      {/* Status tabs */}
      <StatusTabs
        tabs={tabs}
        active={activeStatus}
        onChange={(v) => setActiveStatus(v as StatusFilter)}
      />

      {/* Search + date filter bar */}
      <div className="filtros">
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#999",
              pointerEvents: "none",
            }}
          >
            ⌕
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por área, tipo o descripción…"
            style={{ paddingLeft: 28, width: "100%" }}
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <label style={{ whiteSpace: "nowrap" }}>Desde</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label style={{ whiteSpace: "nowrap" }}>Hasta</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="btn btn-secundario"
              title="Limpiar fechas"
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <NcTable
        data={listRes?.data ?? []}
        loading={listLoading}
        onView={handleOpenDetail}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        currentPage={page}
        pageSize={PAGE_SIZE}
        total={listRes?.total ?? 0}
        onPageChange={setPage}
      />

      {/* Create / Edit form modal */}
      <NcForm
        isOpen={formOpen}
        isEditing={isEditing}
        data={editData}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setFormOpen(false);
          setEditData(null);
        }}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Detail modal */}
      <NcDetailModal
        isOpen={detailOpen}
        data={detailData}
        onClose={() => {
          setDetailOpen(false);
          setDetailData(null);
        }}
        onStatusChange={handleStatusChange}
        statusChanging={statusMutation.isPending}
      />
    </div>
  );
}
