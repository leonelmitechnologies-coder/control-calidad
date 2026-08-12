/**
 * Main App Component
 * Setup i18next, TanStack Query, routing with wouter, and layout
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Route, Router, Switch, useLocation } from "wouter";
import "./config/i18n";
import Layout from "./components/Layout";
import { ConfirmProvider } from "./context/ConfirmContext";
import { NotifyProvider } from "./context/NotifyContext";
import { useAuth } from "./hooks/useAuth";
import AdminAccess from "./pages/AdminAccess";
import Aql from "./pages/Aql";
import B2BDashboard from "./pages/B2BDashboard";
import B2CDashboard from "./pages/B2CDashboard";
import Calendario from "./pages/Calendario";
import Capas from "./pages/Capas";
// Page imports
import Dashboard from "./pages/Dashboard";
import LiberacionShipping from "./pages/LiberacionShipping";
import Login from "./pages/Login";
import Manual from "./pages/Manual";
import NoConformidades from "./pages/NoConformidades";
import OrganigramaQc from "./pages/OrganigramaQC";
import Recepciones from "./pages/Recepciones";
import RechazosExternos from "./pages/RechazosExternos";
import RechazosInternos from "./pages/RechazosInternos";
import RegistroComida from "./pages/RegistroComida";
import RequestAccess from "./pages/RequestAccess";
import Usuarios from "./pages/Usuarios";

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
 * GAC (2026-08-02): a signed-in user with no usuarios row yet (`user.pending`)
 * gets the Request Access page instead of any real route — this is the
 * client-side half of the allowlist gate (server-side enforcement is
 * requireAuth's 403 on every /api/* route; this is just so they don't stare
 * at a broken Dashboard full of failed fetches). /login is left alone so an
 * unauthenticated visitor still sees the normal login screen.
 */
function AppRoutes() {
  const [location] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  if (!loading && isAuthenticated && user?.pending && location !== "/login") {
    return <RequestAccess />;
  }

  return (
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

      <Route path="/admin/access">
        {() => (
          <Layout>
            <AdminAccess />
          </Layout>
        )}
      </Route>

      <Route path="/dashboard-b2c">
        {() => (
          <Layout>
            <B2CDashboard />
          </Layout>
        )}
      </Route>

      <Route path="/dashboard-b2b">
        {() => (
          <Layout>
            <B2BDashboard />
          </Layout>
        )}
      </Route>

      <Route path="/registro-comida">
        {() => (
          <Layout>
            <RegistroComida />
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

      {/* Login page */}
      <Route path="/login">{() => <Login />}</Route>

      {/* Fallback post-logout landing */}
      <Route path="/logged-out">
        {() => {
          window.location.href = "/login";
          return null;
        }}
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*">
        {() => {
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
          return null;
        }}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotifyProvider>
        <ConfirmProvider>
          <Router>
            <Suspense fallback={<LoadingFallback />}>
              <AppRoutes />
            </Suspense>
          </Router>
        </ConfirmProvider>
      </NotifyProvider>
    </QueryClientProvider>
  );
}
