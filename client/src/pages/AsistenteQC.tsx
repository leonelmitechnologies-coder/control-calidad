import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNotify } from "../context/NotifyContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth } from "../hooks/useAuth";
import { apiGet, apiDelete, apiPatch } from "../utils/api-client";
import { API_BASE_URL } from "../config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Doc {
  id: number;
  nombre: string;
  tipo: string;
  tamanio_bytes: number;
  activo: boolean;
  subido_por: string;
  created_at: string;
}

interface Mensaje {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tipoIcono(tipo: string): string {
  if (tipo === "pdf") return "📄";
  if (tipo === "docx" || tipo === "doc") return "📝";
  if (tipo === "xlsx" || tipo === "xls") return "📊";
  return "📃";
}

const PREGUNTAS_SUGERIDAS = [
  "¿Cuántas NC abiertas hay este mes?",
  "¿Cuál es el proceso para abrir una CAPA?",
  "¿Cuántos rechazos externos hubo este mes?",
  "¿Cuál es el nivel AQL para inspección general?",
  "¿Qué CAPAs están vencidas?",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AsistenteQC() {
  const notify = useNotify();
  const confirm = useConfirm();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = (user as any)?.rol === "Administrador";

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch docs
  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ["asistente-docs"],
    queryFn: () => apiGet<Doc[]>("/api/asistente/docs"),
  });

  const docsActivos = docs.filter((d) => d.activo);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Toggle doc active
  const toggleDoc = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      apiPatch(`/api/asistente/docs/${id}`, { activo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asistente-docs"] }),
    onError: () => notify("Error al actualizar documento", "error"),
  });

