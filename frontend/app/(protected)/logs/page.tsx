"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

type Tab = "audits" | "movements" | "classifications";

export default function LogsPage() {
  const { api } = useAuth();
  const [tab, setTab] = useState<Tab>("audits");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    const endpoint =
      tab === "audits"          ? `/logs/audits?${params}&${status !== "all" ? `status=${status}` : ""}` :
      tab === "movements"       ? `/logs/movements?${params}&type=${type}` :
      `/logs/classifications?${params}`;

    api.get(endpoint).then(r => {
      setItems(r.data.items);
      setTotal(r.data.total);
      setPages(r.data.pages);
    }).catch(() => toast.error("Error cargando bitácora")).finally(() => setLoading(false));
  }, [api, tab, page, search, status, type]);

  const exportData = () => {
    const token = localStorage.getItem("sigaf_token");
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/export/${tab}?token=${token}&type=${type}&status=${status}`;
    window.open(url, "_blank");
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
        <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input text-sm hover:bg-accent transition-colors">
          <Download className="h-4 w-4" /> Exportar Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar…"
          className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring w-48" />
        {tab === "audits" && (
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="in_progress">En progreso</option>
            <option value="cancelada">Canceladas</option>
          </select>
        )}
        {tab === "movements" && (
          <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
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
                <tr><th className="text-left px-4 py-3 text-muted-foreground font-medium">Tienda</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha Inicio</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Estado</th><th className="text-right px-4 py-3 text-muted-foreground font-medium">NL</th><th className="text-right px-4 py-3 text-muted-foreground font-medium">Valor NL</th></tr>
              ) : tab === "movements" ? (
                <tr><th className="text-left px-4 py-3 text-muted-foreground font-medium">Tipo</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Equipo</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Origen</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Destino</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th></tr>
              ) : (
                <tr><th className="text-left px-4 py-3 text-muted-foreground font-medium">Clasificación</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Código</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Descripción</th><th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th></tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Sin resultados</td></tr>
              ) : items.map((item: Record<string, unknown>, i) => (
                tab === "audits" ? (
                  <tr key={String(item.id ?? i)} className="hover:bg-muted/30">
                    <td className="px-4 py-3"><div className="font-medium">{String(item.tienda)}</div><div className="text-xs text-muted-foreground">{String(item.cr_tienda)}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(String(item.started_at))}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.status === "completed" ? "bg-emerald-500/15 text-emerald-700" : item.status === "in_progress" ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"}`}>{String(item.status)}</span></td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{String(item.not_found_count)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.not_found_value as number)}</td>
                  </tr>
                ) : tab === "movements" ? (
                  <tr key={String(item.id ?? i)} className="hover:bg-muted/30">
                    <td className="px-4 py-3"><span className="text-xs font-medium uppercase">{String(item.type)}</span></td>
                    <td className="px-4 py-3 text-xs">{String((item.equipment_data as Record<string, unknown>)?.codigo_barras ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{String(item.from_tienda ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{String(item.to_tienda ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(String(item.created_at))}</td>
                  </tr>
                ) : (
                  <tr key={String(item.id ?? i)} className="hover:bg-muted/30">
                    <td className="px-4 py-3"><span className="text-xs font-medium">{String(item.classification)}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{String(item.codigo_barras)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{String((item.equipment_data as Record<string, unknown>)?.descripcion ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(String(item.scanned_at))}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="p-1.5 rounded hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm text-muted-foreground">{total} registros — Página {page} de {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page >= pages} className="p-1.5 rounded hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
