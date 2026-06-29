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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';
import type { RechazosInterno, RiListResponse } from '../types';

import RiTable from '../components/rechazos-internos/RiTable';
import RiForm, { type RiFormValues } from '../components/rechazos-internos/RiForm';
import RiDetailModal from '../components/rechazos-internos/RiDetailModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const STATUS_TABS = ['Todas', 'Abierto', 'Cerrado'] as const;
type StatusFilter = (typeof STATUS_TABS)[number];

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.error ?? j?.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

function buildListUrl(params: {
  estatus: StatusFilter;
  search: string;
  page: number;
}): string {
  const qs = new URLSearchParams();
  if (params.estatus !== 'Todas') qs.set('estatus', params.estatus);
  if (params.search) qs.set('search', params.search);
  qs.set('page', String(params.page));
  qs.set('limit', String(PAGE_SIZE));
  return `${API_BASE_URL}/api/rechazos-internos?${qs.toString()}`;
}

/** Upload photo files for a given RI record */
async function uploadImages(id: number, files: File[]): Promise<void> {
  if (!files.length) return;
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  const res = await fetch(`${API_BASE_URL}/api/rechazos-internos/${id}/images`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error(`Error al subir imágenes: HTTP ${res.status}`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RechazosInternos() {
  const { t } = useTranslation();
  const notify  = useNotify();
  const confirm = useConfirm();
  const qc = useQueryClient();

  // ── Filters & pagination ──────────────────────────────────────────────────

  const [activeStatus, setActiveStatus] = useState<StatusFilter>('Todas');
  const [searchInput,  setSearchInput]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // 500 ms debounce on search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [activeStatus]);

  // ── Modal state ───────────────────────────────────────────────────────────

  const [formOpen,   setFormOpen]   = useState(false);
  const [isEditing,  setIsEditing]  = useState(false);
  const [editData,   setEditData]   = useState<RechazosInterno | null>(null);
  const [detailId,   setDetailId]   = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const listUrl = buildListUrl({ estatus: activeStatus, search: debouncedSearch, page });

  const { data: listRes, isLoading: listLoading } = useQuery<RiListResponse>({
    queryKey: ['ri', activeStatus, debouncedSearch, page],
    queryFn: () => apiFetch<RiListResponse>(listUrl),
    placeholderData: (prev) => prev,
  });

  // Fetch ALL records (no filter) for tab counts
  const { data: allRes } = useQuery<RiListResponse>({
    queryKey: ['ri', 'all-counts'],
    queryFn: () => apiFetch<RiListResponse>(`${API_BASE_URL}/api/rechazos-internos?limit=1000`),
    staleTime: 30_000,
  });

  const statusCounts: Record<StatusFilter, number> = {
    Todas:   allRes?.total ?? 0,
    Abierto: (allRes?.data ?? []).filter((r) => r.estatus === 'Abierto').length,
    Cerrado: (allRes?.data ?? []).filter((r) => r.estatus === 'Cerrado').length,
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: RiFormValues) => {
      // 1. Create record
      const created = await apiFetch<{ data: RechazosInterno }>(`${API_BASE_URL}/api/rechazos-internos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_registro:     values.fecha_registro,
          license_plate:      values.license_plate,
          sku:                values.sku,
          marca:              values.marca,
          modelo:             values.modelo,
          pulgada:            values.pulgada,
          descripcion:        values.descripcion,
          defecto:            values.defecto,
          actividad_realizar: values.actividad_realizar,
          costo_no_calidad:   values.costo_no_calidad,
          origen_hallazgo:    values.origen_hallazgo,
          inspector:          values.inspector,
          observaciones:      values.observaciones,
          firma_digital:      values.firma_digital,
        }),
      });
      const newId = created.data.id;
      // 2. Upload images if any
      if (values.newFiles.length > 0) {
        await uploadImages(newId, values.newFiles);
      }
      return created.data;
    },
    onSuccess: () => {
      notify('Rechazo Interno registrado correctamente.', 'success');
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ['ri'] });
    },
    onError: (err: Error) => notify(err.message, 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: RiFormValues }) => {
      const updated = await apiFetch<{ data: RechazosInterno }>(
        `${API_BASE_URL}/api/rechazos-internos/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha_registro:     values.fecha_registro,
            license_plate:      values.license_plate,
            sku:                values.sku,
            marca:              values.marca,
            modelo:             values.modelo,
            pulgada:            values.pulgada,
            descripcion:        values.descripcion,
            defecto:            values.defecto,
            actividad_realizar: values.actividad_realizar,
            costo_no_calidad:   values.costo_no_calidad,
            origen_hallazgo:    values.origen_hallazgo,
            inspector:          values.inspector,
            observaciones:      values.observaciones,
            firma_digital:      values.firma_digital,
          }),
        },
      );
      if (values.newFiles.length > 0) {
        await uploadImages(id, values.newFiles);
      }
      return updated.data;
    },
    onSuccess: () => {
      notify('Rechazo Interno actualizado correctamente.', 'success');
      setFormOpen(false);
      setEditData(null);
      void qc.invalidateQueries({ queryKey: ['ri'] });
    },
    onError: (err: Error) => notify(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`${API_BASE_URL}/api/rechazos-internos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notify('Rechazo Interno eliminado.', 'success');
      void qc.invalidateQueries({ queryKey: ['ri'] });
    },
    onError: (err: Error) => notify(err.message, 'error'),
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
        title:       'Eliminar Rechazo Interno',
        message:     `¿Estás seguro de que deseas eliminar el Rechazo Interno #${id}? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText:  'Cancelar',
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
          <h1 className="text-2xl font-bold text-gray-900">
            {t('rechazos_internos.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Gestión de Rechazos Internos y COPQ — ISO 9001:2015 §8.7
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="
            inline-flex items-center gap-2
            rounded-lg bg-blue-600 px-4 py-2
            text-sm font-medium text-white shadow-sm
            hover:bg-blue-700 transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('rechazos_internos.add')}
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => { setActiveStatus(status); setPage(1); }}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeStatus === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {status}
            <span className={[
              'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
              activeStatus === status
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600',
            ].join(' ')}>
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por Placa, SKU o Defecto…"
          className="
            w-full rounded-lg border border-gray-300 bg-white
            py-2 pl-10 pr-4 text-sm shadow-sm
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
          "
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setDebouncedSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Limpiar búsqueda"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
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
        onCancel={() => { setFormOpen(false); setEditData(null); }}
        submitting={isMutating}
      />

      {/* Detail modal */}
      <RiDetailModal
        id={detailId}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailId(null); }}
      />

    </div>
  );
}
