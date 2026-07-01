/**
 * Main App Component
 * Setup i18next, TanStack Query, routing with wouter, and layout
 */

import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch } from 'wouter';
import './config/i18n';
import Layout from './components/Layout';
import { NotifyProvider } from './context/NotifyContext';
import { ConfirmProvider } from './context/ConfirmContext';

// Page imports
import Dashboard from './pages/Dashboard';
import NoConformidades from './pages/NoConformidades';
import Recepciones from './pages/Recepciones';
import RechazosExternos from './pages/RechazosExternos';
import RechazosInternos from './pages/RechazosInternos';
import Capas from './pages/Capas';
import Aql from './pages/Aql';
import LiberacionShipping from './pages/LiberacionShipping';
import OrganigramaQc from './pages/OrganigramaQc';
import Calendario from './pages/Calendario';
import Usuarios from './pages/Usuarios';
import Manual from './pages/Manual';

// Create TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Loading fallback component
 */
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Main App Component
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotifyProvider>
        <ConfirmProvider>
          <Router>
            <Suspense fallback={<LoadingFallback />}>
            <Switch>
              {/* Protected routes with layout */}
              <Route path="/">
                {() => (
                  <Layout>
                    <Dashboard />
                  </Layout>
                )}
              </Route>

              <Route path="/nc">
                {() => (
                  <Layout>
                    <NoConformidades />
                  </Layout>
                )}
              </Route>

              <Route path="/recepciones">
                {() => (
                  <Layout>
                    <Recepciones />
                  </Layout>
                )}
              </Route>

              <Route path="/rechazos-ext">
                {() => (
                  <Layout>
                    <RechazosExternos />
                  </Layout>
                )}
              </Route>

              <Route path="/rechazos-int">
                {() => (
                  <Layout>
                    <RechazosInternos />
                  </Layout>
                )}
              </Route>

              <Route path="/capas">
                {() => (
                  <Layout>
                    <Capas />
                  </Layout>
                )}
              </Route>

              <Route path="/aql">
                {() => (
                  <Layout>
                    <Aql />
                  </Layout>
                )}
              </Route>

              <Route path="/liberacion-shipping">
                {() => (
                  <Layout>
                    <LiberacionShipping />
                  </Layout>
                )}
              </Route>

              <Route path="/organigrama-qc">
                {() => (
                  <Layout>
                    <OrganigramaQc />
                  </Layout>
                )}
              </Route>

              <Route path="/calendario">
                {() => (
                  <Layout>
                    <Calendario />
                  </Layout>
                )}
              </Route>

              <Route path="/usuarios">
                {() => (
                  <Layout>
                    <Usuarios />
                  </Layout>
                )}
              </Route>

              <Route path="/manual">
                {() => (
                  <Layout>
                    <Manual />
                  </Layout>
                )}
              </Route>

              {/* Logged-out confirmation page */}
              <Route path="/logged-out">
                {() => (
                  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
                    <div style={{ textAlign: 'center', background: '#fff', padding: '2.5rem 3rem', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
                      <p style={{ fontSize: 18, color: '#374151', marginBottom: 24 }}>Sesión cerrada correctamente.</p>
                      <a href="/api/auth/login" style={{ display: 'inline-block', padding: '10px 28px', background: '#1d4ed8', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
                        Iniciar sesión
                      </a>
                    </div>
                  </div>
                )}
              </Route>

              {/* Catch all - redirect to home */}
              <Route path="*">
                {() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/';
                  }
                  return null;
                }}
              </Route>
            </Switch>
            </Suspense>
          </Router>
        </ConfirmProvider>
      </NotifyProvider>
    </QueryClientProvider>
  );
}
