import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { logout } from "../api/auth";
import i18n from "../config/i18n";
import { useNotify } from "../context/NotifyContext";
import { useAuth } from "../hooks/useAuth";

interface LayoutProps {
  children: ReactNode;
}

const LANGS = [
  { code: "es-MX", label: "ES" },
  { code: "en",    label: "EN" },
  { code: "zh-CN", label: "中" },
] as const;

const DATE_LOCALE: Record<string, string> = {
  "es-MX": "es-MX",
  "en":    "en-US",
  "zh-CN": "zh-CN",
};

// ── Sidebar colour tokens ────────────────────────────────────────────────────
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
  const { t, i18n: i18nHook } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.language);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Cierra el sidebar al navegar en móvil
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location, isMobile]);

  const handleLogout = useCallback(() => {
    logout();
  }, []);

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("language", code);
    setCurrentLang(code);
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

  const NAV_ITEMS = [
    { key: "dashboard",    href: "/" },
    { key: "dashboard_b2c", href: "/dashboard-b2c" },
    { key: "dashboard_b2b", href: "/dashboard-b2b" },
    { key: "nc",           href: "/nc" },
    { key: "recepciones",  href: "/recepciones" },
    { key: "rechazos_ext", href: "/rechazos-ext" },
    { key: "rechazos_int", href: "/rechazos-int" },
    { key: "capas",        href: "/capas" },
    { key: "aql",          href: "/aql" },
    { key: "liberacion_shipping", href: "/liberacion-shipping" },
    { key: "organigrama",  href: "/organigrama-qc" },
    { key: "calendario",   href: "/calendario" },
    { key: "comida",       href: "/registro-comida" },
    { key: "metricas",     href: "/metricas-ml" },
    { key: "asistente",    href: "/asistente" },
    { key: "linea_produccion", href: "/linea-produccion" },
    { key: "usuarios",     href: "/usuarios" },
    { key: "access",       href: "/admin/access" },
    { key: "manual",       href: "/manual" },
  ];

  const ROUTE_NAV_KEY: Record<string, string> = {
    "/":                   "dashboard",
    "/dashboard-b2c":      "dashboard_b2c",
    "/dashboard-b2b":      "dashboard_b2b",
    "/nc":                 "nc",
    "/recepciones":        "recepciones",
    "/rechazos-ext":       "rechazos_ext",
    "/rechazos-int":       "rechazos_int",
    "/capas":              "capas",
    "/aql":                "aql",
    "/liberacion-shipping":"liberacion_shipping",
    "/organigrama-qc":     "organigrama",
    "/calendario":         "calendario",
    "/registro-comida":    "comida",
    "/metricas-ml":        "metricas",
    "/asistente":          "asistente",
    "/linea-produccion":   "linea_produccion",
    "/usuarios":           "usuarios",
    "/admin/access":       "access",
    "/manual":             "manual",
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const navKey = ROUTE_NAV_KEY[location];
  const moduleTitle = navKey ? t(`nav.${navKey}`) : t("app.title");

  const dateLocale = DATE_LOCALE[currentLang] ?? "es-MX";
  const todayDate = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex" style={{ height: "100dvh", overflow: "hidden", background: "#f4f6f9" }}>
      {/* ── Backdrop (solo móvil, cuando sidebar abierto) ─────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 199,
          }}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 flex flex-col"
        style={{
          width: 220,
          background: S.bg,
          zIndex: 200,
          transform: isMobile && !sidebarOpen ? "translateX(-220px)" : "translateX(0)",
          transition: "transform 0.25s ease",
        }}
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
            if (item.href === "/usuarios" || item.href === "/admin/access") return false;
            const key = item.href === "/" ? "" : item.href.slice(1);
            const p = user?.permisos?.[key];
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
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        {/* User / logout / language switcher */}
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
                {user?.name ?? t("auth.user")}
              </p>
              <p className="text-xs truncate" style={{ color: S.userMuted, fontSize: 10 }}>
                {(user as any)?.rol ?? ""}
              </p>
            </div>
          </div>

          {/* Language switcher */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {LANGS.map(({ code, label }) => {
              const active = currentLang === code;
              return (
                <button
                  key={code}
                  onClick={() => handleLang(code)}
                  title={t(`layout.lang_${code === "es-MX" ? "es" : code === "zh-CN" ? "zh" : "en"}`)}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    fontSize: 11,
                    fontWeight: active ? 700 : 400,
                    background: active ? "rgba(255,255,255,0.15)" : "transparent",
                    border: `1px solid ${active ? "rgba(255,255,255,0.5)" : S.logoutBorder}`,
                    color: active ? "#ffffff" : S.logoutText,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              );
            })}
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
            {t("auth.logout")}
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main
        className="flex-1 min-w-0 flex flex-col"
        style={{ marginLeft: isMobile ? 0 : 220 }}
      >
        {/* Topbar */}
        <div
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e2e2e2",
            padding: isMobile ? "12px 16px" : "14px 28px",
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {/* Botón hamburguesa — solo móvil */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 6px",
                  color: "#0d2b4e",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
                aria-label={t("layout.menu")}
              >
                <span style={{ display: "block", width: 20, height: 2, background: "#0d2b4e" }} />
                <span style={{ display: "block", width: 20, height: 2, background: "#0d2b4e" }} />
                <span style={{ display: "block", width: 20, height: 2, background: "#0d2b4e" }} />
              </button>
            )}
            <span
              style={{
                fontSize: isMobile ? 14 : 15,
                fontWeight: 700,
                color: "#0d2b4e",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {moduleTitle}
            </span>
          </div>
          <span
            style={{
              fontSize: isMobile ? 10 : 12,
              color: "#777777",
              flexShrink: 0,
              textAlign: "right",
            }}
          >
            {todayDate}
          </span>
        </div>

        {/* Page content */}
        <div style={{
          padding: isMobile ? "16px 14px" : "24px 28px",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}>{children}</div>
      </main>
    </div>
  );
}
