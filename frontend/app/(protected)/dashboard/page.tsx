"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Store, Monitor, CheckCircle, AlertTriangle, Search, Play, Eye, DollarSign, BarChart3, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { api, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [stores, setStores] = useState<Record<string, unknown>[]>([]);
  const [plazas, setPlazas] = useState<Record<string, unknown>[]>([]);
  const [selectedPlaza, setSelectedPlaza] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, storesRes, plazasRes] = await Promise.all([
        api.get(`/dashboard/stats${selectedPlaza !== "all" ? `?plaza=${selectedPlaza}` : ""}`),
        api.get(`/stores?plaza=${selectedPlaza}&search=${search}&page=${page}&limit=30`),
        api.get("/stores/plazas"),
      ]);
      setStats(statsRes.data);
      setStores(storesRes.data.stores);
      setTotalPages(storesRes.data.pages);
      setPlazas(plazasRes.data);
    } catch {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [api, selectedPlaza, search, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const startAudit = async (crTienda: string) => {
    try {
      const { data } = await api.post("/audits", { cr_tienda: crTienda });
      router.push(`/audit/${data.id}`);
    } catch { toast.error("Error iniciando auditoría"); }
  };

  const StatCard = ({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) => (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Panel Principal</h1>
        <p className="text-sm text-muted-foreground">Bienvenido, {user?.nombre}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Tiendas" value={(stats.total_stores as number) ?? 0} icon={Store} color="bg-blue-500/10 text-blue-600" />
          <StatCard label="Tiendas Auditadas" value={(stats.audited_stores as number) ?? 0} sub={`${stats.unaudited_stores} pendientes`} icon={CheckCircle} color="bg-emerald-500/10 text-emerald-600" />
          <StatCard label="Total Equipos" value={(stats.total_equipment as number) ?? 0} sub={`${stats.deprecated_equipment} depreciados`} icon={Monitor} color="bg-purple-500/10 text-purple-600" />
          <StatCard label="Valor Real Total" value={formatCurrency(stats.total_real_value as number)} icon={DollarSign} color="bg-amber-500/10 text-amber-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar tienda por CR o nombre…"
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={selectedPlaza} onChange={e => { setSelectedPlaza(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todas las Plazas</option>
          {plazas.map((p: Record<string, unknown>) => (
            <option key={String(p.cr_plaza)} value={String(p.plaza)}>{String(p.plaza)} ({String(p.store_count)})</option>
          ))}
        </select>
      </div>

      {/* Stores table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">CR</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tienda</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Plaza</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Equipos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Cargando…</td></tr>
              ) : stores.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Sin tiendas encontradas</td></tr>
              ) : stores.map((s: Record<string, unknown>) => (
                <tr key={String(s.cr_tienda)} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{String(s.cr_tienda)}</td>
                  <td className="px-4 py-3 font-medium">{String(s.tienda)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{String(s.plaza)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">{String(s.total_equipment)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.audit_status === "in_progress" ? "bg-amber-500/15 text-amber-700" :
                      s.audited ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {s.audit_status === "in_progress" ? "En Progreso" : s.audited ? "Auditada" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.audit_status === "in_progress" ? (
                      <button onClick={() => router.push(`/audit/${s.last_audit_id}`)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 text-xs font-medium hover:bg-amber-500/20 transition-colors">
                        <Activity className="h-3.5 w-3.5" /> Continuar
                      </button>
                    ) : (
                      <button onClick={() => startAudit(String(s.cr_tienda))} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                        <Play className="h-3.5 w-3.5" /> Auditar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="p-1.5 rounded hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
