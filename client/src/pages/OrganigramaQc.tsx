/**
 * OrganigramaQc Page
 *
 * Card-based display of QC team members grouped by position.
 * Position display order: Jefe QC → Supervisor QC → Inspector → Otro
 *
 * Features:
 *   - Search by Nombre / Puesto (debounced 500ms)
 *   - Filter by Puesto dropdown + Estatus radio
 *   - Create / Edit employee via OrgForm modal
 *   - Detail modal (read-only)
 *   - Toggle estatus (PATCH)
 *   - Delete with confirmation
 *   - Photo upload after save
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';
import type { OrganigramaQc as OrgEmp } from '../types';

import FilterBar, { type PuestoFilter, type EstatusFilter } from '../components/organigrama/FilterBar';
import PositionGroup, { type CardActionHandlers } from '../components/organigrama/PositionGroup';
import OrgForm, { type OrgFormValues } from '../components/organigrama/OrgForm';
import OrgDetailModal from '../components/organigrama/OrgDetailModal';

// ── Position display order ────────────────────────────────────────────────────

const POSITION_ORDER = ['Jefe QC', 'Supervisor QC', 'Inspector', 'Otro'] as const;

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

async function uploadPhoto(id: number, file: File): Promise<void> {
  const form = new FormData();
  form.append('foto', file);
  const res = await fetch(`${API_BASE_URL}/api/organigrama-qc/${id}/foto`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error(`Error al subir foto: HTTP ${res.status}`);
}

// ── Client-side filtering helpers ─────────────────────────────────────────────

function filterEmployees(
  employees: OrgEmp[],
  search:  string,
  puesto:  PuestoFilter,
  estatus: EstatusFilter,
): OrgEmp[] {
  let list = employees;

  if (search) {
    const lower = search.toLowerCase();
    list = list.filter(
      (e) =>
        e.nombre_completo.toLowerCase().includes(lower) ||
        e.puesto.toLowerCase().includes(lower),
    );
  }

  if (puesto) {
    list = list.filter((e) => e.puesto === puesto);
  }

  if (estatus !== 'todos') {
    list = list.filter((e) => e.estatus === estatus);
  }

  return list;
}

function groupByPosition(employees: OrgEmp[]): Map<string, OrgEmp[]> {
  const map = new Map<string, OrgEmp[]>();
  for (const pos of POSITION_ORDER) {
    map.set(pos, []);
  }
  for (const emp of employees) {
    const key = POSITION_ORDER.includes(emp.puesto as typeof POSITION_ORDER[number])
      ? emp.puesto
      : 'Otro';
    const bucket = map.get(key);
    if (bucket) bucket.push(emp);
    else map.set('Otro', [emp]);
  }
  return map;
}

// ── Modal state ───────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit';   employee: OrgEmp }
  | { type: 'detail'; employee: OrgEmp };

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrganigramaQc() {
  const { t }   = useTranslation();
  const notify  = useNotify();
  const confirm = useConfirm();
  const qc      = useQueryClient();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,  setSearch]  = useState('');
  const [puesto,  setPuesto]  = useState<PuestoFilter>('');
  const [estatus, setEstatus] = useState<EstatusFilter>('todos');

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  // ── Data ────────────────────────────────────────────────────────────────────
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
  } = useQuery<OrgEmp[]>({
    queryKey: ['organigrama-qc'],
    queryFn: () => apiFetch<OrgEmp[]>(`${API_BASE_URL}/api/organigrama-qc`),
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: OrgFormValues) =>
      apiFetch<OrgEmp>(`${API_BASE_URL}/api/organigrama-qc`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }),
    onSuccess: async (created, _, photoFile) => {
      // photoFile is passed via context — we use the imperative call below
      await qc.invalidateQueries({ queryKey: ['organigrama-qc'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: OrgFormValues }) =>
      apiFetch<OrgEmp>(`${API_BASE_URL}/api/organigrama-qc/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organigrama-qc'] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ estatus: string }>(`${API_BASE_URL}/api/organigrama-qc/${id}/estatus`, {
        method: 'PATCH',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organigrama-qc'] });
      notify(t('organigrama.estatus_actualizado'), 'success');
    },
    onError: (err: Error) => {
      notify(`${t('common.error')}: ${err.message}`, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`${API_BASE_URL}/api/organigrama-qc/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organigrama-qc'] });
      notify(t('organigrama.eliminado'), 'success');
    },
    onError: (err: Error) => {
      notify(`${t('common.error')}: ${err.message}`, 'error');
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFormSubmit = useCallback(
    async (values: OrgFormValues, photoFile: File | null) => {
      try {
        if (modal.type === 'create') {
          const created = await createMutation.mutateAsync(values);
          if (photoFile) {
            try { await uploadPhoto(created.id, photoFile); } catch { /* photo upload failure is non-fatal */ }
          }
          await qc.invalidateQueries({ queryKey: ['organigrama-qc'] });
          notify(t('organigrama.creado'), 'success');
          setModal({ type: 'none' });
        } else if (modal.type === 'edit') {
          await updateMutation.mutateAsync({ id: modal.employee.id, body: values });
          if (photoFile) {
            try { await uploadPhoto(modal.employee.id, photoFile); } catch { /* non-fatal */ }
          }
          await qc.invalidateQueries({ queryKey: ['organigrama-qc'] });
          notify(t('organigrama.actualizado'), 'success');
          setModal({ type: 'none' });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        notify(`${t('common.error')}: ${msg}`, 'error');
      }
    },
    [modal, createMutation, updateMutation, qc, notify, t],
  );

  const handleDelete = useCallback(
    async (emp: OrgEmp) => {
      const ok = await confirm({
        title:       t('confirm.title'),
        message:     `${t('organigrama.delete_confirm')} "${emp.nombre_completo}"?`,
        confirmText: t('common.delete'),
        cancelText:  t('common.cancel'),
      });
      if (!ok) return;
      setModal({ type: 'none' });
      deleteMutation.mutate(emp.id);
    },
    [confirm, deleteMutation, t],
  );

  const handleStatusChange = useCallback(
    (emp: OrgEmp) => {
      toggleStatusMutation.mutate(emp.id);
    },
    [toggleStatusMutation],
  );

  const cardHandlers: CardActionHandlers = {
    onEdit:         (emp) => setModal({ type: 'edit', employee: emp }),
    onDelete:       (emp) => handleDelete(emp),
    onStatusChange: (emp) => handleStatusChange(emp),
    onView:         (emp) => setModal({ type: 'detail', employee: emp }),
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filtered = filterEmployees(employees, search, puesto, estatus);
  const grouped  = groupByPosition(filtered);
  const hasResults = filtered.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('organigrama.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('organigrama.subtitle')} &mdash;{' '}
            <span className="font-medium text-gray-700">
              {employees.filter((e) => e.estatus === 'activo').length}
            </span>{' '}
            {t('organigrama.activos_label')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: 'create' })}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('organigrama.add')}
        </button>
      </div>

      {/* Filters */}
      <FilterBar
        onSearchChange={setSearch}
        onPuestoChange={setPuesto}
        onEstatusChange={setEstatus}
        puesto={puesto}
        estatus={estatus}
      />

      {/* Content area */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" aria-label={t('common.loading')} />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('common.error')}: {(error as Error)?.message ?? 'Error desconocido'}
        </div>
      )}

      {!isLoading && !isError && !hasResults && (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          {t('organigrama.sin_resultados')}
        </div>
      )}

      {!isLoading && !isError && hasResults && (
        <div className="space-y-8">
          {POSITION_ORDER.map((pos) => {
            const group = grouped.get(pos) ?? [];
            return (
              <PositionGroup
                key={pos}
                position={pos}
                employees={group}
                handlers={cardHandlers}
              />
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal.type === 'create' || modal.type === 'edit') && (
        <OrgForm
          employee={modal.type === 'edit' ? modal.employee : null}
          isSubmitting={isSubmitting}
          onSubmit={handleFormSubmit}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}

      {/* Detail modal */}
      {modal.type === 'detail' && (
        <OrgDetailModal
          employee={modal.employee}
          onClose={() => setModal({ type: 'none' })}
          onEdit={() => setModal({ type: 'edit', employee: modal.employee })}
          onDelete={() => handleDelete(modal.employee)}
          onStatusChange={() => {
            handleStatusChange(modal.employee);
            setModal({ type: 'none' });
          }}
        />
      )}
    </div>
  );
}
