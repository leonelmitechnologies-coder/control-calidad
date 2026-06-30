/**
 * PhotoUploadArea
 *
 * Single-photo upload with preview thumbnail and "Quitar Foto" button.
 * The existing photo URL is shown when editing.
 * Selecting a new file replaces the preview.
 */

import { useRef, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PhotoUploadAreaProps {
  /** Current photo URL (existing record) — shown as initial preview */
  currentPhotoUrl?: string | null;
  /** Called when a new file is picked (null = remove) */
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhotoUploadArea({
  currentPhotoUrl,
  onFileChange,
  disabled = false,
}: PhotoUploadAreaProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // `preview` is the object URL of the locally selected file, or null
  const [preview, setPreview] = useState<string | null>(null);
  // `removed` tracks if the user explicitly removed the existing photo
  const [removed, setRemoved] = useState(false);

  // Displayed image: local preview > existing URL (unless removed)
  const displayUrl = preview ?? (removed ? null : currentPhotoUrl ?? null);
  const hasImage   = Boolean(displayUrl);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    // Revoke old object URL
    if (preview) URL.revokeObjectURL(preview);

    const url = URL.createObjectURL(file);
    setPreview(url);
    setRemoved(false);
    onFileChange(file);
    // Reset so re-selecting the same file triggers onChange
    e.target.value = '';
  };

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setRemoved(true);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0 }}>{t('organigrama.form.foto')}</p>

      {hasImage ? (
        <div className="flex items-start gap-4">
          {/* Preview — circular portrait */}
          <div
            style={{
              height: 96,
              width: 96,
              flexShrink: 0,
              overflow: 'hidden',
              borderRadius: '50%',
              border: '2px solid #e2e2e2',
              background: '#f4f6f9',
            }}
          >
            <img
              src={displayUrl!}
              alt="Foto de perfil"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="btn btn-secundario"
              style={disabled ? { cursor: 'not-allowed', opacity: 0.5 } : undefined}
            >
              {t('organigrama.foto_cambiar')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemove}
              className="btn btn-peligro"
              style={disabled ? { cursor: 'not-allowed', opacity: 0.5 } : undefined}
            >
              {t('organigrama.foto_quitar')}
            </button>
          </div>
        </div>
      ) : (
        /* Upload zone */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #e2e2e2',
            background: '#f4f6f9',
            padding: '32px 16px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
          aria-label={t('organigrama.form.foto')}
        >
          {/* Camera icon */}
          <svg
            style={{ marginBottom: 8, height: 32, width: 32, color: '#aaa' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>{t('organigrama.foto_subir')}</p>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 4, marginBottom: 0 }}>JPG, PNG, WEBP</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={disabled}
        className="hidden"
        onChange={handleInput}
        aria-label={t('organigrama.form.foto')}
      />
    </div>
  );
}
