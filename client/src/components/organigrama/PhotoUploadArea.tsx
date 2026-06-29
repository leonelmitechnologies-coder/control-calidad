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
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        {t('organigrama.form.foto')}
      </p>

      {hasImage ? (
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
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
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('organigrama.foto_cambiar')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemove}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('organigrama.foto_quitar')}
            </button>
          </div>
        </div>
      ) : (
        /* Upload zone */
        <div
          className={[
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8',
            disabled ? 'cursor-not-allowed opacity-50 border-gray-200' : 'border-gray-300 bg-gray-50 hover:border-blue-400 cursor-pointer',
          ].join(' ')}
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
          aria-label={t('organigrama.form.foto')}
        >
          {/* Camera icon */}
          <svg
            className="mb-2 h-8 w-8 text-gray-400"
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
          <p className="text-sm text-gray-500">{t('organigrama.foto_subir')}</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP</p>
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
