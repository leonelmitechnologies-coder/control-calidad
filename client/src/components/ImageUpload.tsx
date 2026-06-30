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
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Label */}
      {label && <p>{label}</p>}

      {/* Drop zone + button */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#0d2b4e' : '#e2e2e2'}`,
          background: dragging ? '#edf2f7' : '#f4f6f9',
          padding: '20px 16px',
          textAlign: 'center',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'default',
        }}
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
          style={{ display: 'block', margin: '0 auto 8px', height: 32, width: 32, color: '#aaa' }}
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
        <p style={{ marginBottom: 8, fontSize: 13, color: '#555' }}>
          {previews.length} / {maxFiles}
          {atMax && (
            <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 600 }}>
              {t('upload.max_files', { count: maxFiles })}
            </span>
          )}
        </p>

        {/* Drag hint */}
        <p style={{ marginBottom: 12, fontSize: 11, color: '#aaa' }}>{t('upload.drag_drop')}</p>

        {/* Select button */}
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => inputRef.current?.click()}
          className="btn btn-secundario"
          style={!canAdd ? { cursor: 'not-allowed', opacity: 0.5 } : undefined}
        >
          <svg style={{ height: 14, width: 14, display: 'inline', marginRight: 6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('upload.select_photos')}
        </button>
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {errors.map((err, i) => (
            <li key={i} className="form-error">
              {err}
            </li>
          ))}
        </ul>
      )}

      {/* Preview grid */}
      {preview && previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {previews.map((p, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden"
              style={{
                aspectRatio: '1 / 1',
                border: '1px solid #e2e2e2',
                background: '#f4f6f9',
              }}
            >
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
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    padding: 4,
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg style={{ height: 14, width: 14, color: '#c0392b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* File size badge */}
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  fontSize: 10,
                  padding: '1px 4px',
                }}
              >
                {formatFileSize(p.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
