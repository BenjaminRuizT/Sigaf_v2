'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/Layout';
import { dashboardApi, storeApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Store, Package, TrendingUp, ClipboardCheck, AlertTriangle, DollarSign } from 'lucide-react';

const COLORS = ['#1E3C78', '#2B5BA8', '#4A90D9', '#7BB5E8', '#A8D1F0', '#D6E4F7'];

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Store; color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg bg-primary/10`}>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [plazas, setPlazas] = useState<Array<{ plaza: string }>>([]);
  const [plaza, setPlaza] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storeApi.plazas().then(r => setPlazas(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    dashboardApi.stats(plaza === 'all' ? undefined : plaza)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, [plaza]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  const plazaChartData = Object.entries((stats?.equipment_by_plaza as Record<string, number>) || {})
    .map(([name, value]) => ({ name, value }));

  const fmt = (n: number) => n?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = stats as Record<string, number & string>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Resumen general del sistema</p>
          </div>
          <select value={plaza} onChange={e => setPlaza(e.target.value)}
            className="text-sm border border-input rounded-md px-3 py-2 bg-background">
            <option value="all">Todas las plazas</option>
            {plazas.map(p => <option key={p.plaza} value={p.plaza}>{p.plaza}</option>)}
          </select>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tiendas" value={s.total_stores} sub={`${s.audited_stores} auditadas`} icon={Store} />
          <StatCard label="Total Equipos" value={s.total_equipment?.toLocaleString()} sub={`${s.active_equipment} activos`} icon={Package} />
          <StatCard label="Auditorías" value={s.completed_audits} sub={`${s.active_audits} en progreso`} icon={ClipboardCheck} />
          <StatCard label="Depreciados" value={s.deprecated_equipment?.toLocaleString()} icon={AlertTriangle} />
          <StatCard label="Costo Total" value={`$${fmt(s.total_cost)}`} icon={DollarSign} />
          <StatCard label="Valor Real" value={`$${fmt(s.total_real_value)}`} icon={TrendingUp} />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Equipos por Plaza</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={plazaChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#1E3C78" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Distribución por Plaza</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={plazaChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {plazaChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top missing stores */}
        {(stats?.stores_most_missing as unknown[])?.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Tiendas con Más Faltantes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Tienda', 'Plaza', 'No Localizados', 'Valor Faltante'].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats.stores_most_missing as Array<Record<string, string | number>>).slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2 px-3 font-medium">{row.tienda as string}</td>
                      <td className="py-2 px-3 text-muted-foreground">{row.plaza as string}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                          {row.not_found_count as number}
                        </span>
                      </td>
                      <td className="py-2 px-3">${fmt(row.not_found_value as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
