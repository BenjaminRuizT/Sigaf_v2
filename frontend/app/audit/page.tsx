'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/Layout';
import { auditApi, storeApi } from '@/lib/api';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';
import { ScanLine, Wifi, WifiOff, CheckCircle, AlertCircle, HelpCircle, X, Camera } from 'lucide-react';

const CLASS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  localizado: { label: 'Localizado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  sobrante: { label: 'Sobrante', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  sobrante_desconocido: { label: 'Sobrante Desconocido', color: 'bg-orange-100 text-orange-700', icon: HelpCircle },
  no_localizado: { label: 'No Localizado', color: 'bg-red-100 text-red-700', icon: X },
  already_scanned: { label: 'Ya Escaneado', color: 'bg-gray-100 text-gray-600', icon: CheckCircle },
};

export default function AuditPage() {
  const searchParams = useSearchParams();
  const [crTienda, setCrTienda] = useState(searchParams?.get('cr') || '');
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [scans, setScans] = useState<Record<string, unknown>[]>([]);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const { isOnline, addToQueue, syncQueue, getQueueForAudit } = useOfflineSync();

  const pendingOffline = audit ? getQueueForAudit(audit.id as string) : [];

  useEffect(() => {
    if (crTienda && crTienda.length >= 4) {
      startAudit(crTienda);
    }
  }, [crTienda]);

  useEffect(() => {
    if (audit && isOnline) {
      syncQueue(audit.id as string, (data) => {
        setScans(prev => [data as Record<string, unknown>, ...prev]);
      });
    }
  }, [isOnline, audit]);

  const startAudit = async (cr: string) => {
    setLoading(true);
    try {
      const { data: auditData } = await auditApi.create(cr);
      setAudit(auditData);
      const { data: scansData } = await auditApi.scans(auditData.id);
      setScans(scansData);
      barcodeRef.current?.focus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !audit) return;
    const code = barcode.trim();
    setBarcode('');

    if (!isOnline) {
      addToQueue(audit.id as string, code);
      toast.info('Sin conexión — escaneo guardado en cola offline');
      return;
    }

    setScanning(true);
    try {
      const { data } = await auditApi.scan(audit.id as string, code);
      setScans(prev => [data.scan, ...prev]);
      const cfg = CLASS_CONFIG[data.status] || CLASS_CONFIG.localizado;
      toast[data.status === 'localizado' ? 'success' : 'warning'](cfg.label);
      // Update audit counters
      setAudit(prev => prev ? {
        ...prev,
        located_count: data.status === 'localizado' ? (prev.located_count as number) + 1 : prev.located_count,
        surplus_count: ['sobrante', 'sobrante_desconocido'].includes(data.status) ? (prev.surplus_count as number) + 1 : prev.surplus_count,
      } : prev);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al escanear');
    } finally {
      setScanning(false);
      barcodeRef.current?.focus();
    }
  };

  const deleteScan = async (scanId: string, classification: string) => {
    if (!audit) return;
    try {
      await auditApi.deleteScan(audit.id as string, scanId);
      setScans(prev => prev.filter((s) => (s.id as string) !== scanId));
      setAudit(prev => prev ? {
        ...prev,
        located_count: classification === 'localizado' ? Math.max(0, (prev.located_count as number) - 1) : prev.located_count,
        surplus_count: ['sobrante', 'sobrante_desconocido'].includes(classification) ? Math.max(0, (prev.surplus_count as number) - 1) : prev.surplus_count,
      } : prev);
      toast.success('Escaneo eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  if (!audit) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Auditoría</h1>
            <p className="text-sm text-muted-foreground">Ingresa el CR de la tienda para iniciar</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <label className="text-sm font-medium">CR Tienda</label>
            <input value={crTienda} onChange={e => setCrTienda(e.target.value.toUpperCase())}
              placeholder="Ej. 31DYQ"
              className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring uppercase" />
            <button onClick={() => startAudit(crTienda)} disabled={loading || crTienda.length < 3}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">
              {loading ? 'Iniciando...' : 'Iniciar Auditoría'}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const a = audit as Record<string, string & number>;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-heading font-bold">{a.tienda}</h1>
            <p className="text-sm text-muted-foreground">{a.plaza} — {a.cr_tienda}</p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            {pendingOffline.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {pendingOffline.length} pendiente(s)
              </span>
            )}
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Localizados', value: a.located_count, color: 'text-green-600' },
            { label: 'Sobrantes', value: a.surplus_count, color: 'text-yellow-600' },
            { label: 'Total', value: a.total_equipment, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Scan form */}
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="flex-1 relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input ref={barcodeRef} value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder="Código de barras..."
              className="w-full pl-10 h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <button type="submit" disabled={scanning || !barcode.trim()}
            className="px-6 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">
            {scanning ? '...' : 'Escanear'}
          </button>
        </form>

        {/* Scan history */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Historial de Escaneos</h3>
            <span className="text-xs text-muted-foreground">{scans.length} registros</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {scans.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No hay escaneos aún.</p>
            )}
            {scans.map((scan) => {
              const sc = scan as Record<string, string & Record<string, string>>;
              const cfg = CLASS_CONFIG[sc.classification] || CLASS_CONFIG.localizado;
              const Icon = cfg.icon;
              const eq = sc.equipment_data || {};
              return (
                <div key={sc.id} className="p-3 flex items-start justify-between gap-3 hover:bg-accent/20">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sc.codigo_barras}</p>
                      <p className="text-xs text-muted-foreground truncate">{eq.descripcion || 'Sin descripción'}</p>
                      {eq.tienda && eq.tienda !== audit.cr_tienda && (
                        <p className="text-xs text-orange-600">De: {eq.tienda}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    {sc.classification !== 'no_localizado' && (
                      <button onClick={() => deleteScan(sc.id, sc.classification)}
                        className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={async () => {
            if (!confirm('¿Finalizar la auditoría?')) return;
            try {
              const { data } = await auditApi.finalize(audit.id as string);
              toast.success(`Auditoría finalizada. ${data.summary.not_found} no localizados.`);
              setAudit(data.audit);
              setScans(data.scans);
            } catch {
              toast.error('Error al finalizar');
            }
          }} disabled={a.status !== 'in_progress'}
            className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">
            Finalizar Auditoría
          </button>
          <button onClick={async () => {
            const reason = prompt('Motivo de cancelación:');
            if (!reason) return;
            try {
              await auditApi.cancel(audit.id as string, reason);
              toast.success('Auditoría cancelada');
              setAudit(null);
            } catch {
              toast.error('Error al cancelar');
            }
          }} disabled={a.status !== 'in_progress'}
            className="h-11 px-4 rounded-md border border-destructive text-destructive font-medium disabled:opacity-60 hover:bg-destructive/10">
            Cancelar
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
