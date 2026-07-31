import { useEffect, useRef, useState } from "react";

interface Props {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} seleccionados`;

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 130, ...style }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "7px 10px",
          border: "1px solid #ddd",
          borderRadius: 5,
          fontSize: 13,
          background: "#fff",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: value.length ? "#222" : "#999",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{ marginLeft: 6, fontSize: 10, color: "#666", flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 200,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 5,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "100%",
            maxWidth: 300,
            marginTop: 3,
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: "100%",
                padding: "4px 8px",
                border: "1px solid #ddd",
                borderRadius: 4,
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 12px", fontSize: 12, color: "#999" }}>Sin resultados</div>
            )}
            {filtered.map((opt) => (
              <label
                key={opt}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontSize: 12,
                  background: value.includes(opt) ? "#f0f7ff" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt)}
                  onChange={() => toggle(opt)}
                  style={{ cursor: "pointer", accentColor: "#2980b9" }}
                />
                {opt}
              </label>
            ))}
          </div>

          {value.length > 0 && (
            <div style={{ padding: "6px 12px", borderTop: "1px solid #eee" }}>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  fontSize: 11,
                  color: "#c0392b",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Limpiar selección ({value.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
