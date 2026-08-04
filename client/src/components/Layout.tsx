import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { logout } from "../api/auth";
import { useNotify } from "../context/NotifyContext";
import { useAuth } from "../hooks/useAuth";

interface NavItem {
  label: string;
  href: string;
}

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Dashboard B2C", href: "/dashboard-b2c" },
  { label: "Dashboard B2B", href: "/dashboard-b2b" },
  { label: "No Conformidades", href: "/nc" },
  { label: "Recepciones", href: "/recepciones" },
  { label: "Rechazos Externos", href: "/rechazos-ext" },
  { label: "Rechazos Internos", href: "/rechazos-int" },
  { label: "CAPA", href: "/capas" },
  { label: "AQL", href: "/aql" },
  { label: "Liberación Shipping", href: "/liberacion-shipping" },
  { label: "Organigrama QC", href: "/organigrama-qc" },
  { label: "Calendario", href: "/calendario" },
  { label: "Usuarios", href: "/usuarios" },
  { label: "Control de Acceso", href: "/admin/access" },
  { label: "Manual", href: "/manual" },
];

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/nc": "No Conformidades",
  "/recepciones": "Recepciones",
  "/rechazos-ext": "Rechazos Externos",
  "/rechazos-int": "Rechazos Internos",
  "/capas": "Acciones Correctivas (CAPA)",
  "/aql": "Registro de AQL",
  "/liberacion-shipping": "Liberación Shipping",
  "/organigrama-qc": "Organigrama QC",
  "/calendario": "Calendario",
  "/usuarios": "Usuarios",
  "/admin/access": "Control de Acceso",
  "/dashboard-b2c": "Dashboard B2C",
  "/dashboard-b2b": "Dashboard B2B",
  "/manual": "Manual de Usuario",
};

// ── Sidebar colour tokens (fiel al monolito) ─────────────────────────────────
const S = {
  bg: "#0d2b4e",
  border: "rgba(255,255,255,0.1)",
  navText: "rgba(255,255,255,0.7)",
  navHover: "rgba(255,255,255,0.07)",
  navActive: "rgba(255,255,255,0.12)",
  navActiveBorder: "#ffffff",
  userMuted: "rgba(255,255,255,0.55)",
  logoutBorder: "rgba(255,255,255,0.25)",
  logoutText: "rgba(255,255,255,0.65)",
};

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const notify = useNotify();

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div
        style={{ minHeight: "100vh", background: S.bg }}
        className="flex items-center justify-center"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const moduleTitle = ROUTE_TITLES[location] ?? "Control de Calidad";
  const todayDate = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen" style={{ background: "#f4f6f9" }}>
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 flex flex-col"
        style={{ width: 220, background: S.bg }}
      >
        {/* Logo */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ borderBottom: `1px solid ${S.border}` }}
        >
          <img
            src="/logo.png"
            alt="Logo"
            style={{ height: 38, width: "auto", objectFit: "contain", flexShrink: 0 }}
          />
          <div>
            <p className="text-white font-bold uppercase tracking-wide text-xs leading-relaxed">
              Control de Calidad
            </p>
            <p style={{ color: S.userMuted, fontSize: 11 }}>MI Technologies</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.filter((item) => {
            if (user?.rol === "Administrador" || user?.permisos === null) return true;
            if (item.href === "/usuarios" || item.href === "/admin/access") return false; // solo admin
            const key = item.href === "/" ? "" : item.href.slice(1);
            const p = user?.permisos?.[key];
            // GAC (2026-08-02): unlike before, an absent permisos entry now means
            // "never granted this scope" (not "visible by default") — a listed
            // non-admin user only sees modules they were actually granted.
            return p ? p.ver : false;
          }).map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block",
                  padding: "9px 20px",
                  fontSize: 13,
                  color: active ? "#ffffff" : S.navText,
                  background: active ? S.navActive : "transparent",
                  borderLeft: `3px solid ${active ? S.navActiveBorder : "transparent"}`,
                  fontWeight: active ? 600 : 400,
                  textDecoration: "none",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = S.navHover;
                    (e.currentTarget as HTMLElement).style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = S.navText;
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User / logout */}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
              style={{ width: 30, height: 30, background: S.navActive, color: "#fff" }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-tight">
                {user?.name ?? "Usuario"}
              </p>
              <p className="text-xs truncate" style={{ color: S.userMuted, fontSize: 10 }}>
                {(user as any)?.rol ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 text-xs font-bold uppercase tracking-wide transition-colors"
            style={{
              background: "transparent",
              border: `1px solid ${S.logoutBorder}`,
              color: S.logoutText,
              letterSpacing: "0.5px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = S.navHover;
              (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = S.logoutText;
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col" style={{ marginLeft: 220 }}>
        {/* Topbar */}
        <div
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e2e2e2",
            padding: "14px 28px",
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0d2b4e" }}>{moduleTitle}</span>
          <span style={{ fontSize: 12, color: "#777777" }}>{todayDate}</span>
        </div>

        {/* Page content */}
        <div style={{ padding: "24px 28px" }}>{children}</div>
      </main>
    </div>
  );
}
