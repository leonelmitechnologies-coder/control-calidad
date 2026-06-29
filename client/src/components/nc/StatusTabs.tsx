/**
 * StatusTabs — Reusable horizontal tab strip with per-tab counts
 *
 * Props:
 *   tabs    - array of { label, value, count }
 *   active  - currently active tab value
 *   onChange - called when a tab is clicked
 *
 * Active tab: blue background + white text
 * Inactive tab: light gray background + dark text
 */

interface Tab {
  label: string;
  value: string;
  count: number;
}

interface StatusTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
}

export default function StatusTabs({ tabs, active, onChange }: StatusTabsProps) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="tablist"
      aria-label="Filtrar por estatus"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`
              inline-flex items-center gap-1.5
              px-3 py-1.5 rounded-full text-sm font-medium
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
              ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {tab.label}
            <span
              className={`
                inline-flex items-center justify-center
                min-w-[1.25rem] h-5 px-1
                rounded-full text-xs font-semibold
                ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}
              `}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
