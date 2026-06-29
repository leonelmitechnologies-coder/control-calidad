/**
 * PhotoGallery
 * Thumbnail grid + lightbox carousel for viewing RE (Rechazos Externos) images.
 *
 * Features:
 *   - Responsive 2/3/4-column thumbnail grid
 *   - Click thumbnail → opens full-screen lightbox
 *   - Lightbox carousel: Previous / Next navigation, keyboard ArrowLeft/ArrowRight/Escape
 *   - Shows filename caption below each lightbox image
 *   - Touch swipe support (touchstart / touchend delta)
 *   - Optional onDelete callback for removing photos (shown only when provided)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config/api';
import type { RechazosExternoImage } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PhotoGalleryProps {
  images: RechazosExternoImage[];
  /** If provided, shows a delete button on each thumbnail */
  onDelete?: (imageId: number) => void;
  isDeleting?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function imageUrl(img: RechazosExternoImage): string {
  if (img.url) return img.url;
  // RE images are stored in /public/uploads/rechazos/ on the server
  return `${API_BASE_URL}/uploads/rechazos/${img.filename}`;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps {
  images: RechazosExternoImage[];
  startIndex: number;
  onClose: () => void;
}

function Lightbox({ images, startIndex, onClose }: LightboxProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [prev, next, onClose]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 50)  prev();
    if (delta < -50) next();
    touchStartX.current = null;
  };

  const img = images[current];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('rechazos_externos.gallery.lightbox')}
      className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label={t('common.close')}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
        {current + 1} / {images.length}
      </div>

      {/* Prev button */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={t('rechazos_externos.gallery.prev')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-h-[80vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl(img)}
          alt={img.filename}
          className="max-h-[75vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={t('rechazos_externos.gallery.next')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Caption */}
      <p className="mt-3 max-w-xs truncate text-center text-xs text-gray-300">
        {img.filename}
      </p>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="mt-2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={[
                'h-2 w-2 rounded-full transition-colors focus:outline-none',
                i === current ? 'bg-white' : 'bg-white/40 hover:bg-white/60',
              ].join(' ')}
              aria-label={`${t('rechazos_externos.gallery.go_to')} ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotoGallery({ images, onDelete, isDeleting = false }: PhotoGalleryProps) {
  const { t } = useTranslation();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        {t('rechazos_externos.gallery.no_photos')}
      </p>
    );
  }

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
          >
            {/* Thumbnail */}
            <img
              src={imageUrl(img)}
              alt={img.filename}
              className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
              onClick={() => setLightboxIdx(idx)}
            />

            {/* Hover overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover:bg-black/30 cursor-pointer"
              onClick={() => setLightboxIdx(idx)}
            >
              {/* View icon */}
              <div className="rounded-full bg-white/90 p-1.5 opacity-0 shadow transition-opacity group-hover:opacity-100">
                <svg className="h-4 w-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>

              {/* Delete button */}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(img.id); }}
                  disabled={isDeleting}
                  title={t('upload.delete')}
                  aria-label={t('upload.delete')}
                  className="rounded-full bg-white/90 p-1.5 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-red-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Index badge */}
            <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-xs text-white">
              {idx + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          images={images}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}
