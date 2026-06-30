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

import { useCallback, useRef, useState } from 'react';
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

// Status tabs (value matches the server filter; empty string = Todos)
type StatusTab = '' | 'Confirmado' | 'En descarga' | 'Descargado' | 'Rechazado';

interface TabDef {
  value: StatusTab;
  label: string;
}

const STATUS_TABS: TabDef[] = [
  { value: '',             label: 'Todos' },
  { value: 'Confirmado',   label: 'Confirmado' },
  { value: 'En descarga',  label: 'En descarga' },
  { value: 'Descargado',   label: 'Descargado' },
  { value: 'Rechazado',    label: 'Rechazado' },
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
  const enDescargaQ = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'count', 'En descarga'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1&estatus=En+descarga'),
    staleTime: 1000 * 30,
  });
  const descargadoQ = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'count', 'Descargado'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1&estatus=Descargado'),
    staleTime: 1000 * 30,
  });
  const rechazadoQ = useQuery<RecepcionesResponse>({
    queryKey: ['recepciones', 'count', 'Rechazado'],
    queryFn: () =>
      apiFetch<RecepcionesResponse>('/api/recepciones?page=1&limit=1&estatus=Rechazado'),
    staleTime: 1000 * 30,
  });

  // Prefer the live allData total for "Todos" so it stays in sync with search
  const totalTodos = allData?.total ?? countQuery.data?.total ?? 0;

  return {
    '':            totalTodos,
    Confirmado:    confirmadoQ.data?.total  ?? 0,
    'En descarga': enDescargaQ.data?.total  ?? 0,
    Descargado:    descargadoQ.data?.total  ?? 0,
    Rechazado:     rechazadoQ.data?.total   ?? 0,
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111111', marginBottom: 2 }}>{t('recepciones.title')}</h1>
          <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
            {t('nav.recepciones')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="btn btn-primario"
        >
          + {t('recepciones.add')}
        </button>
      </div>

      {/* ── Status filter tabs ── */}
      <div style={{ borderBottom: '2px solid #e2e2e2', display: 'flex', gap: 0 }}>
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const count    = tabCounts[tab.value];
          return (
            <button
              key={tab.value || 'todos'}
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
              {tab.label}
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

      {/* ── Search bar ── */}
      <div className="filtros">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none', fontSize: 14 }}>
            &#128269;
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('recepciones.search_placeholder')}
            aria-label={t('recepciones.search_placeholder')}
            style={{ paddingLeft: 30 }}
          />
        </div>
      </div>

      {/* ── Error banner ── */}
      {listQuery.isError && (
        <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>
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
