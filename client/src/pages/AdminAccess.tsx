/**
 * /admin/access — Access request review (GAC retrofit, 2026-08-02).
 *
 * Scope note: direct grant/edit/revoke of an EXISTING user's per-module
 * permisos already lives on /usuarios (see Usuarios.tsx + PATCH /api/usuarios/:id)
 * — this page is deliberately just the Requests queue (approve/deny, with an
 * optional scope override) rather than duplicating that. Full ("*") admins
 * (rol === "Administrador") only, same as /usuarios.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../config/api";
import { SCOPE_DOMAINS, SCOPE_LABELS } from "../config/scopeDomains";
import { useNotify } from "../context/NotifyContext";

interface AccessRequestRow {
  id: number;
  oidc_id: string;
  email: string;
  name: string | null;
  requested_scopes: string[];
  status: "pending" | "approved" | "denied";
  note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  requested_at: string;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function scopeLine(scopes: string[]) {
  if (scopes.includes("*")) return "*";
  return scopes.map((s) => SCOPE_LABELS[s as keyof typeof SCOPE_LABELS] ?? s).join(", ");
}

export default function AdminAccess() {
  const { t } = useTranslation();
  const notify = useNotify();
  const [status, setStatus] = useState<string>("pending");
  const [rows, setRows] = useState<AccessRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [overrideFor, setOverrideFor] = useState<number | null>(null);
  const [overrideScopes, setOverrideScopes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const data = await apiFetch<AccessRequestRow[]>(
        `${API_BASE_URL}/api/admin/access-requests${qs}`,
      );
      setRows(data);
    } catch (err: any) {
      notify(err.message ?? t("adminAccess.loadError"), "error");
    } finally {
      setLoading(false);
    }
  }, [status, notify, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: number, action: "approve" | "deny", scopes?: string[]) {
    setBusyId(id);
    try {
      await apiFetch(`${API_BASE_URL}/api/admin/access-requests/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(scopes ? { scopes } : {}) }),
      });
      notify(
        action === "approve" ? t("adminAccess.approvedMsg") : t("adminAccess.deniedMsg"),
        "success",
      );
      setOverrideFor(null);
      await load();
    } catch (err: any) {
      notify(err.message ?? t("adminAccess.decideError"), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t("adminAccess.title")}</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{t("adminAccess.sub")}</p>
      </div>

      <div className="mb-3 flex gap-2">
        {(["pending", "approved", "denied", ""] as const).map((s) => (
          <button
            type="button"
            key={s || "all"}
            onClick={() => setStatus(s)}
            className="btn-accion"
            style={{
              fontWeight: status === s ? 700 : 400,
              textDecoration: status === s ? "underline" : "none",
            }}
          >
            {s ? t(`adminAccess.${s}`) : t("adminAccess.all")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="vacio">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="vacio">{t("adminAccess.noRequests")}</p>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t("adminAccess.user")}</th>
                <th>{t("adminAccess.requestedScopes")}</th>
                <th>{t("adminAccess.reason")}</th>
                <th>{t("adminAccess.requestedAt")}</th>
                <th>{t("adminAccess.status")}</th>
                <th>{t("adminAccess.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name || r.email}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{r.email}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{scopeLine(r.requested_scopes)}</td>
                  <td style={{ fontSize: 12, color: "#666" }}>{r.note || "—"}</td>
                  <td style={{ fontSize: 12, color: "#777" }}>{fmt(r.requested_at)}</td>
                  <td>
                    <span
                      className={
                        r.status === "approved"
                          ? "badge badge-activo"
                          : r.status === "denied"
                            ? "badge badge-inactivo"
                            : "badge badge-usuario"
                      }
                    >
                      {t(`adminAccess.${r.status}`)}
                    </span>
                    {r.decided_by && (
                      <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                        {t("adminAccess.decidedBy")}: {r.decided_by}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {r.status === "pending" && (
                      <>
                        <button
                          type="button"
                          className="btn-accion"
                          disabled={busyId === r.id}
                          onClick={() => decide(r.id, "approve")}
                        >
                          {t("adminAccess.approve")}
                        </button>{" "}
                        <button
                          type="button"
                          className="btn-accion"
                          disabled={busyId === r.id}
                          onClick={() => {
                            if (overrideFor === r.id) {
                              setOverrideFor(null);
                            } else {
                              setOverrideFor(r.id);
                              setOverrideScopes(r.requested_scopes);
                            }
                          }}
                        >
                          {t("adminAccess.overrideScopes")}
                        </button>{" "}
                        <button
                          type="button"
                          className="btn-accion"
                          disabled={busyId === r.id}
                          onClick={() => decide(r.id, "deny")}
                        >
                          {t("adminAccess.deny")}
                        </button>
                        {overrideFor === r.id && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: 10,
                              border: "1px solid #e2e2e2",
                              background: "#fafafa",
                            }}
                          >
                            {SCOPE_DOMAINS.map((key) => (
                              <label
                                key={key}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginRight: 10,
                                  fontSize: 12,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={overrideScopes.includes(key)}
                                  onChange={() =>
                                    setOverrideScopes((cur) =>
                                      cur.includes(key)
                                        ? cur.filter((s) => s !== key)
                                        : [...cur, key],
                                    )
                                  }
                                />
                                {SCOPE_LABELS[key]}
                              </label>
                            ))}
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={overrideScopes.includes("*")}
                                onChange={() =>
                                  setOverrideScopes((cur) =>
                                    cur.includes("*")
                                      ? cur.filter((s) => s !== "*")
                                      : [...cur, "*"],
                                  )
                                }
                              />
                              {t("adminAccess.fullAccess")}
                            </label>
                            <div style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className="btn-accion"
                                onClick={() => decide(r.id, "approve", overrideScopes)}
                              >
                                {t("adminAccess.approveWithOverride")}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
