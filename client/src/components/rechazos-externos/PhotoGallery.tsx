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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)',
        padding: 16,
      }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: 8,
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label={t('common.close')}
      >
        <svg style={{ height: 20, width: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          padding: '2px 12px',
          fontSize: 12,
        }}
      >
        {current + 1} / {images.length}
      </div>

      {/* Prev button */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={t('rechazos_externos.gallery.prev')}
        >
          <svg style={{ height: 24, width: 24 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        style={{ position: 'relative', maxHeight: '80vh', maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl(img)}
          alt={img.filename}
          style={{ maxHeight: '75vh', maxWidth: '85vw', objectFit: 'contain' }}
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={t('rechazos_externos.gallery.next')}
        >
          <svg style={{ height: 24, width: 24 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Caption */}
      <p
        style={{
          marginTop: 12,
          maxWidth: 320,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          fontSize: 11,
          color: '#ccc',
        }}
      >
        {img.filename}
      </p>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              style={{
                height: 8,
                width: 8,
                background: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
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
      <p style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>
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
            className="group relative overflow-hidden"
            style={{
              aspectRatio: '1 / 1',
              border: '1px solid #e2e2e2',
              background: '#f4f6f9',
            }}
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
              <div
                className="opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg style={{ height: 16, width: 16, color: '#333' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    border: 'none',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg style={{ height: 16, width: 16, color: '#c0392b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Index badge */}
            <span
              style={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                fontSize: 10,
                padding: '1px 5px',
              }}
            >
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
