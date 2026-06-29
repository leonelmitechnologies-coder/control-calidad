/**
 * KpiCard — Displays a single KPI metric with title, value, and trend indicator.
 *
 * Props:
 *   title            — Displayed label below the value
 *   value            — Formatted string or number to show large
 *   trend            — 'up' | 'down' | undefined (no arrow)
 *   trendPositive    — Whether 'up' is good (green) or bad (red). Default true.
 *   icon             — Optional emoji / single-char icon shown top-right
 *   backgroundColor  — Optional Tailwind bg-* class override (default bg-blue-50)
 */

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: 'up' | 'down';
  /** When true: up = green, down = red.  When false: up = red, down = green. */
  trendPositive?: boolean;
  icon?: string;
  backgroundColor?: string;
}

export default function KpiCard({
  title,
  value,
  trend,
  trendPositive = true,
  icon,
  backgroundColor = 'bg-blue-50',
}: KpiCardProps) {
  // Determine arrow colour based on direction + polarity
  const arrowColour = (() => {
    if (!trend) return '';
    if (trend === 'up') return trendPositive ? 'text-green-600' : 'text-red-500';
    return trendPositive ? 'text-red-500' : 'text-green-600';
  })();

  const arrowSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : null;

  return (
    <div
      className={`${backgroundColor} rounded-xl border border-blue-100 p-5 shadow-sm
                  flex flex-col gap-2 min-h-[110px]`}
    >
      {/* Top row: optional icon */}
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 leading-tight">
          {title}
        </span>
        {icon && (
          <span className="text-xl leading-none select-none" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      {/* Value + trend arrow */}
      <div className="flex items-end gap-2 mt-auto">
        <span className="text-3xl font-bold text-gray-800 leading-none tabular-nums">
          {value}
        </span>
        {arrowSymbol && (
          <span className={`text-lg font-bold leading-none mb-0.5 ${arrowColour}`} aria-hidden="true">
            {arrowSymbol}
          </span>
        )}
      </div>
    </div>
  );
}
