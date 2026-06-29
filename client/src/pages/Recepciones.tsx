/**
 * Recepciones Page — Phase 2B Module 3
 *
 * Features:
 *   - Status filter tabs with per-tab counts (Todas / Confirmado / Pendiente / Rechazado)
 *   - Debounced text search by Company / Origen (500 ms)
 *   - Paginated table (20 per page, server-driven)
 *   - Create / Edit form modal with 4 grouped FieldGroup sections
 *   - Read-only detail modal with status-change action buttons
 *   - Delete with useConfirm() confirmation
 *   - All notifications via useNotify()
 *
 * API used:
 *   GET    /api/recepciones?page&limit&estatus&company&origen
 *   GET    /api/recepciones/:id
 *   POST   /api/recepciones
 *   PUT    /api/recepciones/:id
 *   PATCH  /api/recepciones/:id/estatus
 *   DELETE /api/recepciones/:id
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';
import RecepcionTable from '../components/recepciones/RecepcionTable';
import RecepcionForm, { type RecepcionFormData } from '../components/recepciones/RecepcionForm';
import RecepcionDetailModal from '../components/recepciones/RecepcionDetailModal';
import type { Recepcion, RecepcionesResponse } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 500;

// Status tabs (value matches the server filter; empty string = Todas)
type StatusTab = '' | 'Confirmado' | 'Pendiente' | 'Rechazado';

interface TabDef {
  value: StatusTab;
  labelKey: string;
}

const STATUS_TABS: TabDef[] = [
  { value: '',            labelKey: 'recepciones.status_tabs.todas' },
  { value: 'Confirmado',  labelKey: 'recepciones.status_tabs.confirmado' },
  { value: 'Pendiente',   labelKey: 'recepciones.status_tabs.pendiente' },
  { value: 'Rechazado',   labelKey: 'recepciones.status_tabs.rechazado' },
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

// ── Hook: fetch list with filters ─────────────────────────────────────────────

function buildListQueryKey(
  page: number,
  estatus: StatusTab,
  search: string,
) {
  return ['recepciones', 'list', page, estatus, search] as const;
}

function buildListUrl(page: number, estatus: StatusTab, search: string): string {
  const params = new URLSearchParams();
  params.set('page',  String(page));
  params.set('limit', String(PAGE_SIZE));
  if (estatus) params.set('estatus', estatus);
  if (search.trim()) {
    // The server searches both company and origen by the same query param pair;
    // pass the search text to both so the server's ILIKE picks it up.
    params.set('company', search.trim());
    params.set('origen',  search.trim());
  }
  return `/api/recepciones?${params.toString()}`;
}

// ── Tab counts: fetched for all statuses in a single "all" query ──────────────

function useTabCounts(allData: RecepcionesResponse | undefined) {
  // We use the total from the main query plus separate tiny queries per tab.
  // To keep it simple and avoid N+1 fetches we derive counts from a separate
  // "count-only" query for each status tab. Counts refresh whenever the main
  // list invalidates.
  const countQuery = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'counts'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1'),
    staleTime: 1000 * 30, // 30 s
  });

  // We also want per-status counts. Fetch with limit=1 to get totals cheaply.
  const confirmadoQ = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'count', 'Confirmado'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1&estatus=Confirmado'),
    staleTime: 1000 * 30,
  });
  const pendienteQ = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'count', 'Pendiente'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1&estatus=Pendiente'),
    staleTime: 1000 * 30,
  });
  const rechazadoQ = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'count', 'Rechazado'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1&estatus=Rechazado'),
    staleTime: 1000 * 30,
  });

  // Prefer the live allData total for "Todas" so it stays in sync with search
  const totalTodas = allData?.total ?? countQuery.data?.total ?? 0;

  return {
    '':           totalTodas,
    Confirmado:   confirmadoQ.data?.total ?? 0,
    Pendiente:    pendienteQ.data?.total  ?? 0,
    Rechazado:    rechazadoQ.data?.total  ?? 0,
  } as Record<StatusTab, number>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Recepciones() {
  const { t }    = useTranslation();
  const notify   = useNotify();
  const confirm  = useConfirm();
  const qc       = useQueryClient();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<StatusTab>('');
  const [searchInput, setSearchInput]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                 = useState(1);

  // Debounce search input
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1); // reset to page 1 on new search
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // Reset to page 1 when tab changes
  const handleTabChange = useCallback((tab: StatusTab) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const listQueryKey = buildListQueryKey(page, activeTab, debouncedSearch);
  const listUrl      = buildListUrl(page, activeTab, debouncedSearch);

  const listQuery = useQuery<RecepcionesResponse>({
    queryKey: listQueryKey,
    queryFn:  () => apiFetch<RecepcionesResponse>(listUrl),
    staleTime: 1000 * 60, // 1 min
    placeholderData: (prev) => prev, // keep previous data while loading
  });

  const tabCounts = useTabCounts(activeTab === '' ? listQuery.data : undefined);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [formOpen,      setFormOpen]      = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<Recepcion | undefined>(undefined);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailTarget,  setDetailTarget]  = useState<Recepcion | undefined>(undefined);

  // ── Fetch single record for edit/detail ─────────────────────────────────────
  const [fetchingId, setFetchingId] = useState<number | null>(null);

  const fetchSingle = useCallback(async (id: number): Promise<Recepcion | null> => {
    try {
      setFetchingId(id);
      return await apiFetch<Recepcion>(`/api/recepciones/${id}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : t('common.error'), 'error');
      return null;
    } finally {
      setFetchingId(null);
    }
  }, [notify, t]);

  // ── Handlers: open modals ───────────────────────────────────────────────────
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

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidateAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['recepciones'] });
  }, [qc]);

  const createMutation = useMutation<Recepcion, Error, RecepcionFormData>({
    mutationFn: (body) =>
      apiFetch<Recepcion>('/api/recepciones', {
        method: 'POST',
        body:   JSON.stringify(body),
      }),
    onSuccess: () => {
      notify(t('common.success'), 'success');
      setFormOpen(false);
      invalidateAll();
    },
    onError: (err) => notify(err.message, 'error'),
  });

  const updateMutation = useMutation<Recepcion, Error, { id: number; data: RecepcionFormData }>({
    mutationFn: ({ id, data }) =>
      apiFetch<Recepcion>(`/api/recepciones/${id}`, {
        method: 'PUT',
        body:   JSON.stringify(data),
      }),
    onSuccess: () => {
      notify(t('common.success'), 'success');
      setFormOpen(false);
      invalidateAll();
    },
    onError: (err) => notify(err.message, 'error'),
  });

  const statusMutation = useMutation<
    Recepcion,
    Error,
    { id: number; estatus: Recepcion['estatus'] }
  >({
    mutationFn: ({ id, estatus }) =>
      apiFetch<Recepcion>(`/api/recepciones/${id}/estatus`, {
        method: 'PATCH',
        body:   JSON.stringify({ estatus }),
      }),
    onSuccess: (updated) => {
      notify(t('common.success'), 'success');
      setDetailOpen(false);
      // Update the cached record so detail re-open shows correct status
      setDetailTarget(updated);
      invalidateAll();
    },
    onError: (err) => notify(err.message, 'error'),
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) =>
      apiFetch(`/api/recepciones/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notify(t('common.success'), 'success');
      invalidateAll();
      // If we just deleted the last item on this page, go back one
      const remaining = (listQuery.data?.data.length ?? 0) - 1;
      if (remaining === 0 && page > 1) setPage((p) => p - 1);
    },
    onError: (err) => notify(err.message, 'error'),
  });

  // ── Delete handler (with confirm) ───────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    const ok = await confirm({
      title:       t('confirm.title'),
      message:     t('confirm.delete_confirm'),
      confirmText: t('common.delete'),
      cancelText:  t('common.cancel'),
    });
    if (ok) deleteMutation.mutate(id);
  }, [confirm, deleteMutation, t]);

  // ── Form submit ──────────────────────────────────────────────────────────────
  const handleFormSubmit = useCallback((formData: RecepcionFormData) => {
    if (isEditing && editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }, [isEditing, editTarget, createMutation, updateMutation]);

  // ── Status change from detail modal ─────────────────────────────────────────
  const handleStatusChange = useCallback((newStatus: Recepcion['estatus']) => {
    if (!detailTarget) return;
    statusMutation.mutate({ id: detailTarget.id, estatus: newStatus });
  }, [detailTarget, statusMutation]);

  // ── Derived display values ───────────────────────────────────────────────────
  const rows    = listQuery.data?.data    ?? [];
  const total   = listQuery.data?.total   ?? 0;
  const isLoading = listQuery.isLoading || fetchingId !== null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('recepciones.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('nav.recepciones')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + {t('recepciones.add')}
        </button>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const count    = tabCounts[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {t(tab.labelKey)}
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600',
                ].join(' ')}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search bar ── */}
      <div className="relative max-w-sm">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">
          &#128269;
        </span>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('recepciones.search_placeholder')}
          className="block w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={t('recepciones.search_placeholder')}
        />
      </div>

      {/* ── Error banner ── */}
      {listQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('common.error')}: {listQuery.error instanceof Error ? listQuery.error.message : ''}
        </div>
      )}

      {/* ── Table ── */}
      <RecepcionTable
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

      {/* ── Create / Edit form modal ── */}
      <RecepcionForm
        isOpen={formOpen}
        isEditing={isEditing}
        data={editTarget}
        onSubmit={handleFormSubmit}
        onCancel={() => setFormOpen(false)}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {/* ── Detail modal ── */}
      {detailOpen && detailTarget && (
        <RecepcionDetailModal
          isOpen={detailOpen}
          data={detailTarget}
          onClose={() => setDetailOpen(false)}
          onStatusChange={handleStatusChange}
          isUpdatingStatus={statusMutation.isPending}
        />
      )}
    </div>
  );
}
