/**
 * Request Access — shown to a user who signed in via SSO but isn't on the
 * allowlist yet (no usuarios row). Part of the GAC retrofit (2026-08-02).
 * Lets them pick which module(s) they need; submits to #approvals via the
 * server, which the shared Mattermost access-request-watcher (or an admin on
 * /admin/access) approves/denies.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { logout } from "../api/auth";
import { API_BASE_URL } from "../config/api";
import { SCOPE_DOMAINS, SCOPE_LABELS } from "../config/scopeDomains";
import { useAuth } from "../hooks/useAuth";

export default function RequestAccess() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [scopes, setScopes] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const alreadyPending = user?.requestStatus === "pending";
  const wasDenied = user?.requestStatus === "denied";

  function toggle(key: string) {
    setScopes((cur) => (cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key]));
  }

  async function submit() {
    if (scopes.length === 0) {
      setError(t("requestAccess.pickOne"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/auth/request-access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const showPending = alreadyPending || submitted;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d2b4e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ background: "#ffffff", width: 460, maxWidth: "100%", padding: "36px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{ height: 48, width: "auto", objectFit: "contain", margin: "0 auto 14px" }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0d2b4e", margin: "0 0 6px" }}>
            {t("requestAccess.title")}
          </h1>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            {user?.name ? `${user.name} — ` : ""}
            {user?.email}
          </p>
        </div>

        {showPending ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#333", marginBottom: 16 }}>
              {t("requestAccess.pendingMsg")}
            </p>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                background: "transparent",
                border: "1px solid #ccc",
                color: "#555",
                padding: "8px 18px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("auth.logout")}
            </button>
          </div>
        ) : (
          <>
            {wasDenied && (
              <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 12 }}>
                {t("requestAccess.deniedMsg")}
              </p>
            )}
            <p style={{ fontSize: 13, color: "#444", marginBottom: 14 }}>
              {t("requestAccess.intro")}
            </p>
            <div style={{ marginBottom: 16 }}>
              {SCOPE_DOMAINS.map((key) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    fontSize: 13,
                    color: "#222",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={scopes.includes(key)}
                    onChange={() => toggle(key)}
                    style={{ width: 15, height: 15 }}
                  />
                  {SCOPE_LABELS[key]}
                </label>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("requestAccess.notePlaceholder")}
              rows={2}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 8,
                fontSize: 12,
                border: "1px solid #ddd",
                marginBottom: 12,
                fontFamily: "inherit",
              }}
            />
            {error && <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                display: "block",
                width: "100%",
                padding: "11px 0",
                background: "#0d2b4e",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? t("requestAccess.submitting") : t("requestAccess.submit")}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                display: "block",
                width: "100%",
                marginTop: 10,
                padding: "9px 0",
                background: "transparent",
                border: "1px solid #ccc",
                color: "#666",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {t("auth.logout")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
