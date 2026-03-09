"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

type Tab = "audits" | "movements" | "classifications";

const Sk = () => (
  <tr>{Array.from({length:5}).map((_,i)=>(
    <td key={i} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse" /></td>
  ))}</tr>
);

const STATUS_LABEL: Record<string, string> = {
  completed: "Completada", in_progress: "En Progreso", cancelada: "Cancelada",
};
const STATUS_COLOR: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-700",
  in_progress: "bg-amber-500/15 text-amber-700",
  cancelada: "bg-red-500/15 text-red-700",
};

export default function LogsPage() {
  const { api } = useAuth();
  const [tab, setTab]       = useState<Tab>("audits");
  const [items, setItems]   = useState<Record<string, unknown>[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType]     = useState("all");
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => { setPage(1); }, [tab, debouncedSearch, status, type]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    const endpoint =
      tab === "audits"          ? `/logs/audits?${params}&${status !== "all" ? `status=${status}` : ""}` :
      tab === "movements"       ? `/logs/movements?${params}&type=${type}` :
      `/logs/classifications?${params}`;

    api.get(endpoint)
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error("Error cargando bitácora"))
      .finally(() => setLoading(false));
  }, [api, tab, page, debouncedSearch, status, type]);

  const exportData = () => {
    const token = localStorage.getItem("sigaf_token");
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL}/api/export/${tab}?token=${token}&type=${type}&status=${status}`,
      "_blank"
    );
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "audits", label: "Auditorías" },
    { key: "movements", label: "Movimientos" },
    { key: "classifications", label: "Clasificaciones" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Bitácoras</h1>
        <button onClick={exportData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input text-sm hover:bg-accent transition-colors">
          <Download className="h-4 w-4" /> Exportar Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring w-48" />
        </div>
        {tab === "audits" && (
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="in_progress">En progreso</option>
            <option value="cancelada">Canceladas</option>
          </select>
        )}
        {tab === "movements" && (
          <select value={type} onChange={e => setType(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos los tipos</option>
            <option value="altas">Altas</option>
            <option value="bajas">Bajas</option>
            <option value="transferencias">Transferencias</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              {tab === "audits" ? (
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tienda</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Plaza</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Estado</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">NL</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Valor NL</th>
                </tr>
              ) : tab === "movements" ? (
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Equipo</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Origen</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Destino</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                </tr>
              ) : (
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Clasificación</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Código</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Descripción</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({length: 6}).map((_, i) => <Sk key={i} />)
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Sin resultados</td></tr>
              ) : items.map((item, i) => (
                tab === "audits" ? (
                  <tr key={String(item.id ?? i)} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{String(item.tienda)}</div>
                      <div className="text-xs text-muted-foreground">{String(item.cr_tienda)}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{String(item.plaza ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(String(item.started_at))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[String(item.status)] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABEL[String(item.status)] ?? String(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{String(item.not_found_count ?? 0)}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">{formatCurrency(item.not_found_value as number)}</td>
                  </tr>
                ) : tab === "movements" ? (
                  <tr key={String(item.id ?? i)} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">{String(item.type)}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{String((item.equipment_data as Record<string, unknown>)?.codigo_barras ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{String(item.from_tienda ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{String(item.to_tienda ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(String(item.created_at))}</td>
                  </tr>
                ) : (
                  <tr key={String(item.id ?? i)} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        String(item.classification) === "localizado" ? "bg-emerald-500/15 text-emerald-700" :
                        String(item.classification) === "sobrante"   ? "bg-amber-500/15 text-amber-700" :
                        "bg-red-500/15 text-red-700"
                      }`}>{String(item.classification)}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{String(item.codigo_barras)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{String((item.equipment_data as Record<string, unknown>)?.descripcion ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(String(item.scanned_at))}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">{total} registros — Pág. {page}/{pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page >= pages}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
