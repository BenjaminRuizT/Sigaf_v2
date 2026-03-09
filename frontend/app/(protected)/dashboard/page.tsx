"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import {
  Store, Monitor, CheckCircle, DollarSign,
  Search, Play, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Stats {
  total_stores: number; audited_stores: number; unaudited_stores: number;
  total_equipment: number; deprecated_equipment: number;
  total_real_value: number; active_audits: number; completed_audits: number;
}
interface StoreRow {
  cr_tienda: string; tienda: string; plaza: string;
  total_equipment: number; audited: boolean;
  audit_status: string | null; last_audit_id: string | null;
}
interface Plaza { cr_plaza: string; plaza: string; store_count: number; }

// Skeleton shimmer
const Sk = ({ w = "full", h = "4" }: { w?: string; h?: string }) => (
  <div className={`w-${w} h-${h} rounded bg-muted animate-pulse`} />
);

const StatCard = ({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; loading?: boolean;
}) => (
  <div className="bg-card border border-border rounded-xl p-5">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {loading
          ? <div className="mt-2 h-7 w-20 rounded bg-muted animate-pulse" />
          : <p className="text-2xl font-bold mt-1 truncate">{value}</p>}
        {sub && !loading && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className={`p-2 rounded-lg shrink-0 ml-3 ${color}`}><Icon className="h-5 w-5" /></div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { api, user } = useAuth();
  const router = useRouter();

  const [stats, setStats]               = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stores, setStores]             = useState<StoreRow[]>([]);
  const [plazas, setPlazas]             = useState<Plaza[]>([]);
  const [selectedPlaza, setSelectedPlaza] = useState("all");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [storesLoading, setStoresLoading] = useState(true);

  const debouncedSearch = useDebounce(search, 400);

  // Stats load independently — fast parallel queries
  useEffect(() => {
    setStatsLoading(true);
    const q = selectedPlaza !== "all" ? `?plaza=${selectedPlaza}` : "";
    api.get(`/dashboard/stats${q}`)
      .then(r => setStats(r.data))
      .catch(() => toast.error("Error cargando estadísticas"))
      .finally(() => setStatsLoading(false));
  }, [api, selectedPlaza]);

  // Plazas load once
  useEffect(() => {
    api.get("/stores/plazas").then(r => setPlazas(r.data)).catch(() => {});
  }, [api]);

  // Stores load with debounced search
  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    try {
      const params = new URLSearchParams({
        plaza: selectedPlaza, search: debouncedSearch,
        page: String(page), limit: "30",
      });
      const r = await api.get(`/stores?${params}`);
      setStores(r.data.stores);
      setTotalPages(r.data.pages);
    } catch {
      toast.error("Error cargando tiendas");
    } finally {
      setStoresLoading(false);
    }
  }, [api, selectedPlaza, debouncedSearch, page]);

  useEffect(() => { loadStores(); }, [loadStores]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [selectedPlaza, debouncedSearch]);

  const startAudit = async (crTienda: string) => {
    try {
      const { data } = await api.post("/audits", { cr_tienda: crTienda });
      router.push(`/audit/${data.id}`);
    } catch { toast.error("Error iniciando auditoría"); }
  };

  const progress = stats
    ? Math.round((stats.audited_stores / Math.max(stats.total_stores, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Panel Principal</h1>
        <p className="text-sm text-muted-foreground">Bienvenido, {user?.nombre}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tiendas"   loading={statsLoading}
          value={stats?.total_stores ?? 0}
          icon={Store} color="bg-blue-500/10 text-blue-600" />
        <StatCard label="Auditadas" loading={statsLoading}
          value={stats?.audited_stores ?? 0}
          sub={stats ? `${stats.unaudited_stores} pendientes` : undefined}
          icon={CheckCircle} color="bg-emerald-500/10 text-emerald-600" />
        <StatCard label="Total Equipos" loading={statsLoading}
          value={stats?.total_equipment ?? 0}
          sub={stats ? `${stats.deprecated_equipment} depreciados` : undefined}
          icon={Monitor} color="bg-purple-500/10 text-purple-600" />
        <StatCard label="Valor Real Total" loading={statsLoading}
          value={stats ? formatCurrency(stats.total_real_value) : "$0"}
          icon={DollarSign} color="bg-amber-500/10 text-amber-600" />
      </div>

      {/* Progress bar */}
      {!statsLoading && stats && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso de Auditoría</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>{stats.audited_stores} completadas</span>
            <span>{stats.active_audits} en progreso</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tienda por CR o nombre…"
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={selectedPlaza}
          onChange={e => setSelectedPlaza(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todas las Plazas</option>
          {plazas.map(p => (
            <option key={p.cr_plaza} value={p.plaza}>{p.plaza} ({p.store_count})</option>
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
              {storesLoading ? (
                // Skeleton rows
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Sk w="16" /></td>
                    <td className="px-4 py-3"><Sk w="40" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Sk w="24" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Sk w="8" /></td>
                    <td className="px-4 py-3"><Sk w="20" h="5" /></td>
                    <td className="px-4 py-3 text-right"><Sk w="16" h="7" /></td>
                  </tr>
                ))
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Sin tiendas encontradas
                  </td>
                </tr>
              ) : stores.map(s => (
                <tr key={s.cr_tienda} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.cr_tienda}</td>
                  <td className="px-4 py-3 font-medium">{s.tienda}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{s.plaza}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{s.total_equipment}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.audit_status === "in_progress" ? "bg-amber-500/15 text-amber-700" :
                      s.audited ? "bg-emerald-500/15 text-emerald-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {s.audit_status === "in_progress" ? "En Progreso" :
                       s.audited ? "Auditada" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.audit_status === "in_progress" ? (
                      <button
                        onClick={() => router.push(`/audit/${s.last_audit_id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                      >
                        <Activity className="h-3.5 w-3.5" /> Continuar
                      </button>
                    ) : (
                      <button
                        onClick={() => startAudit(s.cr_tienda)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                      >
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
