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
    <div>

      {/* Status indicators */}
      <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#fdecea',
          border: '1px solid #f5c6cb',
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: '#c0392b',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {t('rechazos_internos.form.firma_requerida')}
        </span>
        {isSigned && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#e8f5e9',
            border: '1px solid #a5d6a7',
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: '#2e7d32',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Firma capturada
          </span>
        )}
      </div>

      {/* Error banner */}
      {showError && !isSigned && (
        <div
          role="alert"
          style={{
            background: '#fdecea',
            border: '1px solid #f5c6cb',
            padding: '10px 14px',
            fontSize: 13,
            color: '#c0392b',
            marginBottom: 10,
          }}
        >
          {t('rechazos_internos.form.firma_requerida')} — Dibuje su firma para continuar.
        </div>
      )}

      {/* Canvas */}
      {!disabled && (
        <div style={{ border: '1px solid #e2e2e2' }}>
          <SignatureCanvas
            onSignatureChange={onSignature}
            width={400}
            height={200}
            disabled={disabled}
          />
        </div>
      )}

      {/* Preview — shown when signed (in both form and disabled/detail mode) */}
      {isSigned && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase', marginBottom: 6 }}>Vista previa:</p>
          <div style={{ display: 'inline-block', border: '1px solid #e2e2e2', background: '#fff' }}>
            <img
              src={signature}
              alt="Vista previa de firma"
              style={{ display: 'block', maxWidth: '100%', maxHeight: 120 }}
            />
          </div>
        </div>
      )}

      {/* Disabled read-only state: only show placeholder */}
      {disabled && !isSigned && (
        <div style={{ border: '1px solid #e2e2e2', background: '#f4f6f9', padding: '24px 14px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic', margin: 0 }}>Sin firma digital registrada</p>
        </div>
      )}

    </div>
  );
}