  // Delete doc
  const eliminarDoc = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/asistente/docs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asistente-docs"] });
      notify("Documento eliminado", "success");
    },
    onError: () => notify("Error al eliminar documento", "error"),
  });

  async function handleEliminar(doc: Doc) {
    const ok = await confirm({
      title: "Eliminar documento",
      message: `¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });
    if (ok) eliminarDoc.mutate(doc.id);
  }

  // Upload doc
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("archivo", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/asistente/docs`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        notify(err.error ?? "Error al subir documento", "error");
        return;
      }
      qc.invalidateQueries({ queryKey: ["asistente-docs"] });
      notify("Documento subido correctamente", "success");
    } catch {
      notify("Error al subir documento", "error");
    }
    e.target.value = "";
  }

  // Send message with SSE streaming
  async function enviarPregunta(pregunta: string) {
    if (!pregunta.trim() || streaming) return;

    const historial = mensajes.map((m) => ({ role: m.role, content: m.content }));
    setMensajes((prev) => [
      ...prev,
      { role: "user", content: pregunta },
      { role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/asistente/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta, historial }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMensajes((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `⚠️ ${err.error ?? "Error al consultar el asistente"}`,
          };
          return copy;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const { delta, error } = JSON.parse(data);
            if (error) throw new Error(error);
            if (delta) {
              setMensajes((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + delta,
                  pending: false,
                };
                return copy;
              });
            }
          } catch {
            // ignore parse errors mid-stream
          }
        }
      }
    } catch (err: any) {
      setMensajes((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "⚠️ Error de conexión. Intenta de nuevo.",
        };
        return copy;
      });
    } finally {
      setMensajes((prev) => {
        const copy = [...prev];
        if (copy[copy.length - 1]?.pending) {
          copy[copy.length - 1] = { ...copy[copy.length - 1], pending: false };
        }
        return copy;
      });
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarPregunta(input);
    }
  }

  function limpiarChat() {
    setMensajes([]);
    setInput("");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", background: "#0f172a" }}>

      {/* Header */}
      <div style={{
        background: "#1e293b",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #334155",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 15 }}>Asistente QC</div>
            <div style={{ color: "#64748b", fontSize: 11 }}>IA · ISO 9001:2015</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowDocs((v) => !v)}
            style={{
              background: showDocs ? "#1d4ed8" : "#0f172a",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "4px 12px",
              color: showDocs ? "#fff" : "#94a3b8",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            📄 {docsActivos.length} doc{docsActivos.length !== 1 ? "s" : ""} activo{docsActivos.length !== 1 ? "s" : ""}
          </button>
          {mensajes.length > 0 && (
            <button
              onClick={limpiarChat}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "4px 12px",
                color: "#94a3b8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🗑️ Limpiar
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Welcome */}
            {mensajes.length === 0 && (
              <div style={{ maxWidth: 560 }}>
                <div style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 6 }}>🤖 ASISTENTE QC</div>
                  <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>
                    Hola <strong>{user?.name?.split(" ")[0] ?? ""}!</strong> Tengo acceso a{" "}
                    <strong style={{ color: "#60a5fa" }}>{docsActivos.length} documento{docsActivos.length !== 1 ? "s" : ""} de referencia</strong>{" "}
                    y a todos los datos del sistema QC en tiempo real.
                    <br /><br />
                    Puedo responder preguntas sobre procedimientos, criterios, registros y más. ¿En qué te puedo ayudar?
                  </div>
                </div>

                {/* Suggested questions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {PREGUNTAS_SUGERIDAS.map((p) => (
                    <button
                      key={p}
                      onClick={() => enviarPregunta(p)}
                      disabled={streaming}
                      style={{
                        background: "#1e293b",
                        border: "1px solid #1d4ed8",
                        borderRadius: 20,
                        padding: "5px 14px",
                        color: "#93c5fd",
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                    >
                      💡 {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {mensajes.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    background: m.role === "user" ? "#1d4ed8" : "#1e293b",
                    border: m.role === "assistant" ? "1px solid #334155" : "none",
                    borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px",
                    padding: "10px 14px",
                  }}
                >
                  {m.role === "assistant" && (
                    <div style={{ color: "#64748b", fontSize: 10, marginBottom: 5 }}>🤖 ASISTENTE QC</div>
                  )}
                  <div style={{
                    color: m.role === "user" ? "#fff" : "#e2e8f0",
                    fontSize: 13,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}>
                    {m.pending && !m.content ? (
                      <span style={{ color: "#64748b" }}>▋</span>
                    ) : (
                      m.content
                    )}
                    {m.pending && m.content && <span style={{ color: "#64748b" }}>▋</span>}
                  </div>
                </div>
              </div>
            ))}

            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "12px 20px",
            borderTop: "1px solid #334155",
            background: "#1e293b",
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            flexShrink: 0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="Escribe tu pregunta sobre el sistema o los procedimientos... (Enter para enviar)"
              rows={1}
              style={{
                flex: 1,
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#e2e8f0",
                fontSize: 13,
                resize: "none",
                outline: "none",
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: "auto",
                opacity: streaming ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => enviarPregunta(input)}
              disabled={streaming || !input.trim()}
              style={{
                background: streaming || !input.trim() ? "#334155" : "#1d4ed8",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
                flexShrink: 0,
                fontSize: 18,
                color: "#fff",
                transition: "background 0.15s",
              }}
            >
              {streaming ? "⏳" : "↑"}
            </button>
          </div>
        </div>

        {/* Docs panel (admin) */}
        {showDocs && (
          <div style={{
            width: 320,
            background: "#1e293b",
            borderLeft: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13 }}>📁 Documentos</span>
              {isAdmin && (
                <label style={{
                  background: "#1d4ed8",
                  borderRadius: 6,
                  padding: "4px 10px",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}>
                  + Subir
                  <input type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt" onChange={handleUpload} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.length === 0 && (
                <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 20 }}>
                  No hay documentos cargados
                </div>
              )}
              {docs.map((doc) => (
                <div key={doc.id} style={{
                  background: "#0f172a",
                  borderRadius: 8,
                  padding: "10px 12px",
                  border: `1px solid ${doc.activo ? "#1d4ed8" : "#334155"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{tipoIcono(doc.tipo)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: "#e2e8f0",
                        fontSize: 12,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }} title={doc.nombre}>
                        {doc.nombre}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>
                        {formatBytes(doc.tamanio_bytes ?? 0)} · {doc.subido_por}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => toggleDoc.mutate({ id: doc.id, activo: !doc.activo })}
                        style={{
                          flex: 1,
                          background: doc.activo ? "#064e3b" : "#1e293b",
                          border: `1px solid ${doc.activo ? "#34d399" : "#475569"}`,
                          borderRadius: 4,
                          padding: "3px 0",
                          color: doc.activo ? "#34d399" : "#94a3b8",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        {doc.activo ? "✅ Activo" : "⏸ Inactivo"}
                      </button>
                      <button
                        onClick={() => handleEliminar(doc)}
                        style={{
                          background: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: 4,
                          padding: "3px 8px",
                          color: "#f87171",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                  {!isAdmin && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        background: doc.activo ? "#064e3b" : "#1e293b",
                        color: doc.activo ? "#34d399" : "#94a3b8",
                        fontSize: 10,
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}>
                        {doc.activo ? "✅ Activo" : "⏸ Inactivo"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
