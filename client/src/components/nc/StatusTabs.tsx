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
      style={{
        borderBottom: '1px solid #e2e2e2',
        display: 'flex',
        gap: 0,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid #0d2b4e' : '2px solid transparent',
              color: isActive ? '#0d2b4e' : '#777',
              fontWeight: isActive ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab.label}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 18,
                padding: '0 4px',
                background: isActive ? '#0d2b4e' : '#e2e2e2',
                color: isActive ? '#fff' : '#555',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
