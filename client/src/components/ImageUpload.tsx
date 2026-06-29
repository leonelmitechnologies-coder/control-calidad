/**
 * ImageUpload
 * File input with preview grid, drag-and-drop support, file validation,
 * and per-item deletion.
 *
 * This component is uncontrolled with respect to upload — it only manages
 * local File state. The parent receives the current file list via onFilesSelect
 * whenever it changes (add or delete).
 */

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatFileSize } from '../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageUploadProps {
  onFilesSelect: (files: File[]) => void;
  maxFiles?: number;
  /** Per-file size limit in bytes (default: 10 MB) */
  maxSize?: number;
  preview?: boolean;
  disabled?: boolean;
  label?: string;
}

interface PreviewFile {
  file: File;
  objectUrl: string;
}

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_SIZE  = 10 * 1024 * 1024; // 10 MB

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImageUpload({
  onFilesSelect,
  maxFiles   = DEFAULT_MAX_FILES,
  maxSize    = DEFAULT_MAX_SIZE,
  preview    = true,
  disabled   = false,
  label,
}: ImageUploadProps) {
  const { t } = useTranslation();

  const [previews, setPreviews]   = useState<PreviewFile[]>([]);
  const [errors, setErrors]       = useState<string[]>([]);
  const [dragging, setDragging]   = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── File processing ───────────────────────────────────────────────────────

  const processFiles = useCallback(
    (incoming: FileList | File[]) => {
      const newErrors: string[] = [];
      const accepted: File[]   = [];

      Array.from(incoming).forEach((file) => {
        if (!file.type.startsWith('image/')) {
          newErrors.push(`"${file.name}" no es una imagen válida.`);
          return;
        }
        if (file.size > maxSize) {
          newErrors.push(
            `"${file.name}" supera el límite de ${formatFileSize(maxSize)}.`,
          );
          return;
        }
        accepted.push(file);
      });

      setPreviews((prev) => {
        const available = maxFiles - prev.length;
        if (available <= 0) return prev;

        const toAdd = accepted.slice(0, available);
        if (toAdd.length < accepted.length) {
          newErrors.push(
            t('upload.max_files', { count: maxFiles }),
          );
        }

        const newPreviews = toAdd.map((file) => ({
          file,
          objectUrl: URL.createObjectURL(file),
        }));

        const updated = [...prev, ...newPreviews];
        // Notify parent on next tick so state is flushed
        setTimeout(() => onFilesSelect(updated.map((p) => p.file)), 0);
        return updated;
      });

      setErrors(newErrors);
    },
    [maxFiles, maxSize, onFilesSelect, t],
  );

  // ── Input change ──────────────────────────────────────────────────────────

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input so re-selecting the same file triggers onChange again
      e.target.value = '';
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = (idx: number) => {
    setPreviews((prev) => {
      const item = prev[idx];
      if (item) URL.revokeObjectURL(item.objectUrl);
      const updated = prev.filter((_, i) => i !== idx);
      onFilesSelect(updated.map((p) => p.file));
      return updated;
    });
    setErrors([]);
  };

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const atMax   = previews.length >= maxFiles;
  const canAdd  = !disabled && !atMax;

  return (
    <div className="w-full space-y-3">
      {/* Label */}
      {label && (
        <p className="text-sm font-medium text-gray-700">{label}</p>
      )}

      {/* Drop zone + button */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors',
          dragging  ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50',
          disabled  ? 'opacity-50 cursor-not-allowed' : 'cursor-default',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={!canAdd}
          onChange={handleInputChange}
          className="hidden"
          aria-label={t('upload.select_photos')}
        />

        {/* Icon */}
        <svg
          className="mx-auto mb-2 h-8 w-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>

        {/* File count */}
        <p className="mb-2 text-sm text-gray-500">
          {previews.length} / {maxFiles}
          {atMax && (
            <span className="ml-2 text-amber-600 font-medium">
              {t('upload.max_files', { count: maxFiles })}
            </span>
          )}
        </p>

        {/* Drag hint */}
        <p className="mb-3 text-xs text-gray-400">{t('upload.drag_drop')}</p>

        {/* Select button */}
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => inputRef.current?.click()}
          className={[
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
            'border border-gray-300 bg-white shadow-sm transition-colors',
            canAdd
              ? 'text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
              : 'cursor-not-allowed text-gray-400',
          ].join(' ')}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('upload.select_photos')}
        </button>
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-red-600">
              {err}
            </li>
          ))}
        </ul>
      )}

      {/* Preview grid */}
      {preview && previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {previews.map((p, idx) => (
            <div key={idx} className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100">
              <img
                src={p.objectUrl}
                alt={p.file.name}
                className="h-full w-full object-cover"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 transition-colors group-hover:bg-black/40">
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  disabled={disabled}
                  title={t('upload.delete')}
                  aria-label={t('upload.delete')}
                  className={[
                    'rounded-full bg-white/90 p-1 opacity-0 shadow transition-opacity',
                    'group-hover:opacity-100',
                    disabled ? 'cursor-not-allowed' : 'hover:bg-red-50',
                  ].join(' ')}
                >
                  <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* File size badge */}
              <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1 py-0.5 text-xs text-white">
                {formatFileSize(p.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
