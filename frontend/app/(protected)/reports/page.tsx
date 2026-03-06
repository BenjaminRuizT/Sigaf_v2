"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#2B5BA8","#34A85A","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#EC4899"];

export default function ReportsPage() {
  const { api } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reports/summary").then(r => setData(r.data)).catch(() => toast.error("Error cargando reportes")).finally(() => setLoading(false));
  }, [api]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando reportes…</div>;
  if (!data) return null;

  const plazaData = (data.plaza_equipment as Record<string, unknown>[]) || [];
  const yearData  = (data.equipment_by_year as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Reportes</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Equipment by Plaza bar chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-medium text-sm mb-4">Equipos por Plaza</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plazaData.slice(0,10)} margin={{left:-10}}>
              <XAxis dataKey="plaza" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip />
              <Bar dataKey="count" fill="#2B5BA8" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Equipment by year */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-medium text-sm mb-4">Equipos por Año de Adquisición</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yearData} margin={{left:-10}}>
              <XAxis dataKey="year" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip formatter={(v, n) => n === "cost" ? formatCurrency(v as number) : v} />
              <Bar dataKey="count" fill="#34A85A" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top missing stores */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-medium text-sm">Top Tiendas con Mayor Faltante</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tienda</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Plaza</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">No Localizados</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Valor Faltante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((data.top_missing_stores as Record<string, unknown>[]) || []).map((s: Record<string, unknown>) => (
                <tr key={String(s.id)} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{String(s.tienda)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{String(s.plaza)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{String(s.not_found_count)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(s.not_found_value as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
