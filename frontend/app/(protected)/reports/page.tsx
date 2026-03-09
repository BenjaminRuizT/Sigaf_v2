"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingDown, Package, Store, AlertTriangle } from "lucide-react";

const COLORS = ["#2B5BA8","#34A85A","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#EC4899","#F97316"];

const Sk = ({ h = "220px" }: { h?: string }) => (
  <div className="bg-muted animate-pulse rounded-xl" style={{ height: h }} />
);

export default function ReportsPage() {
  const { api } = useAuth();
  const [data, setData]     = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/summary")
      .then(r => setData(r.data))
      .catch(() => toast.error("Error cargando reportes"))
      .finally(() => setLoading(false));
  }, [api]);

  const plazaData  = (data?.plaza_equipment  as Record<string, unknown>[]) ?? [];
  const yearData   = (data?.equipment_by_year as Record<string, unknown>[]) ?? [];
  const topMissing = (data?.top_missing_stores as Record<string, unknown>[]) ?? [];

  const totalEquipment = plazaData.reduce((s, r) => s + ((r.count as number) ?? 0), 0);
  const totalValue     = plazaData.reduce((s, r) => s + ((r.total_real as number) ?? 0), 0);
  const totalDepr      = plazaData.reduce((s, r) => s + ((r.deprecated as number) ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Reportes</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Equipos",   value: loading ? "…" : totalEquipment.toLocaleString(), icon: Package,       color: "bg-blue-500/10 text-blue-600" },
          { label: "Valor Real",      value: loading ? "…" : formatCurrency(totalValue),       icon: TrendingDown,  color: "bg-emerald-500/10 text-emerald-600" },
          { label: "Depreciados",     value: loading ? "…" : totalDepr.toLocaleString(),        icon: AlertTriangle, color: "bg-amber-500/10 text-amber-600" },
          { label: "Plazas",          value: loading ? "…" : plazaData.length,                  icon: Store,         color: "bg-purple-500/10 text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-medium text-sm mb-4">Equipos por Plaza</h3>
          {loading ? <Sk /> : plazaData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={plazaData.slice(0,12)} margin={{ left: -10, bottom: 20 }}>
                <XAxis dataKey="plaza" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), "Equipos"]} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {plazaData.slice(0,12).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-medium text-sm mb-4">Equipos por Año de Adquisición</h3>
          {loading ? <Sk /> : yearData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearData} margin={{ left: -10 }}>
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown, n: unknown) =>
                  [n === "cost" ? formatCurrency(v as number) : Number(v).toLocaleString(), n === "cost" ? "Costo" : "Equipos"]
                } />
                <Bar dataKey="count" fill="#2B5BA8" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top missing */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-medium text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          Top Tiendas con Mayor Faltante
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=>(
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}</div>
        ) : topMissing.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No hay auditorías completadas aún
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">#</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tienda</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Plaza</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">No Localizados</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Valor Faltante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topMissing.slice(0, 15).map((s, i) => (
                  <tr key={String(s.id)} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{String(s.tienda)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{String(s.plaza)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-red-600">{String(s.not_found_count)}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
                      {formatCurrency(s.not_found_value as number)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
