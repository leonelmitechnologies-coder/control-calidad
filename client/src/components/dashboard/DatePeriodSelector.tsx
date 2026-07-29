/**
 * DatePeriodSelector — Toggle between "Mes" (monthly) and "YTD" (year-to-date)
 * with conditional month + year dropdowns.
 *
 * When period = 'mes': shows month selector + year selector.
 * When period = 'ytd': shows only year selector.
 */

import { useTranslation } from "react-i18next";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the last 3 years plus the current year, descending. */
function buildYearOptions(currentYear: number): number[] {
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
}

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DatePeriodSelectorProps {
  period: "mes" | "ytd";
  onPeriodChange: (p: "mes" | "ytd") => void;
  year: number;
  onYearChange: (y: number) => void;
  month?: number; // 1–12
  onMonthChange?: (m: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DatePeriodSelector({
  period,
  onPeriodChange,
  year,
  onYearChange,
  month = 1,
  onMonthChange,
}: DatePeriodSelectorProps) {
  const { t, i18n } = useTranslation();
  const currentYear = new Date().getFullYear();
  const yearOptions = buildYearOptions(currentYear);

  // Pick month names based on active language
  const monthNames = i18n.language === "en" ? MONTH_NAMES_EN : MONTH_NAMES_ES;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => onPeriodChange("mes")}
          className={`px-4 py-2 text-sm font-medium transition-colors
            ${
              period === "mes"
                ? "bg-blue-700 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
        >
          {t("dashboard.period.mes")}
        </button>
        <button
          type="button"
          onClick={() => onPeriodChange("ytd")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200
            ${
              period === "ytd"
                ? "bg-blue-700 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
        >
          {t("dashboard.period.ytd")}
        </button>
      </div>

      {/* Month selector — only when period = 'mes' */}
      {period === "mes" && onMonthChange && (
        <div className="flex items-center gap-2">
          <label htmlFor="dash-month" className="text-sm text-gray-500 font-medium">
            {t("dashboard.month")}
          </label>
          <select
            id="dash-month"
            value={month}
            onChange={(e) => onMonthChange(parseInt(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
                       shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthNames.map((name, idx) => {
              const num = idx + 1;
              return (
                <option key={num} value={num}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Year selector — always visible */}
      <div className="flex items-center gap-2">
        <label htmlFor="dash-year" className="text-sm text-gray-500 font-medium">
          {t("dashboard.year")}
        </label>
        <select
          id="dash-year"
          value={year}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
                     shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
