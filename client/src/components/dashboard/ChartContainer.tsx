/**
 * ChartContainer — Wrapper for Chart.js charts.
 * Provides a white card with a titled header and consistent padding.
 *
 * Props:
 *   title     — Chart title shown above the chart area
 *   children  — The <Bar>, <Pie>, or <Doughnut> component
 *   className — Optional extra Tailwind classes on the outer card
 */

import type { ReactNode } from "react";

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ChartContainer({ title, children, className = "" }: ChartContainerProps) {
  return (
    <div className={`card flex flex-col gap-4 ${className}`} style={{ padding: "18px 22px" }}>
      <h3 className="seccion-titulo" style={{ marginBottom: 0 }}>
        {title}
      </h3>
      <div className="relative flex-1 min-h-0">{children}</div>
    </div>
  );
}
