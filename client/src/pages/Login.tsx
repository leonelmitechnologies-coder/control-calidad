export default function Login() {
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
      <div style={{ background: '#ffffff', width: 360, padding: '40px 40px 36px', textAlign: 'center' }}>

        {/* Branding */}
        <div style={{ marginBottom: 32 }}>
          <img src="/logo.png" alt="Logo" style={{ height: 56, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 16px' }} />
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            margin: '0 0 6px',
          }}>
            MI Technologies
          </p>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#0d2b4e',
            margin: '0 0 10px',
          }}>
            Control de Calidad
          </h1>
          <div style={{ width: 36, height: 3, background: '#0d2b4e', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Sistema de Gestión ISO 9001:2015</p>
        </div>

        {/* SSO button */}
        <a
          href="/api/auth/login"
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 0',
            background: '#0d2b4e',
            color: '#fff',
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#1a4a7a'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#0d2b4e'; }}
        >
          Iniciar sesión
        </a>

        <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 16 }}>
          Acceso mediante cuenta corporativa MI Technologies
        </p>
      </div>
    </div>
  );
}
