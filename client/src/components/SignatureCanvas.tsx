/**
 * SignatureCanvas
 * HTML5 Canvas drawing pad for capturing digital signatures.
 * Outputs a PNG as a base64 data URL via the onSignatureChange callback.
 *
 * No external dependencies — uses native Canvas 2D API.
 *
 * Supports:
 *  - Mouse draw
 *  - Touch draw (mobile)
 *  - Clear button
 *  - Disabled state (pointer-events: none)
 *  - Auto-clears output when canvas is wiped
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string) => void;
  disabled?: boolean;
  height?: number;
  width?: number;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function getPos(
  canvas: HTMLCanvasElement,
  e: MouseEvent | Touch,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignatureCanvas({
  onSignatureChange,
  disabled = false,
  height   = 200,
  width    = 400,
}: SignatureCanvasProps) {
  const { t } = useTranslation();

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const hasStrokes = useRef(false);

  const [isEmpty, setIsEmpty] = useState(true);

  // ── Canvas setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Fill white background so PNG export is not transparent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [width, height]);

  // ── Emit data URL ─────────────────────────────────────────────────────────

  const emitDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSignatureChange(canvas.toDataURL('image/png'));
  }, [onSignatureChange]);

  // ── Mouse events ──────────────────────────────────────────────────────────

  const startDraw = useCallback((e: MouseEvent) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawing.current = true;
    const { x, y } = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [disabled]);

  const continueDraw = useCallback((e: MouseEvent) => {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();

    hasStrokes.current = true;
    setIsEmpty(false);
  }, [disabled]);

  const stopDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasStrokes.current) emitDataUrl();
  }, [emitDataUrl]);

  // ── Touch events ─────────────────────────────────────────────────────────

  const startDrawTouch = useCallback((e: TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawing.current = true;
    const touch = e.touches[0];
    const { x, y } = getPos(canvas, touch);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [disabled]);

  const continueDrawTouch = useCallback((e: TouchEvent) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    const { x, y } = getPos(canvas, touch);
    ctx.lineTo(x, y);
    ctx.stroke();

    hasStrokes.current = true;
    setIsEmpty(false);
  }, [disabled]);

  const stopDrawTouch = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    if (hasStrokes.current) emitDataUrl();
  }, [emitDataUrl]);

  // ── Attach / detach event listeners ──────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  continueDraw);
    canvas.addEventListener('mouseup',    stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    canvas.addEventListener('touchstart',  startDrawTouch,    { passive: false });
    canvas.addEventListener('touchmove',   continueDrawTouch, { passive: false });
    canvas.addEventListener('touchend',    stopDrawTouch,     { passive: false });
    canvas.addEventListener('touchcancel', stopDrawTouch,     { passive: false });

    return () => {
      canvas.removeEventListener('mousedown',  startDraw);
      canvas.removeEventListener('mousemove',  continueDraw);
      canvas.removeEventListener('mouseup',    stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);

      canvas.removeEventListener('touchstart',  startDrawTouch);
      canvas.removeEventListener('touchmove',   continueDrawTouch);
      canvas.removeEventListener('touchend',    stopDrawTouch);
      canvas.removeEventListener('touchcancel', stopDrawTouch);
    };
  }, [startDraw, continueDraw, stopDraw, startDrawTouch, continueDrawTouch, stopDrawTouch]);

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    hasStrokes.current = false;
    drawing.current    = false;
    setIsEmpty(true);
    onSignatureChange('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Label */}
      <p style={{ margin: 0 }}>
        {t('signature.draw')}
        {!disabled && isEmpty && (
          <span style={{ marginLeft: 8, fontSize: 11, fontStyle: 'italic', color: '#aaa' }}>
            {t('signature.required')}
          </span>
        )}
      </p>

      {/* Canvas wrapper */}
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          border: '1px solid #e2e2e2',
          background: disabled ? '#f4f6f9' : '#fff',
          opacity: disabled ? 0.6 : 1,
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full"
          style={{
            cursor: disabled ? 'not-allowed' : 'crosshair',
            aspectRatio: `${width} / ${height}`,
          }}
          aria-label={t('signature.draw')}
        />

        {/* Placeholder text while empty */}
        {isEmpty && !disabled && (
          <span
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: '#ccc',
              userSelect: 'none',
            }}
            aria-hidden="true"
          >
            {t('signature.draw')}
          </span>
        )}
      </div>

      {/* Clear button */}
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled || isEmpty}
        className="btn btn-peligro"
        style={disabled || isEmpty ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
      >
        <svg style={{ height: 13, width: 13, display: 'inline', marginRight: 5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        {t('signature.clear')}
      </button>
    </div>
  );
}
