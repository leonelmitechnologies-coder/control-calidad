import { useState, FormEvent } from 'react';
import { API_BASE_URL } from '../config/api';

export default function Login() {
  const [usuario,    setUsuario]    = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ usuario, contraseña: contrasena }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? 'Credenciales incorrectas');
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d2b4e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{ background: '#ffffff', width: 360, padding: '40px 40px 36px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#0d2b4e',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            margin: 0,
          }}>
            Control de Calidad
          </h1>
          <div style={{
            width: 36, height: 3, background: '#0d2b4e',
            margin: '10px auto',
          }} />
          <p style={{ fontSize: 12, color: '#777', margin: 0 }}>MI Technologies</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Usuario */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#777',
              marginBottom: 6,
            }}>
              Usuario
            </label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e2e2',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#111',
                outline: 'none',
                background: '#fff',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#0d2b4e'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = '#e2e2e2'; }}
            />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#777',
              marginBottom: 6,
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e2e2',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#111',
                outline: 'none',
                background: '#fff',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#0d2b4e'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = '#e2e2e2'; }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 11,
              background: loading ? '#1a4a7a' : '#0d2b4e',
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#1a4a7a';
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#0d2b4e';
            }}
          >
            {loading ? 'Iniciando…' : 'Entrar'}
          </button>

          {/* Error */}
          <p style={{
            color: '#c0392b',
            fontSize: 12,
            textAlign: 'center',
            marginTop: 12,
            minHeight: 18,
          }}>
            {error}
          </p>
        </form>
      </div>
    </div>
  );
}
