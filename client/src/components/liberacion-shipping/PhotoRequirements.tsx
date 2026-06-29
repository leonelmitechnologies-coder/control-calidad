/**
 * PhotoRequirements
 *
 * 5 separate upload areas with labels, previews, and strict validation.
 *
 * Business rules:
 *  - EXACTLY 5 photos required — one per labeled slot
 *  - Each slot is independent: upload to its own endpoint
 *  - Progress badge shows "X / 5"
 *  - Submit blocked until all 5 are provided
 *  - In edit mode: existing URLs shown as previews; new file replaces existing
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config/api';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PHOTO_SLOTS = [
  { key: 'contenedor_vacio',   labelKey: 'liberacion_shipping.form.foto_contenedor_vacio'   },
  { key: 'contenedor_cargado', labelKey: 'liberacion_shipping.form.foto_contenedor_cargado' },
  { key: 'caja_sellada',       labelKey: 'liberacion_shipping.form.foto_caja_sellada'       },
  { key: 'placas',             labelKey: 'liberacion_shipping.form.foto_placas'             },
  { key: 'manifiesto',         labelKey: 'liberacion_shipping.form.foto_manifiesto'         },
] as const;

export type PhotoSlotKey = (typeof PHOTO_SLOTS)[number]['key'];

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * PhotoSlotState holds either:
 *   - existingUrl: string — URL of a photo already stored server-side
 *   - newFile: File       — file the user just selected (not yet uploaded)
 * Both can be null/undefined (slot empty).
 */
export interface PhotoSlotState {
  existingUrl?: string;
  newFile?: File;
}

export type PhotosState = Record<PhotoSlotKey, PhotoSlotState>;

interface PhotoRequirementsProps {
  photos: PhotosState;
  onChange: (key: PhotoSlotKey, state: PhotoSlotState) => void;
  showError?: boolean;
  disabled?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function countPhotos(photos: PhotosState): number {
  return PHOTO_SLOTS.filter(({ key }) => {
    const s = photos[key];
    return !!(s?.existingUrl || s?.newFile);
  }).length;
}

export function buildInitialPhotos(fotos?: {
  contenedor_vacio?: string;
  contenedor_cargado?: string;
  caja_sellada?: string;
  placas?: string;
  manifiesto?: string;
}): PhotosState {
  const makeUrl = (filename?: string) =>
    filename ? `${API_BASE_URL}/uploads/shipping/${filename}` : undefined;

  return {
    contenedor_vacio:   { existingUrl: makeUrl(fotos?.contenedor_vacio) },
    contenedor_cargado: { existingUrl: makeUrl(fotos?.contenedor_cargado) },
    caja_sellada:       { existingUrl: makeUrl(fotos?.caja_sellada) },
    placas:             { existingUrl: makeUrl(fotos?.placas) },
    manifiesto:         { existingUrl: makeUrl(fotos?.manifiesto) },
  };
}

export function emptyPhotos(): PhotosState {
  return {
    contenedor_vacio:   {},
    contenedor_cargado: {},
    caja_sellada:       {},
    placas:             {},
    manifiesto:         {},
  };
}

// ── Single slot component ─────────────────────────────────────────────────────

interface SlotProps {
  slotKey: PhotoSlotKey;
  label: string;
  index: number;
  state: PhotoSlotState;
  onChange: (state: PhotoSlotState) => void;
  disabled?: boolean;
}

function PhotoSlot({ slotKey, label, index, state, onChange, disabled }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!(state.existingUrl || state.newFile);
  const previewSrc = state.newFile
    ? URL.createObjectURL(state.newFile)
    : state.existingUrl;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME type
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen.');
      return;
    }

    onChange({ ...state, newFile: file });
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleRemove() {
    onChange({});
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Label + index */}
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
            hasPhoto ? 'bg-green-500 text-white' : 'bg-gray-300 text-white',
          ].join(' ')}
        >
          {index + 1}
        </span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hasPhoto && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Listo
          </span>
        )}
      </div>

      {/* Upload area / Preview */}
      {hasPhoto && previewSrc ? (
        <div className="relative">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            <img
              src={previewSrc}
              alt={label}
              className="h-full w-full object-cover"
            />
          </div>
          {/* Replace / Remove buttons */}
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cambiar foto
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemove}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-colors',
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer',
          ].join(' ')}
          aria-label={`Subir ${label}`}
        >
          <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs text-gray-500">Haz clic para seleccionar imagen</span>
          <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={`ls-photo-${slotKey}`}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PhotoRequirements({
  photos,
  onChange,
  showError = false,
  disabled = false,
}: PhotoRequirementsProps) {
  const { t } = useTranslation();
  const count = countPhotos(photos);
  const isComplete = count === 5;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-full bg-gray-200 h-2 overflow-hidden">
          <div
            className={[
              'h-2 rounded-full transition-all duration-300',
              isComplete ? 'bg-green-500' : count > 0 ? 'bg-blue-500' : 'bg-gray-300',
            ].join(' ')}
            style={{ width: `${(count / 5) * 100}%` }}
          />
        </div>
        <span
          className={[
            'text-sm font-semibold tabular-nums',
            isComplete ? 'text-green-600' : 'text-gray-700',
          ].join(' ')}
        >
          {count} / 5
        </span>
      </div>

      {/* Error message */}
      {showError && !isComplete && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('liberacion_shipping.form.fotos_requeridas')}
        </div>
      )}

      {/* Photo slots grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PHOTO_SLOTS.map(({ key, labelKey }, index) => (
          <PhotoSlot
            key={key}
            slotKey={key}
            label={t(labelKey)}
            index={index}
            state={photos[key]}
            onChange={(state) => onChange(key, state)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Completion indicator */}
      {isComplete && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 flex items-center gap-2">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Las 5 fotos requeridas están cargadas. El formulario está listo para enviar.
        </div>
      )}
    </div>
  );
}
