/**
 * RechazosExternos Page — Phase 2C Module 1
 *
 * Features:
 *   - Status filter tabs with per-tab counts (Todas / Aceptado / Pendiente / Rechazado)
 *   - Debounced text search by Return Order, License Plate, Classification (500ms)
 *   - Paginated table (20 per page, server-driven)
 *   - Create / Edit modal form with multi-problem pairs and photo upload
 *   - Read-only detail modal with photo gallery + lightbox carousel
 *   - Delete with confirm dialog
 *   - SKU cascading fill via SkuAutocomplete
 *   - Two-step create/edit: POST/PUT JSON body first, then multipart image upload
 *
 * API used:
 *   GET    /api/rechazos-externos?page&limit&estatus&search
 *   GET    /api/rechazos-externos/:id
 *   POST   /api/rechazos-externos
 *   PUT    /api/rechazos-externos/:id
 *   DELETE /api/rechazos-externos/:id
 *   POST   /api/rechazos-externos/:id/images
 *   DELETE /api/rechazos-externos/:id/images/:imageId
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';
import ReTable from '../components/rechazos-externos/ReTable';
import ReForm, { type ReFormData } from '../components/rechazos-externos/ReForm';
import ReDetailModal from '../components/rechazos-externos/ReDetailModal';
import type { RechazosExterno, ReListResponse } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE            = 20;
const SEARCH_DEBOUNCE_MS   = 500;

type StatusTab = '' | 'Aceptado' | 'Pendiente' | 'Rechazado';

interface TabDef {
  value: StatusTab;
  labelKey: string;
}

const STATUS_TABS: TabDef[] = [
  { value: '',           labelKey: 'rechazos_externos.status_tabs.todas'     },
  { value: 'Aceptado',   labelKey: 'rechazos_externos.status_tabs.aceptado'  },
  { value: 'Pendiente',  labelKey: 'rechazos_externos.status_tabs.pendiente' },
  { value: 'Rechazado',  labelKey: 'rechazos_externos.status_tabs.rechazado' },
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json?.error?.message ?? json?.message ?? json?.error ?? message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function uploadImages(id: number, files: File[]): Promise<void> {
  if (!files.length) return;
  const formData = new FormData();
  files.forEach((f) => formData.append('images', f));
  const res = await fetch(`${API_BASE_URL}/api/rechazos-externos/${id}/images`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json?.error?.message ?? json?.message ?? json?.error ?? message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
}

// ── List URL + query key builder ──────────────────────────────────────────────

function buildListUrl(page: number, estatus: StatusTab, search: string): string {
  const p = new URLSearchParams();
  p.set('page',  String(page));
  p.set('limit', String(PAGE_SIZE));
  if (estatus)      p.set('estatus', estatus);
  if (search.trim()) p.set('search', search.trim());
  return `/api/rechazos-externos?${p.toString()}`;
}

function buildListKey(page: number, estatus: StatusTab, search: string) {
  return ['rechazos-externos', 'list', page, estatus, search] as const;
}

// ── Tab counts hook ───────────────────────────────────────────────────────────

function useTabCounts(allData: ReListResponse | undefined) {
  const fetchCount = (estatus: string) =>
    apiFetch<ReListResponse>(
      `/api/rechazos-externos?page=1&limit=1${estatus ? `&estatus=${estatus}` : ''}`,
    );

  const aceptadoQ  = useQuery<ReListResponse>({ queryKey: ['rechazos-externos', 'count', 'Aceptado'],  queryFn: () => fetchCount('Aceptado'),  staleTime: 30000 });
  const pendienteQ = useQuery<ReListResponse>({ queryKey: ['rechazos-externos', 'count', 'Pendiente'], queryFn: () => fetchCount('Pendiente'), staleTime: 30000 });
  const rechazadoQ = useQuery<ReListResponse>({ queryKey: ['rechazos-externos', 'count', 'Rechazado'], queryFn: () => fetchCount('Rechazado'), staleTime: 30000 });

  return {
    '':          allData?.total ?? 0,
    Aceptado:    aceptadoQ.data?.total  ?? 0,
    Pendiente:   pendienteQ.data?.total ?? 0,
    Rechazado:   rechazadoQ.data?.total ?? 0,
  } as Record<StatusTab, number>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RechazosExternos() {
  const { t }   = useTranslation();
  const notify  = useNotify();
  const confirm = useConfirm();
  const qc      = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<StatusTab>('');
  const [searchInput,     setSearchInput]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleTabChange = useCallback((tab: StatusTab) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const listUrl = buildListUrl(page, activeTab, debouncedSearch);
  const listKey = buildListKey(page, activeTab, debouncedSearch);

  const listQuery = useQuery<ReListResponse>({
    queryKey: listKey,
    queryFn:  () => apiFetch<ReListResponse>(listUrl),
    staleTime: 60000,
    placeholderData: (prev) => prev,
  });

  const tabCounts = useTabCounts(activeTab === '' ? listQuery.data : undefined);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [formOpen,     setFormOpen]     = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<RechazosExterno | undefined>(undefined);
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [detailTarget, setDetailTarget] = useState<RechazosExterno | undefined>(undefined);
  const [fetchingId,   setFetchingId]   = useState<number | null>(null);

  // ── Fetch single record ───────────────────────────────────────────────────
  const fetchSingle = useCallback(async (id: number): Promise<RechazosExterno | null> => {
    try {
      setFetchingId(id);
      return await apiFetch<RechazosExterno>(`/api/rechazos-externos/${id}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : t('common.error'), 'error');
      return null;
    } finally {
      setFetchingId(null);
    }
  }, [notify, t]);

  // ── Invalidate all RE queries ─────────────────────────────────────────────
  const invalidateAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['rechazos-externos'] });
  }, [qc]);

  // ── Modal openers ─────────────────────────────────────────────────────────
  const handleView = useCallback(async (id: number) => {
    const rec = await fetchSingle(id);
    if (!rec) return;
    setDetailTarget(rec);
    setDetailOpen(true);
  }, [fetchSingle]);

  const handleEdit = useCallback(async (id: number) => {
    const rec = await fetchSingle(id);
    if (!rec) return;
    setEditTarget(rec);
    setIsEditing(true);
    setFormOpen(true);
  }, [fetchSingle]);

  const handleAddNew = useCallback(() => {
    setEditTarget(undefined);
    setIsEditing(false);
    setFormOpen(true);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation<RechazosExterno, Error, { form: ReFormData; files: File[] }>({
    mutationFn: async ({ form, files }) => {
      const body = {
        return_order:          form.return_order,
        license_plate:         form.license_plate,
        classification:        form.classification,
        inches:                form.inches,
        sales_channel:         form.sales_channel,
        sku:                   form.sku,
        brand:                 form.brand,
        plant_entry:           form.plant_entry,
        plant_exit:            form.plant_exit || null,
        total_time_minutes:    form.total_time_minutes,
        outbound_order:        form.outbound_order,
        processed_by:          form.processed_by,
        registration_date:     form.registration_date || null,
        sale_price:            form.sale_price ? parseFloat(form.sale_price) : null,
        estatus:               'Pendiente',
        problem_descriptions:  form.problems.map((p, i) => ({ orden: i + 1, descripcion: p.descripcion })),
        corrective_actions:    (form.corrective_actions ?? []),
      };
      const rec = await apiFetch<RechazosExterno>('/api/rechazos-externos', {
        method: 'POST',
        body:   JSON.stringify(body),
      });
      if (files.length > 0) {
        await uploadImages(rec.id, files);
      }
      return rec;
    },
    onSuccess: () => {
      notify(t('common.success'), 'success');
      setFormOpen(false);
      invalidateAll();
    },
    onError: (err) => notify(err.message, 'error'),
  });

  const updateMutation = useMutation<RechazosExterno, Error, { id: number; form: ReFormData; files: File[] }>({
    mutationFn: async ({ id, form, files }) => {
      const body = {
        return_order:          form.return_order,
        license_plate:         form.license_plate,
        classification:        form.classification,
        inches:                form.inches,
        sales_channel:         form.sales_channel,
        sku:                   form.sku,
        brand:                 form.brand,
        plant_entry:           form.plant_entry,
        plant_exit:            form.plant_exit || null,
        total_time_minutes:    form.total_time_minutes,
        outbound_order:        form.outbound_order,
        processed_by:          form.processed_by,
        registration_date:     form.registration_date || null,
        sale_price:            form.sale_price ? parseFloat(form.sale_price) : null,
        problem_descriptions:  form.problems.map((p, i) => ({ orden: i + 1, descripcion: p.descripcion })),
        corrective_actions:    (form.corrective_actions ?? []),
      };
      const rec = await apiFetch<RechazosExterno>(`/api/rechazos-externos/${id}`, {
        method: 'PUT',
        body:   JSON.stringify(body),
      });
      if (files.length > 0) {
        await uploadImages(id, files);
      }
      return rec;
    },
    onSuccess: () => {
      notify(t('common.success'), 'success');
      setFormOpen(false);
      invalidateAll();
    },
    onError: (err) => notify(err.message, 'error'),
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) =>
      apiFetch(`/api/rechazos-externos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notify(t('common.success'), 'success');
      invalidateAll();
      const remaining = (listQuery.data?.data.length ?? 0) - 1;
      if (remaining === 0 && page > 1) setPage((p) => p - 1);
    },
    onError: (err) => notify(err.message, 'error'),
  });

  const deletePhotoMutation = useMutation<unknown, Error, { reId: number; imageId: number }>({
    mutationFn: ({ reId, imageId }) =>
      apiFetch(`/api/rechazos-externos/${reId}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notify(t('common.success'), 'success');
      // Refresh the detail modal content
      if (detailTarget) {
        const refreshed = await fetchSingle(detailTarget.id);
        if (refreshed) setDetailTarget(refreshed);
      }
      invalidateAll();
    },
    onError: (err) => notify(err.message, 'error'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: number) => {
    const ok = await confirm({
      title:       t('confirm.title'),
      message:     t('confirm.delete_confirm'),
      confirmText: t('common.delete'),
      cancelText:  t('common.cancel'),
    });
    if (ok) deleteMutation.mutate(id);
  }, [confirm, deleteMutation, t]);

  const handleFormSubmit = useCallback((formData: ReFormData, files: File[]) => {
    if (isEditing && editTarget) {
      updateMutation.mutate({ id: editTarget.id, form: formData, files });
    } else {
      createMutation.mutate({ form: formData, files });
    }
  }, [isEditing, editTarget, createMutation, updateMutation]);

  const handleDeletePhoto = useCallback((imageId: number) => {
    if (!detailTarget) return;
    deletePhotoMutation.mutate({ reId: detailTarget.id, imageId });
  }, [detailTarget, deletePhotoMutation]);

  const handleEditFromDetail = useCallback(() => {
    if (!detailTarget) return;
    setDetailOpen(false);
    setEditTarget(detailTarget);
    setIsEditing(true);
    setFormOpen(true);
  }, [detailTarget]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const rows      = listQuery.data?.data    ?? [];
  const total     = listQuery.data?.total   ?? 0;
  const isLoading = listQuery.isLoading || fetchingId !== null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111111', marginBottom: 2 }}>
            {t('rechazos_externos.title')}
          </h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{t('nav.rechazos_ext')}</p>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="btn btn-primario"
        >
          + {t('rechazos_externos.add')}
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ borderBottom: '2px solid #e2e2e2', display: 'flex', gap: 0 }}>
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const count    = tabCounts[tab.value];
          return (
            <button
              key={tab.value || 'todas'}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #0d2b4e' : '2px solid transparent',
                marginBottom: -2,
                color: isActive ? '#0d2b4e' : '#666',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t(tab.labelKey)}
              <span style={{
                background: isActive ? '#0d2b4e' : '#e2e2e2',
                color: isActive ? '#fff' : '#555',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="filtros">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none', fontSize: 14 }}>
            &#128269;
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('rechazos_externos.search_placeholder')}
            aria-label={t('rechazos_externos.search_placeholder')}
            style={{ paddingLeft: 30 }}
          />
        </div>
      </div>

      {/* Error banner */}
      {listQuery.isError && (
        <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>
          {t('common.error')}: {listQuery.error instanceof Error ? listQuery.error.message : ''}
        </div>
      )}

      {/* Table */}
      <ReTable
        data={rows}
        loading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        currentPage={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      {/* Create / Edit form modal */}
      <ReForm
        isOpen={formOpen}
        isEditing={isEditing}
        data={editTarget}
        onSubmit={handleFormSubmit}
        onCancel={() => setFormOpen(false)}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {/* Detail modal */}
      {detailOpen && detailTarget && (
        <ReDetailModal
          isOpen={detailOpen}
          data={detailTarget}
          onClose={() => setDetailOpen(false)}
          onEdit={handleEditFromDetail}
          onDeletePhoto={handleDeletePhoto}
          isDeletingPhoto={deletePhotoMutation.isPending}
        />
      )}
    </div>
  );
}
