/**
 * ConfirmContext — Global promise-based confirmation dialog system
 *
 * Wraps the app; any component can call useConfirm() to open a modal dialog
 * and await the user's decision.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Eliminar registro',
 *     message: '¿Estás seguro de que deseas eliminar?',
 *     confirmText: 'Eliminar',
 *     cancelText: 'Cancelar',
 *   });
 *   if (ok) { ... }
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Confirm from '../components/Confirm';
import type { ConfirmConfig } from '../types';

// ── Context shape ─────────────────────────────────────────────────────────────

type ConfirmFn = (config: ConfirmConfig) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// ── Internal dialog state ─────────────────────────────────────────────────────

interface DialogState {
  isOpen: boolean;
  config: ConfirmConfig;
}

const DEFAULT_CONFIG: ConfirmConfig = {
  title: 'Confirmar',
  message: '',
};

// ── Provider ──────────────────────────────────────────────────────────────────

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    config: DEFAULT_CONFIG,
  });

  // Holds the resolve function of the pending Promise so onConfirm / onCancel
  // can fulfil it from inside the component tree.
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((config) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialog({ isOpen: true, config });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setDialog((d) => ({ ...d, isOpen: false }));
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setDialog((d) => ({ ...d, isOpen: false }));
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Confirm
        isOpen={dialog.isOpen}
        title={dialog.config.title}
        message={dialog.config.message}
        confirmText={dialog.config.confirmText}
        cancelText={dialog.config.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useConfirm — returns an async function that opens the confirm dialog.
 * Must be called inside a <ConfirmProvider>.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (ctx === null) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return ctx;
}
