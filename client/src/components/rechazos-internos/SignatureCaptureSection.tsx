/**
 * SignatureCaptureSection
 *
 * Wraps SignatureCanvas with:
 *   - Section header
 *   - Mandatory warning when form tries to submit without signature
 *   - Preview of the drawn signature below canvas
 *   - "Limpiar Firma" handled by the inner SignatureCanvas clear button
 *
 * Props:
 *   signature      - current base64 PNG data URL (empty string = not signed)
 *   onSignature    - called whenever signature changes (clears → '', draws → dataUrl)
 *   showError      - show red error banner when true (form submitted without sig)
 *   disabled       - pass-through to canvas (e.g. detail view)
 */

import { useTranslation } from 'react-i18next';
import SignatureCanvas from '../SignatureCanvas';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SignatureCaptureSectionProps {
  signature: string;
  onSignature: (dataUrl: string) => void;
  showError?: boolean;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignatureCaptureSection({
  signature,
  onSignature,
  showError = false,
  disabled  = false,
}: SignatureCaptureSectionProps) {
  const { t } = useTranslation();

  const isSigned = signature.length > 0;

  return (
    <div className="space-y-4">

      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('rechazos_internos.form.firma_digital')}
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Mandatory label */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {t('rechazos_internos.form.firma_requerida')}
        </span>
        {isSigned && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Firma capturada
          </span>
        )}
      </div>

      {/* Error banner */}
      {showError && !isSigned && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <svg className="h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {t('rechazos_internos.form.firma_requerida')} — Dibuje su firma para continuar.
        </div>
      )}

      {/* Canvas */}
      {!disabled && (
        <SignatureCanvas
          onSignatureChange={onSignature}
          width={400}
          height={200}
          disabled={disabled}
        />
      )}

      {/* Preview — shown when signed (in both form and disabled/detail mode) */}
      {isSigned && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Vista previa:</p>
          <div className="inline-block overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <img
              src={signature}
              alt="Vista previa de firma"
              className="block max-w-full"
              style={{ maxHeight: '120px' }}
            />
          </div>
        </div>
      )}

      {/* Disabled read-only state: only show preview */}
      {disabled && !isSigned && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <p className="text-sm text-gray-400 italic">Sin firma digital registrada</p>
        </div>
      )}

    </div>
  );
}
