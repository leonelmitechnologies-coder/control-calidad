/**
 * ChartContainer — Wrapper for Chart.js charts.
 * Provides a white card with a titled header and consistent padding.
 *
 * Props:
 *   title     — Chart title shown above the chart area
 *   children  — The <Bar>, <Pie>, or <Doughnut> component
 *   className — Optional extra Tailwind classes on the outer card
 */

import type { ReactNode } from 'react';

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ChartContainer({ title, children, className = '' }: ChartContainerProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 ${className}`}
    >
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        {title}
      </h3>
      <div className="relative flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
