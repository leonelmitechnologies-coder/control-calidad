import type { ReactNode } from "react";

interface FieldGroupProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function FieldGroup({ title, children, className = "" }: FieldGroupProps) {
  return (
    <div className={className} style={{ marginBottom: 20 }}>
      <div className="seccion-titulo">{title}</div>
      <div className="form-grid">{children}</div>
    </div>
  );
}

export function FieldGroupRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={["full", className].filter(Boolean).join(" ")}>{children}</div>;
}
