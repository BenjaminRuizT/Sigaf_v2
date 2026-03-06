"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { toast } from "sonner";
import { Scan, CheckCircle, AlertTriangle, XCircle, HelpCircle, ArrowLeft, WifiOff, Cloud, Loader2, Trash2, Ban, X } from "lucide-react";

const CLASS_COLORS: Record<string, string> = {
  localizado: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  sobrante: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  sobrante_desconocido: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  no_localizado: "bg-red-500/15 text-red-700 border-red-500/30",
};

export default function AuditPage() {
  const { id } = useParams<{ id: string }>();
  const { api, user } = useAuth();
  const router = useRouter();
  const { isOnline, addToQueue, syncQueue, getQueueForAudit, syncing } = useOfflineSync();

  const [audit, setAudit]     = useState<Record<string, unknown> | null>(null);
  const [scans, setScans]     = useState<Record<string, unknown>[]>([]);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [showCancel, setShowCancel]     = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAudit = useCallback(async () => {
    try {
      const [auditRes, scansRes] = await Promise.all([api.get(`/audits/${id}`), api.get(`/audits/${id}/scans`)]);
      setAudit(auditRes.data);
      setScans(scansRes.data);
    } catch { toast.error("Error cargando auditoría"); }
  }, [api, id]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  useEffect(() => {
    if (isOnline && id) syncQueue(id, (result: unknown) => {
      const r = result as Record<string, unknown>;
      if (r?.scan) setScans(prev => [r.scan as Record<string, unknown>, ...prev]);
      if (r?.audit) setAudit(r.audit as Record<string, unknown>);
    });
  }, [isOnline]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setBarcode("");
    setLoading(true);

    if (!isOnline) {
      addToQueue(id!, code);
      toast.info("Sin conexión — escaneo en cola");
      setLoading(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const { data } = await api.post(`/audits/${id}/scan`, { barcode: code });
      if (data.status === "already_scanned") { toast.warning("Código ya escaneado"); }
      else {
        setScans(prev => [data.scan, ...prev]);
        setAudit(prev => prev ? {
          ...prev,
          located_count: data.status === "localizado" ? (prev.located_count as number) + 1 : prev.located_count,
          surplus_count: data.status !== "localizado" ? (prev.surplus_count as number) + 1 : prev.surplus_count,
        } : prev);
        const icons: Record<string, string> = { localizado: "✅", sobrante: "⚠️", sobrante_desconocido: "❓" };
        const labels: Record<string, string> = { localizado: "Localizado", sobrante: "Sobrante", sobrante_desconocido: "Sobrante Desconocido" };
        toast(icons[data.status] + " " + labels[data.status]);
      }
    } catch { toast.error("Error al escanear"); }
    finally { setLoading(false); inputRef.current?.focus(); }
  };

  const handleFinalize = async () => {
    try {
      await api.post(`/audits/${id}/finalize`);
      toast.success("Auditoría finalizada");
      router.push("/dashboard");
    } catch { toast.error("Error finalizando auditoría"); }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error("Ingresa un motivo"); return; }
    try {
      await api.post(`/audits/${id}/cancel`, { reason: cancelReason });
      toast.success("Auditoría cancelada");
      router.push("/dashboard");
    } catch { toast.error("Error cancelando auditoría"); }
  };

  const deleteScan = async (scanId: string) => {
    try {
      await api.delete(`/audits/${id}/scans/${scanId}`);
      setScans(prev => prev.filter(s => s.id !== scanId));
      toast.success("Escaneo eliminado");
    } catch { toast.error("No se puede eliminar"); }
  };

  const pending = getQueueForAudit(id!);

  if (!audit) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")} className="p-1.5 rounded hover:bg-accent"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold truncate">{String(audit.tienda)}</h1>
          <p className="text-sm text-muted-foreground">{String(audit.cr_tienda)} · {String(audit.plaza)}</p>
        </div>
        {!isOnline && <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-500/15 px-2.5 py-1 rounded-full"><WifiOff className="h-3.5 w-3.5" />Sin conexión</span>}
        {isOnline && syncing && <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-500/15 px-2.5 py-1 rounded-full"><Cloud className="h-3.5 w-3.5" />Sincronizando…</span>}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Localizados", value: audit.located_count, color: "text-emerald-600", icon: CheckCircle },
          { label: "Sobrantes",   value: audit.surplus_count,  color: "text-amber-600", icon: AlertTriangle },
          { label: "Pendientes",  value: (audit.total_equipment as number) - (audit.located_count as number) - (audit.surplus_count as number), color: "text-muted-foreground", icon: HelpCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
            <p className="text-xl font-bold">{String(value)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Scan input */}
      {audit.status === "in_progress" && (
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input ref={inputRef} value={barcode} onChange={e => setBarcode(e.target.value)}
              placeholder="Escanear o ingresar código de barras…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus />
          </div>
          <button type="submit" disabled={loading || !barcode.trim()}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
          </button>
        </form>
      )}

      {/* Pending offline queue */}
      {pending.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <p className="text-sm font-medium text-amber-700">{pending.length} escaneo(s) en cola offline</p>
        </div>
      )}

      {/* Action buttons */}
      {audit.status === "in_progress" && (
        <div className="flex gap-3">
          <button onClick={() => setShowFinalize(true)} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Finalizar Auditoría
          </button>
          <button onClick={() => setShowCancel(true)} className="px-4 py-2.5 rounded-lg border border-destructive/50 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors flex items-center gap-1.5">
            <Ban className="h-4 w-4" /> Cancelar
          </button>
        </div>
      )}

      {/* Scans list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium text-sm">Historial de Escaneos ({scans.length})</div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {scans.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Sin escaneos aún</p>
          ) : scans.map((s: Record<string, unknown>) => {
            const eq = (s.equipment_data as Record<string, unknown>) || {};
            return (
              <div key={String(s.id)} className="flex items-start gap-3 px-4 py-3">
                <span className={`shrink-0 inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${CLASS_COLORS[String(s.classification)] || ""}`}>
                  {String(s.classification).replace("_"," ")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-medium">{String(s.codigo_barras)}</p>
                  {eq.descripcion && <p className="text-xs text-muted-foreground truncate">{String(eq.descripcion)} — {String(eq.marca)} {String(eq.modelo)}</p>}
                </div>
                {audit.status === "in_progress" && (
                  <button onClick={() => deleteScan(String(s.id))} className="p-1 rounded hover:bg-accent shrink-0"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Finalize Modal */}
      {showFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-sm shadow-lg">
            <h3 className="font-heading font-bold text-lg mb-2">Finalizar Auditoría</h3>
            <p className="text-sm text-muted-foreground mb-4">Los equipos no escaneados se clasificarán como <strong>No Localizados</strong>. ¿Desea continuar?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinalize(false)} className="flex-1 py-2 rounded-lg border border-input text-sm">Cancelar</button>
              <button onClick={() => { setShowFinalize(false); handleFinalize(); }} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-sm shadow-lg">
            <h3 className="font-heading font-bold text-lg mb-4 text-destructive">Cancelar Auditoría</h3>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Motivo de cancelación (requerido)…"
              className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mb-4" rows={3} />
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="flex-1 py-2 rounded-lg border border-input text-sm">Volver</button>
              <button onClick={handleCancel} className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold">Cancelar Auditoría</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
