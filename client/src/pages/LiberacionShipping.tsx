/**
 * LiberacionShipping Page
 *
 * Shipping Release management with:
 *  - Status filter tabs (Todas / Programado / En Tránsito / Entregado / Cancelado)
 *  - Search by Order ID or Destination (500ms debounce)
 *  - Paginated table (20 per page) via LsTable
 *  - Create / Edit modal via LsForm
 *  - Detail modal via LsDetailModal
 *  - Delete with confirm dialog
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiberacionShipping, LsListResponse } from '../types';
import { API_BASE_URL } from '../config/api';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import LsTable from '../components/liberacion-shipping/LsTable';
import LsForm from '../components/liberacion-shipping/LsForm';
import LsDetailModal from '../components/liberacion-shipping/LsDetailModal';

// ── Constants ─────────────────────────────────────────────────────────────────

type EstatusTab = 'Todas' | 'Programado' | 'En Tránsito' | 'Entregado' | 'Cancelado';

const STATUS_TABS: EstatusTab[] = ['Todas', 'Programado', 'En Tránsito', 'Entregado', 'Cancelado'];

const PAGE_SIZE = 20;

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchList(
  page: number,
  search: string,
  estatus: string,
): Promise<LsListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  if (search.trim()) params.set('q', search.trim());
  if (estatus !== 'Todas') params.set('estatus', estatus);

  const res = await fetch(`${API_BASE_URL}/api/liberacion-shipping?${params}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) {
    window.location.href = '/login';
    return new Promise(() => undefined);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchSingle(id: number): Promise<LiberacionShipping> {
  const res = await fetch(`${API_BASE_URL}/api/liberacion-shipping/${id}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // Normalise fotos if server didn't include it
  if (json && !json.fotos) {
    json.fotos = {
      contenedor_vacio:   json.foto_contenedor_vacio   || '',
      contenedor_cargado: json.foto_contenedor_cargado || '',
      caja_sellada:       json.foto_caja_sellada       || '',
      placas:             json.foto_placas             || '',
      manifiesto:         json.foto_manifiesto         || '',
    };
  }
  return json;
}

async function deleteRecord(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/liberacion-shipping/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Sub-component: Status tabs with counts ────────────────────────────────────

interface StatusTabsProps {
  active: EstatusTab;
  counts: Record<EstatusTab, number>;
  onSelect: (tab: EstatusTab) => void;
}

function StatusTabs({ active, counts, onSelect }: StatusTabsProps) {
  const { t } = useTranslation();

  const tabLabels: Record<EstatusTab, string> = {
    'Todas':      t('liberacion_shipping.status_tabs.todas'),
    'Programado': t('liberacion_shipping.status_tabs.programado'),
    'En Tránsito': t('liberacion_shipping.status_tabs.en_transito'),
    'Entregado':  t('liberacion_shipping.status_tabs.entregado'),
    'Cancelado':  t('liberacion_shipping.status_tabs.cancelado'),
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 pb-0 -mb-px">
      {STATUS_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onSelect(tab)}
          className={[
            'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            active === tab
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
          ].join(' ')}
        >
          {tabLabels[tab]}
          {counts[tab] > 0 && (
            <span
              className={[
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                active === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {counts[tab]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export default function LiberacionShipping() {
  const { t } = useTranslation();
  const notify  = useNotify();
  const confirm = useConfirm();
  const qc      = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────

  const [activeTab,    setActiveTab]    = useState<EstatusTab>('Todas');
  const [search,       setSearch]       = useState('');
  const [debouncedQ,   setDebouncedQ]   = useState('');
  const [page,         setPage]         = useState(1);

  // Modals
  const [formOpen,     setFormOpen]     = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [editData,     setEditData]     = useState<LiberacionShipping | null>(null);
  const [detailId,     setDetailId]     = useState<number | null>(null);
  const [detailOpen,   setDetailOpen]   = useState(false);

  // Current user (for the form "registrado_por" field)
  const [currentUser,  setCurrentUser]  = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch current user ─────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((u) => {
        if (u?.nombre) setCurrentUser(u.nombre);
        else if (u?.user?.nombre) setCurrentUser(u.user.nombre);
      })
      .catch(() => undefined);
  }, []);

  // ── Debounce search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(search);
      setPage(1);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset page on tab change
  useEffect(() => { setPage(1); }, [activeTab]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const listQueryKey = ['liberacion-shipping', page, debouncedQ, activeTab] as const;

  const { data: listData, isLoading, isError } = useQuery<LsListResponse>({
    queryKey: listQueryKey,
    queryFn: () => fetchList(page, debouncedQ, activeTab),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // Count queries for each tab (we fire a quick count-only request per tab)
  const { data: counts } = useQuery<Record<EstatusTab, number>>({
    queryKey: ['ls-tab-counts', debouncedQ],
    queryFn: async () => {
      const base = STATUS_TABS.map((tab) =>
        fetchList(1, debouncedQ, tab).then((r) => [tab, r.total] as [EstatusTab, number])
      );
      const entries = await Promise.all(base);
      return Object.fromEntries(entries) as Record<EstatusTab, number>;
    },
    staleTime: 60_000,
    // Only count when we have a stable query
  });

  const tabCounts: Record<EstatusTab, number> = counts ?? {
    Todas: 0, Programado: 0, 'En Tránsito': 0, Entregado: 0, Cancelado: 0,
  };

  const records = listData?.data ?? [];
  const total   = listData?.total ?? 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAdd() {
    setIsEditing(false);
    setEditData(null);
    setFormOpen(true);
  }

  async function handleEdit(id: number) {
    try {
      const rec = await fetchSingle(id);
      setEditData(rec);
      setIsEditing(true);
      setFormOpen(true);
    } catch {
      notify('Error al cargar el registro para editar.', 'error');
    }
  }

  function handleView(id: number) {
    setDetailId(id);
    setDetailOpen(true);
  }

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: 'Eliminar Liberación Shipping',
      message: t('liberacion_shipping.delete_confirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });
    if (!ok) return;

    try {
      await deleteRecord(id);
      notify(t('liberacion_shipping.deleted_ok'), 'success');
      void qc.invalidateQueries({ queryKey: ['liberacion-shipping'] });
      void qc.invalidateQueries({ queryKey: ['ls-tab-counts'] });
    } catch {
      notify('Error al eliminar el registro.', 'error');
    }
  }

  const handleFormSuccess = useCallback(() => {
    setFormOpen(false);
    setEditData(null);
    const msg = isEditing
      ? t('liberacion_shipping.updated_ok')
      : t('liberacion_shipping.saved_ok');
    notify(msg, 'success');
    void qc.invalidateQueries({ queryKey: ['liberacion-shipping'] });
    void qc.invalidateQueries({ queryKey: ['ls-tab-counts'] });
    void qc.invalidateQueries({ queryKey: ['ls-detail'] });
  }, [isEditing, notify, t, qc]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('liberacion_shipping.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Liberación de Producto para Envío
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('liberacion_shipping.add')}
        </button>
      </div>

      {/* Main card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* Status tabs (sticky) */}
        <div className="sticky top-0 z-10 bg-white rounded-t-xl px-4 pt-4">
          <StatusTabs
            active={activeTab}
            counts={tabCounts}
            onSelect={(tab) => { setActiveTab(tab); setPage(1); }}
          />
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('liberacion_shipping.search_placeholder')}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error state */}
        {isError && (
          <div className="px-4 py-6">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Error al cargar los registros. Por favor intente de nuevo.
            </div>
          </div>
        )}

        {/* Table */}
        <div className="p-4">
          <LsTable
            data={records}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Create / Edit form modal */}
      <LsForm
        isOpen={formOpen}
        isEditing={isEditing}
        data={editData}
        onSuccess={handleFormSuccess}
        onCancel={() => { setFormOpen(false); setEditData(null); }}
        currentUser={currentUser}
      />

      {/* Detail modal */}
      <LsDetailModal
        id={detailId}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
