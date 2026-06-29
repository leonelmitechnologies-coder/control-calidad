/**
 * FieldGroup — Reusable section wrapper for grouping form fields.
 *
 * Renders a titled card section with subtle border, light background,
 * rounded corners, and consistent padding. Generic enough for use across
 * any module form (Recepciones, RechazosInternos, etc.).
 *
 * Usage:
 *   <FieldGroup title="Información General">
 *     <label>...</label>
 *     <input ... />
 *   </FieldGroup>
 */

import type { ReactNode } from 'react';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FieldGroupProps {
  /** Section heading displayed at the top of the group */
  title: string;
  /** Form fields or any content to render inside the group */
  children: ReactNode;
  /** Additional Tailwind classes to merge onto the root element */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FieldGroup({ title, children, className = '' }: FieldGroupProps) {
  return (
    <fieldset
      className={[
        'rounded-lg border border-gray-200 bg-gray-50 px-4 pb-4 pt-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Legend acts as semantic section heading inside a fieldset */}
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </legend>

      {/* Children are laid out in a responsive 2-column grid by default */}
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {children}
      </div>
    </fieldset>
  );
}

// ── Full-width helper ─────────────────────────────────────────────────────────

/**
 * FieldGroupRow — A child element that spans both columns inside FieldGroup.
 *
 * Usage:
 *   <FieldGroup title="Carga">
 *     <FieldGroupRow>
 *       <label>Notas</label>
 *       <textarea ... />
 *     </FieldGroupRow>
 *   </FieldGroup>
 */
export function FieldGroupRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={['sm:col-span-2', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
