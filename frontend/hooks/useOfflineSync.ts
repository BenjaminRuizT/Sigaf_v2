"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const QUEUE_KEY = "sigaf_offline_scan_queue";

interface QueueEntry { id: string; audit_id: string; barcode: string; queued_at: string; }

function getQueue(): QueueEntry[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function saveQueue(q: QueueEntry[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

export function useOfflineSync() {
  const [isOnline, setIsOnline]     = useState(typeof window !== "undefined" ? navigator.onLine : true);
  const [pendingScans, setPending]  = useState<QueueEntry[]>([]);
  const [syncing, setSyncing]       = useState(false);
  const syncingRef                  = useRef(false);

  useEffect(() => {
    setPending(getQueue());
    const up   = () => setIsOnline(true);
    const down = () => { setIsOnline(false); toast.warning("Sin conexión. Los escaneos se guardarán localmente."); };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const addToQueue = useCallback((auditId: string, barcode: string): QueueEntry => {
    const entry: QueueEntry = { id: `offline_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, audit_id: auditId, barcode, queued_at: new Date().toISOString() };
    const updated = [...getQueue(), entry];
    saveQueue(updated); setPending(updated);
    return entry;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const updated = getQueue().filter(e => e.id !== id);
    saveQueue(updated); setPending(updated);
  }, []);

  const syncQueue = useCallback(async (auditId: string, onResult?: (r: unknown) => void) => {
    if (syncingRef.current) return;
    const queue = getQueue().filter(e => e.audit_id === auditId);
    if (!queue.length) return;
    syncingRef.current = true; setSyncing(true);
    toast.info(`Sincronizando ${queue.length} escaneo(s) pendiente(s)…`);
    let ok = 0; let fail = 0;
    for (const entry of queue) {
      try {
        const res = await api.post(`/audits/${entry.audit_id}/scan`, { barcode: entry.barcode });
        removeFromQueue(entry.id); ok++;
        if (onResult) onResult(res.data);
      } catch (e: unknown) {
        const err = e as { response?: unknown };
        if (err?.response) { removeFromQueue(entry.id); fail++; }
      }
    }
    syncingRef.current = false; setSyncing(false);
    if (ok)   toast.success(`${ok} escaneo(s) sincronizado(s)`);
    if (fail) toast.warning(`${fail} escaneo(s) ya procesado(s) o con error`);
  }, [removeFromQueue]);

  const getQueueForAudit   = useCallback((id: string) => pendingScans.filter(e => e.audit_id === id), [pendingScans]);
  const clearQueueForAudit = useCallback((id: string) => { const u = getQueue().filter(e => e.audit_id !== id); saveQueue(u); setPending(u); }, []);

  return { isOnline, pendingScans, syncing, addToQueue, removeFromQueue, syncQueue, getQueueForAudit, clearQueueForAudit };
}
