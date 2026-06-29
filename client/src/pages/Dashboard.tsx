/**
 * Dashboard Page
 * Main overview page for quality control metrics
 */

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted mt-2">Control de Calidad - Panel Principal</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-sm text-muted">Cargando...</div>
        </div>
      </div>
    </div>
  );
}
