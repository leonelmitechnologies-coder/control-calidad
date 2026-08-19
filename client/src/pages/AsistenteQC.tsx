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

function tipoLabel(tipo: string): string {
  if (tipo === "pdf") return "PDF";
  if (tipo === "docx" || tipo === "doc") return "Word";
  if (tipo === "xlsx" || tipo === "xls") return "Excel";
  if (["mp4", "m4v", "mov", "webm", "mpeg"].includes(tipo)) return "Video";
  return tipo.toUpperCase();
}

const PREGUNTAS_SUGERIDAS = [
  "¿Cuántas NC abiertas hay?",
  "¿Qué rechazos externos hubo esta semana?",
  "¿Cuántos rechazos internos hubo este mes?",
  "¿Qué CAPAs están pendientes?",
  "¿Cuál es el nivel AQL para inspección general?",
];

// ── Colores del sistema ────────────────────────────────────────────────────────
const C = {
  primary: "#0d2b4e",
  primaryLight: "#1a3d6e",
  bg: "#f4f6f9",
  white: "#ffffff",
  border: "#e2e2e2",
  borderLight: "#eeeeee",
  textDark: "#1a1a2e",
  textMid: "#555555",
  textMuted: "#888888",
  userBubble: "#0d2b4e",
  userText: "#ffffff",
  assistantBg: "#ffffff",
  assistantBorder: "#e2e2e2",
  inputBorder: "#d0d5dd",
  tagBg: "#eef2f7",
  tagText: "#0d2b4e",
  activeBadge: "#e8f5e9",
  activeBadgeText: "#2e7d32",
  inactiveBadge: "#f5f5f5",
  inactiveBadgeText: "#888888",
};

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [videoAdjunto, setVideoAdjunto] = useState<File | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ["asistente-docs"],
    queryFn: () => apiGet<Doc[]>("/api/asistente/docs"),
  });

  const docsActivos = docs.filter((d) => d.activo);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const toggleDoc = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      apiPatch(`/api/asistente/docs/${id}`, { activo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asistente-docs"] }),
    onError: () => notify("Error al actualizar documento", "error"),
  });

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

  async function enviarPregunta(pregunta: string) {
    if ((!pregunta.trim() && !videoAdjunto) || streaming) return;

    const video = videoAdjunto;
    const historial = mensajes.map((m) => ({ role: m.role, content: m.content }));
    const labelVideo = video ? `📎 ${video.name}\n\n` : "";
    const mensajeUsuario = labelVideo + (pregunta.trim() || "Describe y evalúa el defecto mostrado en el video.");

    setMensajes((prev) => [
      ...prev,
      { role: "user", content: mensajeUsuario },
      { role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setVideoAdjunto(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    setStreaming(true);

    try {
      const fd = new FormData();
      fd.append("pregunta", pregunta.trim() || "Describe y evalúa el defecto mostrado en el video.");
      fd.append("historial", JSON.stringify(historial));
      if (video) fd.append("video", video);

      const res = await fetch(`${API_BASE_URL}/api/asistente/chat`, {
        method: "POST",
        credentials: "include",
        body: fd,
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
                copy[copy.length - 1] = { ...last, content: last.content + delta, pending: false };
                return copy;
              });
            }
          } catch {
            // ignore parse errors mid-stream
          }
        }
      }
    } catch {
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
        if (copy[copy.length - 1]?.pending)
          copy[copy.length - 1] = { ...copy[copy.length - 1], pending: false };
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: C.white,
      border: `1px solid ${C.border}`,
    }}>

      {/* ── Barra superior ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        borderBottom: `1px solid ${C.border}`,
        background: C.white,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: C.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            IA
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>Asistente QC</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>ISO 9001:2015 · datos en tiempo real</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowDocs((v) => !v)}
            style={{
              background: showDocs ? C.primary : C.white,
              border: `1px solid ${showDocs ? C.primary : C.border}`,
              borderRadius: 6,
              padding: "5px 12px",
              color: showDocs ? "#fff" : C.textMid,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700 }}>{docsActivos.length}</span>
            {docsActivos.length === 1 ? "documento" : "documentos"}
          </button>

          {mensajes.length > 0 && (
            <button
              onClick={() => { setMensajes([]); setInput(""); }}
              style={{
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "5px 12px",
                color: C.textMuted,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

        {/* Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.white }}>

          {/* Mensajes */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            {/* Bienvenida */}
            {mensajes.length === 0 && (
              <div style={{ maxWidth: 580 }}>
                <div style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "16px 18px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.5px", marginBottom: 8, textTransform: "uppercase" }}>
                    Asistente QC
                  </div>
                  <div style={{ fontSize: 13, color: C.textDark, lineHeight: 1.65 }}>
                    Hola <strong>{user?.name?.split(" ")[0] ?? ""}!</strong> Tengo acceso a{" "}
                    <strong style={{ color: C.primary }}>{docsActivos.length} documento{docsActivos.length !== 1 ? "s" : ""} de referencia</strong>{" "}
                    y a los registros en tiempo real del sistema QC.
                  </div>
                </div>

                {/* Preguntas sugeridas */}
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {PREGUNTAS_SUGERIDAS.map((p) => (
                    <button
                      key={p}
                      onClick={() => enviarPregunta(p)}
                      disabled={streaming}
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 20,
                        padding: "5px 13px",
                        color: C.primary,
                        fontSize: 12,
                        cursor: streaming ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = C.primary;
                        (e.currentTarget as HTMLElement).style.background = C.bg;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = C.border;
                        (e.currentTarget as HTMLElement).style.background = C.white;
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mensajes del chat */}
            {mensajes.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "75%",
                  background: m.role === "user" ? C.userBubble : C.assistantBg,
                  border: m.role === "assistant" ? `1px solid ${C.assistantBorder}` : "none",
                  borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
                  padding: "10px 14px",
                }}>
                  {m.role === "assistant" && (
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.textMuted,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}>
                      Asistente QC
                    </div>
                  )}
                  <div style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: m.role === "user" ? C.userText : C.textDark,
                    whiteSpace: "pre-wrap",
                  }}>
                    {m.pending && !m.content
                      ? <span style={{ color: C.textMuted }}>▋</span>
                      : m.content
                    }
                    {m.pending && m.content && <span style={{ color: C.textMuted }}>▋</span>}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: `1px solid ${C.border}`,
            background: C.white,
            flexShrink: 0,
          }}>
            {/* Chip video adjunto */}
            {videoAdjunto && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 20px 0",
              }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "#e8f0fe",
                  border: "1px solid #c5d8fc",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 12,
                  color: C.primary,
                  fontWeight: 600,
                }}>
                  🎬 {videoAdjunto.name}
                  <button
                    onClick={() => { setVideoAdjunto(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, padding: 0, lineHeight: 1 }}
                  >×</button>
                </span>
              </div>
            )}
            <div style={{ padding: "10px 20px 12px", display: "flex", gap: 8, alignItems: "flex-end" }}>
              {/* Botón adjuntar video */}
              <label title="Adjuntar video al chat" style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${videoAdjunto ? C.primary : C.inputBorder}`,
                background: videoAdjunto ? "#e8f0fe" : C.white,
                cursor: streaming ? "not-allowed" : "pointer",
                flexShrink: 0,
                fontSize: 16,
                opacity: streaming ? 0.5 : 1,
                transition: "all 0.15s",
              }}>
                🎬
                <input
                  ref={videoInputRef}
                  type="file"
                  accept=".mp4,.m4v,.mov,.webm,.mpeg"
                  disabled={streaming}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setVideoAdjunto(f); }}
                  style={{ display: "none" }}
                />
              </label>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                placeholder={videoAdjunto ? "Pregunta sobre el video (opcional)..." : "Escribe tu pregunta... (Enter para enviar, Shift+Enter para nueva línea)"}
                rows={1}
                style={{
                  flex: 1,
                  background: C.white,
                  border: `1px solid ${C.inputBorder}`,
                  borderRadius: 8,
                  padding: "9px 14px",
                  color: C.textDark,
                  fontSize: 13,
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.5,
                  maxHeight: 120,
                  overflowY: "auto",
                  fontFamily: "inherit",
                  opacity: streaming ? 0.6 : 1,
                }}
              />
              <button
                onClick={() => enviarPregunta(input)}
                disabled={streaming || (!input.trim() && !videoAdjunto)}
                style={{
                  background: streaming || (!input.trim() && !videoAdjunto) ? C.border : C.primary,
                  border: "none",
                  borderRadius: 8,
                  width: 38,
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: streaming || (!input.trim() && !videoAdjunto) ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  color: "#fff",
                  fontSize: 16,
                  transition: "background 0.15s",
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        {/* Panel de documentos — lado en desktop, overlay en móvil */}
        {showDocs && (
          <div style={{
            position: isMobile ? "absolute" : "relative",
            top: 0,
            right: 0,
            bottom: 0,
            width: isMobile ? "min(300px, 90vw)" : 300,
            borderLeft: `1px solid ${C.border}`,
            background: C.bg,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 10,
            boxShadow: isMobile ? "-4px 0 16px rgba(0,0,0,0.12)" : "none",
          }}>
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: C.white,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>Documentos</span>
              {isAdmin && (
                <label style={{
                  background: C.primary,
                  borderRadius: 5,
                  padding: "4px 10px",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                }}>
                  + Subir
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.mp4,.m4v,.mov,.webm,.mpeg"
                    onChange={handleUpload}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.length === 0 && (
                <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 24 }}>
                  No hay documentos cargados
                </div>
              )}
              {docs.map((doc) => (
                <div key={doc.id} style={{
                  background: C.white,
                  borderRadius: 6,
                  padding: "10px 12px",
                  border: `1px solid ${doc.activo ? C.primary : C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: C.tagBg,
                      color: C.tagText,
                      borderRadius: 3,
                      padding: "2px 5px",
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                      {tipoLabel(doc.tipo)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.textDark,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }} title={doc.nombre}>
                        {doc.nombre}
                      </div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                        {formatBytes(doc.tamanio_bytes ?? 0)} · {doc.subido_por}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                    <span style={{
                      fontSize: 10,
                      borderRadius: 3,
                      padding: "2px 7px",
                      background: doc.activo ? C.activeBadge : C.inactiveBadge,
                      color: doc.activo ? C.activeBadgeText : C.inactiveBadgeText,
                      fontWeight: 600,
                    }}>
                      {doc.activo ? "Activo" : "Inactivo"}
                    </span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => toggleDoc.mutate({ id: doc.id, activo: !doc.activo })}
                          style={{
                            flex: 1,
                            background: C.white,
                            border: `1px solid ${C.border}`,
                            borderRadius: 4,
                            padding: "3px 0",
                            color: C.textMid,
                            fontSize: 10,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {doc.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          onClick={() => handleEliminar(doc)}
                          style={{
                            background: C.white,
                            border: `1px solid ${C.border}`,
                            borderRadius: 4,
                            padding: "3px 8px",
                            color: "#c0392b",
                            fontSize: 10,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
