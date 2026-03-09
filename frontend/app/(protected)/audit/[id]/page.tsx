"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scan, CheckCircle, AlertTriangle, XCircle, ArrowRightLeft, Trash2, ArrowLeft,
  FileCheck, HelpCircle, StickyNote, ArrowUpDown, X, WifiOff, RefreshCw,
  CloudOff, Cloud, Camera, PlusCircle, Ban, TrendingDown, TrendingUp, Loader2,
  Package,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface EqData {
  id?: string; descripcion?: string; marca?: string; modelo?: string; serie?: string;
  valor_real?: number; costo?: number; depreciado?: boolean; tienda?: string;
  cr_tienda?: string; plaza?: string; no_activo?: string; codigo_barras?: string;
  [k: string]: unknown;
}
interface AuditScan {
  id: string; audit_id: string; codigo_barras: string; equipment_id?: string;
  classification: string; equipment_data?: EqData; origin_store?: { cr_tienda: string; tienda: string; plaza?: string } | null;
  scanned_at?: string; scanned_by?: string; registered_manually?: boolean;
}
interface AuditData {
  id: string; tienda: string; cr_tienda: string; plaza: string; status: string;
  located_count: number; surplus_count: number; not_found_count: number;
  not_found_value?: number; total_equipment: number; notes?: string;
  cancel_reason?: string; cancelled_by?: string; auditor_name?: string;
  photo_ab?: string; photo_transf?: string;
}
interface SummaryStats {
  total_equipment: number; located_count: number; surplus_count: number;
  not_found_count: number; not_found_value: number; not_found_deprecated: number; movements_count: number;
}
interface AuditSummary {
  audit: AuditData; located: AuditScan[]; surplus: AuditScan[]; not_found: AuditScan[];
  movements: unknown[]; stats: SummaryStats;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  localizado:           "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  sobrante:             "bg-amber-500/15 text-amber-600 border-amber-500/30",
  sobrante_desconocido: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  no_localizado:        "bg-red-500/15 text-red-600 border-red-500/30",
};
const CLASS_ICONS: Record<string, React.ElementType> = {
  localizado: CheckCircle, sobrante: AlertTriangle, sobrante_desconocido: HelpCircle, no_localizado: XCircle,
};
const UNKNOWN_DESC = ["COMPUTADORA","LAPTOP","IMPRESORA","MONITOR","SERVIDOR","SWITCH","ROUTER","UPS","SCANNER","TABLET","PROYECTOR","TELEFONO IP","CAMARA","DVR/NVR","DISCO DURO EXTERNO","ACCESS POINT","IMPRESORA FISCAL","TECLADO/MOUSE","OTRO"];
const UNKNOWN_MARCA = ["EPSON","HP","DELL","LENOVO","ACER","ASUS","SAMSUNG","LG","CISCO","BROTHER","CANON","ZEBRA","HONEYWELL","APC","TOSHIBA","APPLE","HUAWEI","OTRO"];

// ── Sort hook ────────────────────────────────────────────────────────────────
function useSortable(def: string) {
  const [key, setKey] = useState(def);
  const [dir, setDir] = useState<"asc"|"desc">("asc");
  const toggle = (k: string) => { if (key === k) setDir(d => d === "asc" ? "desc" : "asc"); else { setKey(k); setDir("asc"); } };
  const sorted = <T extends Record<string, unknown>>(arr: T[]) =>
    [...arr].sort((a, b) => {
      const av = a[key] ?? "", bv = b[key] ?? "";
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  const SH = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <button onClick={() => toggle(col)} className="flex items-center gap-1 hover:text-foreground transition-colors whitespace-nowrap">
      {children}<ArrowUpDown className="h-3 w-3 opacity-40" />
    </button>
  );
  return { sorted, SH };
}

// ── Photo capture component ───────────────────────────────────────────────────
function PhotoCapture({ label, icon, onCapture, captured }: {
  label: string; icon: React.ReactNode; onCapture: (d: string) => void; captured: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startCam = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setOpen(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 100);
    } catch { setErr("No se pudo acceder a la cámara. Verifica los permisos."); }
  };
  const stopCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOpen(false);
  };
  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d")!.drawImage(v, 0, 0);
    onCapture(c.toDataURL("image/jpeg", 0.85));
    stopCam();
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 font-semibold">{icon}{label} <span className="text-red-500">*</span></Label>
      {captured ? (
        <div className="space-y-2">
          <img src={captured} alt="Foto" className="max-h-40 mx-auto rounded border object-contain" />
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={startCam}><Camera className="h-4 w-4" />Volver a tomar foto</Button>
        </div>
      ) : !open ? (
        <div>
          <Button variant="outline" className="w-full h-24 flex-col gap-2 border-dashed border-2" onClick={startCam}>
            <Camera className="h-8 w-8 opacity-50" /><span className="text-sm">Tomar foto con cámara</span>
          </Button>
          {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black border" style={{ minHeight: 200 }}>
            <video ref={videoRef} className="w-full" style={{ maxHeight: 240, display: "block" }} playsInline muted autoPlay />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={stopCam}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={capture}><Camera className="h-4 w-4" />Capturar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const fmtMoney = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

// ── Main Component ────────────────────────────────────────────────────────────
export default function AuditPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { isOnline, addToQueue, syncQueue, getQueueForAudit, syncing, removeFromQueue } = useOfflineSync();

  const [audit, setAudit]             = useState<AuditData | null>(null);
  const [scans, setScans]             = useState<AuditScan[]>([]);
  const [storeEq, setStoreEq]         = useState<EqData[]>([]);
  const [barcode, setBarcode]         = useState("");
  const [scanning, setScanning]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [finalizing, setFinalizing]   = useState(false);
  const [summary, setSummary]         = useState<AuditSummary | null>(null);
  const [activeTab, setActiveTab]     = useState("scans");

  // Dialogs
  const [finalizeDialog, setFinalizeDialog] = useState(false);
  const [cancelDialog, setCancelDialog]     = useState(false);
  const [cancelReason, setCancelReason]     = useState("");
  const [cancelling, setCancelling]         = useState(false);
  const [notesDialog, setNotesDialog]       = useState(false);
  const [notes, setNotes]                   = useState("");
  const [transferDialog, setTransferDialog] = useState<AuditScan | null>(null);
  const [disposalDialog, setDisposalDialog] = useState<AuditScan | null>(null);
  const [unknownDialog, setUnknownDialog]   = useState<AuditScan | null>(null);
  const [unknownForm, setUnknownForm]       = useState({ codigo_barras: "", descripcion: "", marca: "", modelo: "", serie: "" });
  const [savingUnknown, setSavingUnknown]   = useState(false);
  const [photoDialog, setPhotoDialog]       = useState(false);
  const [pendingFinalize, setPending]       = useState<{ hasAB: boolean; hasTransf: boolean } | null>(null);
  const [photoAB, setPhotoAB]               = useState<string | null>(null);
  const [photoTransf, setPhotoTransf]       = useState<string | null>(null);

  const eqSort = useSortable("descripcion");
  const offlineQ = getQueueForAudit(id!);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadAudit = useCallback(async () => {
    try {
      const [ar, sr] = await Promise.all([api.get(`/audits/${id}`), api.get(`/audits/${id}/scans`)]);
      const a = ar.data as AuditData;
      setAudit(a);
      setNotes(a.notes || "");
      setScans(sr.data as AuditScan[]);
      if (a.status !== "in_progress") {
        const sumR = await api.get(`/audits/${id}/summary`);
        setSummary(sumR.data as AuditSummary);
      }
    } catch { toast.error("Error cargando auditoría"); }
  }, [api, id]);

  const loadStoreEq = useCallback(async (cr: string) => {
    try {
      const r = await api.get(`/stores/${cr}/equipment`, { params: { limit: 1000 } });
      setStoreEq((r.data as { equipment: EqData[] }).equipment);
    } catch {}
  }, [api]);

  useEffect(() => { loadAudit().finally(() => setLoading(false)); }, [loadAudit]);
  useEffect(() => { if (audit?.cr_tienda) loadStoreEq(audit.cr_tienda); }, [audit?.cr_tienda, loadStoreEq]);
  useEffect(() => { if (audit?.status === "in_progress" && inputRef.current) inputRef.current.focus(); }, [audit?.status]);

  // Auto-sync when back online
  useEffect(() => {
    if (isOnline && audit?.status === "in_progress" && offlineQ.length > 0 && !syncing) {
      syncQueue(id!, (data: unknown) => {
        const d = data as { status: string; scan?: AuditScan };
        if (d.status !== "already_scanned" && d.scan) setScans(p => [d.scan!, ...p]);
        if (d.status === "localizado") setAudit(p => p ? { ...p, located_count: p.located_count + 1 } : p);
        else if (d.status === "sobrante" || d.status === "sobrante_desconocido")
          setAudit(p => p ? { ...p, surplus_count: p.surplus_count + 1 } : p);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, offlineQ.length]);

  // ── Scan ──────────────────────────────────────────────────────────────────
  const performScan = useCallback(async (bc: string) => {
    if (!bc || scanning) return;
    setScanning(true);
    if (!navigator.onLine) {
      addToQueue(id!, bc);
      toast.info(`Escaneo guardado localmente: ${bc}`);
      setScanning(false);
      inputRef.current?.focus();
      return;
    }
    try {
      const res = await api.post<{ status: string; scan: AuditScan }>(`/audits/${id}/scan`, { barcode: bc });
      const { status, scan } = res.data;
      if (status !== "already_scanned") setScans(p => [scan, ...p]);
      if (status === "localizado") {
        toast.success(`Localizado: ${bc}`);
        setAudit(p => p ? { ...p, located_count: p.located_count + 1 } : p);
      } else if (status === "sobrante") {
        toast.warning(`Sobrante: ${bc}`);
        setTransferDialog(scan);
        setAudit(p => p ? { ...p, surplus_count: p.surplus_count + 1 } : p);
      } else if (status === "sobrante_desconocido") {
        toast.warning(`Sobrante desconocido: ${bc}`);
        setAudit(p => p ? { ...p, surplus_count: p.surplus_count + 1 } : p);
        setUnknownForm({ codigo_barras: bc, descripcion: "", marca: "", modelo: "", serie: "" });
        setUnknownDialog(scan);
      } else if (status === "already_scanned") {
        toast.info("Código ya escaneado");
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      if (!e.response || e.response.status === 503) {
        addToQueue(id!, bc); toast.info(`Sin conexión. Escaneo guardado: ${bc}`);
      } else { toast.error(e.response?.data?.detail || "Error al escanear"); }
    } finally {
      setScanning(false);
      inputRef.current?.focus();
    }
  }, [scanning, api, id, addToQueue]);

  const handleScan = async () => { const bc = barcode.trim(); if (!bc) return; await performScan(bc); setBarcode(""); };

  // ── Delete scan ───────────────────────────────────────────────────────────
  const deleteScan = async (scanId: string) => {
    try {
      await api.delete(`/audits/${id}/scans/${scanId}`);
      const del = scans.find(s => s.id === scanId);
      setScans(p => p.filter(s => s.id !== scanId));
      if (del?.classification === "localizado") setAudit(p => p ? { ...p, located_count: Math.max(0, p.located_count - 1) } : p);
      else if (["sobrante","sobrante_desconocido"].includes(del?.classification || ""))
        setAudit(p => p ? { ...p, surplus_count: Math.max(0, p.surplus_count - 1) } : p);
      toast.success("Escaneo eliminado");
    } catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error"); }
  };

  // ── Transfer ──────────────────────────────────────────────────────────────
  const handleTransfer = async (scan: AuditScan) => {
    try {
      await api.post("/movements", { audit_id: id, equipment_id: scan.equipment_id, type: "transfer",
        from_cr_tienda: scan.origin_store?.cr_tienda, to_cr_tienda: audit?.cr_tienda });
      toast.success("Transferencia registrada"); setTransferDialog(null);
    } catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error"); }
  };

  // ── Disposal ──────────────────────────────────────────────────────────────
  const handleDisposal = async (scan: AuditScan) => {
    try {
      await api.post("/movements", { audit_id: id, equipment_id: scan.equipment_id, type: "baja",
        from_cr_tienda: audit?.cr_tienda, to_cr_tienda: null });
      toast.success("Baja solicitada"); setDisposalDialog(null);
    } catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error"); }
  };

  // ── Register unknown ──────────────────────────────────────────────────────
  const handleRegisterUnknown = async () => {
    if (!unknownForm.descripcion || !unknownForm.marca || !unknownForm.modelo) {
      toast.error("Completa todos los campos obligatorios"); return;
    }
    setSavingUnknown(true);
    try {
      const res = await api.post<{ equipment: EqData }>(`/audits/${id}/register-unknown-surplus`, unknownForm);
      const eq = res.data.equipment;
      setScans(p => p.map(s =>
        s.codigo_barras === unknownForm.codigo_barras
          ? { ...s, equipment_id: eq.id as string, equipment_data: eq, registered_manually: true, classification: "sobrante_desconocido" }
          : s
      ));
      toast.success(`Equipo registrado: ${eq.descripcion} · ${eq.marca} ${eq.modelo}`);
      setUnknownDialog(null);
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string | { msg: string }[] } } }).response?.data?.detail;
      toast.error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg: string }) => x.msg).join(", ") : "Error al registrar");
    } finally { setSavingUnknown(false); }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error("Debes ingresar el motivo de cancelación"); return; }
    setCancelling(true);
    try {
      await api.post(`/audits/${id}/cancel`, { reason: cancelReason.trim() });
      toast.success("Auditoría cancelada"); router.push("/dashboard");
    } catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error"); }
    finally { setCancelling(false); }
  };

  // ── Finalize ──────────────────────────────────────────────────────────────
  const handleFinalizeCheck = async () => {
    setFinalizeDialog(false);
    setFinalizing(true);
    try {
      await api.post(`/audits/${id}/finalize`);
      const [ar, sr, sumR] = await Promise.all([
        api.get(`/audits/${id}`), api.get(`/audits/${id}/scans`), api.get(`/audits/${id}/summary`),
      ]);
      setAudit(ar.data as AuditData);
      setScans(sr.data as AuditScan[]);
      const s = sumR.data as AuditSummary;
      setSummary(s);
      const movs = (s.movements || []) as { type: string }[];
      const hasAB = movs.some(m => ["alta","baja","disposal"].includes(m.type));
      const hasTransf = movs.some(m => m.type === "transfer");
      if (hasAB || hasTransf) {
        setPending({ hasAB, hasTransf });
        setPhotoAB(null); setPhotoTransf(null);
        setPhotoDialog(true);
      } else { toast.success("Auditoría completada exitosamente"); }
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string | { msg: string }[] } } }).response?.data?.detail;
      toast.error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg: string }) => x.msg).join(", ") : "Error al finalizar");
    } finally { setFinalizing(false); }
  };

  const handleSaveNotes = async () => {
    try { await api.put(`/audits/${id}/notes`, { notes }); toast.success("Notas guardadas"); setNotesDialog(false); }
    catch (err: unknown) { toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error"); }
  };

  const handleSavePhotos = async () => {
    if (pendingFinalize?.hasAB && !photoAB) { toast.error("Debes tomar la foto del formato ALTAS/BAJAS"); return; }
    if (pendingFinalize?.hasTransf && !photoTransf) { toast.error("Debes tomar la foto del formato TRANSFERENCIAS"); return; }
    try {
      const fd = new FormData();
      if (photoAB) { const r = await fetch(photoAB); fd.append("photo_ab", await r.blob(), "foto_ab.jpg"); }
      if (photoTransf) { const r = await fetch(photoTransf); fd.append("photo_transf", await r.blob(), "foto_transf.jpg"); }
      await api.post(`/audits/${id}/photos`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Fotos guardadas correctamente");
    } catch { toast.info("Fotos registradas"); }
    setPhotoDialog(false);
    toast.success("Auditoría completada exitosamente");
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!audit) return <div className="text-center py-20 text-muted-foreground">Auditoría no encontrada</div>;

  const isActive = audit.status === "in_progress";
  const scannedBarcodes = new Set(scans.filter(s => s.scanned_by !== "system").map(s => s.codigo_barras));
  const userScans = scans.filter(s => s.scanned_by !== "system");
  const unknownPending = userScans.filter(s => s.classification === "sobrante_desconocido" && !s.registered_manually);
  const totalEq = audit.total_equipment || 0;
  const realTimeNotFound = Math.max(0, totalEq - (audit.located_count || 0));

  return (
    <div className="space-y-4" data-testid="audit-page">
      {/* Finalizing overlay */}
      {finalizing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin h-14 w-14 border-4 border-primary border-t-transparent rounded-full" />
          <div className="text-center text-white">
            <p className="font-semibold text-lg">Procesando auditoría...</p>
            <p className="text-sm text-white/70 mt-1">Aplicando bajas y preparando formatos</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl md:text-3xl font-bold uppercase tracking-tight truncate">{audit.tienda}</h1>
          <p className="text-sm text-muted-foreground">CR: {audit.cr_tienda} · {audit.plaza}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="icon" onClick={() => setNotesDialog(true)} title="Notas"><StickyNote className="h-4 w-4" /></Button>
          {isActive && (
            <Button variant="outline" size="sm" onClick={() => setCancelDialog(true)}
              className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950">
              <Ban className="h-4 w-4" /> Cancelar
            </Button>
          )}
          <Badge variant="outline" className={`text-xs ${isActive ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
            audit.status === "cancelada" ? "bg-red-500/15 text-red-600 border-red-500/30" :
            "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"}`}>
            {isActive ? "En Progreso" : audit.status === "cancelada" ? "CANCELADA" : "COMPLETADA"}
          </Badge>
        </div>
      </div>

      {/* Cancellation notice */}
      {audit.status === "cancelada" && audit.cancel_reason && (
        <Card className="border-red-500/30 bg-red-500/5"><CardContent className="p-3 flex items-center gap-3">
          <Ban className="h-5 w-5 text-red-500 shrink-0" />
          <div><p className="text-sm font-medium text-red-600">Auditoría cancelada</p><p className="text-xs text-muted-foreground">Motivo: {audit.cancel_reason}</p></div>
        </CardContent></Card>
      )}

      {/* Scanner Input */}
      {isActive && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                <Input ref={inputRef} value={barcode} onChange={e => setBarcode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleScan()}
                  placeholder="Escanear o ingresar código de barras…" className="pl-11 h-14 text-lg font-mono"
                  autoComplete="off" autoFocus />
              </div>
              <Button onClick={handleScan} disabled={scanning || !barcode.trim()} className="h-14 px-6">
                {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Scan className="h-5 w-5" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offline banners */}
      {isActive && !isOnline && (
        <Card className="border-amber-500/50 bg-amber-500/10"><CardContent className="p-3 flex items-center gap-3">
          <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1"><p className="text-sm font-medium text-amber-700">Modo sin conexión</p><p className="text-xs text-amber-600/80">Los escaneos se guardarán y sincronizarán al reconectarse</p></div>
          {offlineQ.length > 0 && <Badge variant="outline" className="bg-amber-500/20 text-amber-700">{offlineQ.length} pendiente{offlineQ.length > 1 ? "s" : ""}</Badge>}
        </CardContent></Card>
      )}
      {isActive && syncing && (
        <Card className="border-blue-500/50 bg-blue-500/10"><CardContent className="p-3 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-blue-600 animate-spin shrink-0" /><p className="text-sm font-medium text-blue-700">Sincronizando escaneos...</p>
        </CardContent></Card>
      )}

      {/* Stats counters */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center">
          <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="font-mono text-2xl font-bold">{audit.located_count || 0}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Localizados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="font-mono text-2xl font-bold">{audit.surplus_count || 0}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Sobrantes</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
          <p className="font-mono text-2xl font-bold">{isActive ? realTimeNotFound : (audit.not_found_count || 0)}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">No Localizados</p>
        </CardContent></Card>
      </div>

      {/* Unknown pending alert */}
      {isActive && unknownPending.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/10"><CardContent className="p-3">
          <p className="text-sm font-medium text-orange-700 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {unknownPending.length} equipo(s) sobrante(s) desconocido(s) pendiente(s) de registrar
          </p>
          <div className="mt-2 space-y-1">
            {unknownPending.map(scan => (
              <div key={scan.id} className="flex items-center justify-between bg-orange-500/10 rounded px-2 py-1">
                <span className="font-mono text-xs text-orange-700">{scan.codigo_barras}</span>
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1 border-orange-400"
                  onClick={() => { setUnknownForm({ codigo_barras: scan.codigo_barras, descripcion: "", marca: "", modelo: "", serie: "" }); setUnknownDialog(scan); }}>
                  <PlusCircle className="h-3 w-3" /> Registrar
                </Button>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Active audit tabs */}
      {isActive && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <TabsList>
              <TabsTrigger value="scans">Historial ({userScans.length + offlineQ.length})</TabsTrigger>
              <TabsTrigger value="equipment">Inventario Tienda ({totalEq})</TabsTrigger>
            </TabsList>
            <Button variant="destructive" size="sm" onClick={() => setFinalizeDialog(true)} className="gap-2">
              <FileCheck className="h-4 w-4" /> Finalizar Auditoría
            </Button>
          </div>

          <TabsContent value="scans">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {offlineQ.map(entry => (
                  <Card key={entry.id} className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-3 flex items-center gap-3">
                      <CloudOff className="h-5 w-5 shrink-0 text-amber-500" />
                      <div className="flex-1 min-w-0"><p className="font-mono text-sm font-medium">{entry.barcode}</p><p className="text-xs text-amber-600">Pendiente de sincronización</p></div>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-600">Offline</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromQueue(entry.id)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                    </CardContent>
                  </Card>
                ))}
                {userScans.map((scan) => {
                  const Icon = CLASS_ICONS[scan.classification] || Package;
                  return (
                    <Card key={scan.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Icon className={`h-5 w-5 shrink-0 ${scan.classification === "localizado" ? "text-emerald-500" : scan.classification === "sobrante" ? "text-amber-500" : "text-orange-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium">{scan.codigo_barras}</p>
                          {scan.registered_manually && scan.equipment_data ? (
                            <p className="text-xs text-emerald-600 font-medium">✓ {scan.equipment_data.descripcion} · {scan.equipment_data.marca} {scan.equipment_data.modelo}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground truncate">
                              {scan.equipment_data?.descripcion || (scan.classification === "sobrante_desconocido" ? "Pendiente de registrar" : "—")}
                              {scan.equipment_data?.marca ? ` · ${scan.equipment_data.marca}` : ""}
                            </p>
                          )}
                        </div>
                        <Badge className={`text-[10px] ${CLASS_COLORS[scan.classification] || ""}`}>
                          {scan.classification === "localizado" ? "Localizado" : scan.classification === "sobrante" ? "Sobrante" : "S. Desconocido"}
                        </Badge>
                        {scan.classification === "sobrante" && (
                          <Button variant="outline" size="sm" onClick={() => setTransferDialog(scan)}><ArrowRightLeft className="h-3.5 w-3.5" /></Button>
                        )}
                        {scan.classification === "sobrante_desconocido" && !scan.registered_manually && (
                          <Button variant="outline" size="sm" className="border-orange-400"
                            onClick={() => { setUnknownForm({ codigo_barras: scan.codigo_barras, descripcion: "", marca: "", modelo: "", serie: "" }); setUnknownDialog(scan); }}>
                            <PlusCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteScan(scan.id)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {userScans.length === 0 && offlineQ.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground"><Scan className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Escanea el código de barras para comenzar</p></div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="equipment">
            <div className="rounded-md border overflow-x-auto">
              <Table style={{ minWidth: 820 }}>
                <TableHeader><TableRow>
                  <TableHead className="w-10">Estado</TableHead>
                  <TableHead><eqSort.SH col="codigo_barras">Código</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="descripcion">Descripción</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="marca">Marca</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="modelo">Modelo</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="serie">Serie</eqSort.SH></TableHead>
                  <TableHead className="text-right"><eqSort.SH col="valor_real">Valor Real</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="depreciado">Depr.</eqSort.SH></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {eqSort.sorted(storeEq as Record<string, unknown>[]).map((eq) => {
                    const e = eq as EqData;
                    const isScanned = scannedBarcodes.has(e.codigo_barras!);
                    return (
                      <TableRow key={e.id as string} className={isScanned ? "bg-emerald-500/5" : ""}>
                        <TableCell>{isScanned ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{e.codigo_barras}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap max-w-[160px] truncate">{e.descripcion}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{e.marca}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{e.modelo}</TableCell>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{e.serie || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">{fmtMoney(e.valor_real!)}</TableCell>
                        <TableCell><Badge variant={e.depreciado ? "destructive" : "outline"} className="text-[10px]">{e.depreciado ? "Sí" : "No"}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Completed audit summary */}
      {!isActive && summary && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="notfound">No Localizados ({summary.stats?.not_found_count || 0})</TabsTrigger>
            <TabsTrigger value="surplus">Sobrantes ({summary.stats?.surplus_count || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Equipos", value: summary.stats?.total_equipment || 0, color: "" },
                { label: "Localizados", value: summary.stats?.located_count || 0, color: "text-emerald-500" },
                { label: "Sobrantes", value: summary.stats?.surplus_count || 0, color: "text-amber-500" },
                { label: "No Localizados", value: summary.stats?.not_found_count || 0, color: "text-red-500" },
              ].map(({ label, value, color }) => (
                <Card key={label}><CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase">{label}</p>
                  <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
                </CardContent></Card>
              ))}
            </div>
            <Card className="mt-4"><CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor No Localizado</span><span className="font-mono font-bold text-red-500">{fmtMoney(summary.stats?.not_found_value)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Depreciados No Localizados</span><span className="font-mono font-bold">{summary.stats?.not_found_deprecated || 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Movimientos Generados</span><span className="font-mono font-bold">{summary.stats?.movements_count || 0}</span></div>
            </CardContent></Card>
            <Button className="mt-4" onClick={() => router.push("/dashboard")}><ArrowLeft className="h-4 w-4 mr-2" />Volver al Dashboard</Button>
            {(audit.photo_ab || audit.photo_transf) && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Formatos de Movimiento</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {audit.photo_ab && <Card><CardContent className="p-3 space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /><TrendingDown className="h-3.5 w-3.5 text-red-500" /> Formato ALTAS / BAJAS</p>
                    <img src={`data:image/jpeg;base64,${audit.photo_ab}`} alt="Formato AB" className="w-full rounded border object-contain max-h-48" />
                  </CardContent></Card>}
                  {audit.photo_transf && <Card><CardContent className="p-3 space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" /> Formato TRANSFERENCIAS</p>
                    <img src={`data:image/jpeg;base64,${audit.photo_transf}`} alt="Formato Transf" className="w-full rounded border object-contain max-h-48" />
                  </CardContent></Card>}
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="notfound">
            <div className="rounded-md border overflow-x-auto">
              <Table style={{ minWidth: 680 }}>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Descripción</TableHead><TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead><TableHead className="text-right">Valor Real</TableHead>
                  <TableHead>Depr.</TableHead><TableHead>Acciones</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(summary.not_found || []).map(scan => { const eq = scan.equipment_data || {}; return (
                    <TableRow key={scan.id}>
                      <TableCell className="font-mono text-xs">{scan.codigo_barras}</TableCell>
                      <TableCell className="text-sm">{eq.descripcion}</TableCell>
                      <TableCell className="text-sm">{eq.marca}</TableCell>
                      <TableCell className="text-sm">{eq.modelo}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtMoney(eq.valor_real!)}</TableCell>
                      <TableCell><Badge variant={eq.depreciado ? "destructive" : "outline"} className="text-[10px]">{eq.depreciado ? "Sí" : "No"}</Badge></TableCell>
                      <TableCell>{eq.depreciado && <Button variant="outline" size="sm" onClick={() => setDisposalDialog(scan)}><Trash2 className="h-3.5 w-3.5 mr-1" />Baja</Button>}</TableCell>
                    </TableRow>
                  ); })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="surplus">
            <div className="rounded-md border overflow-x-auto">
              <Table style={{ minWidth: 600 }}>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Descripción</TableHead><TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead><TableHead>Tienda Origen</TableHead><TableHead>Clasificación</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(summary.surplus || []).map(scan => { const eq = scan.equipment_data || {}; return (
                    <TableRow key={scan.id}>
                      <TableCell className="font-mono text-xs">{scan.codigo_barras}</TableCell>
                      <TableCell className="text-sm">{eq.descripcion || "—"}</TableCell>
                      <TableCell className="text-sm">{eq.marca || "—"}</TableCell>
                      <TableCell className="text-sm">{eq.modelo || "—"}</TableCell>
                      <TableCell className="text-sm">{scan.origin_store?.tienda || "—"}</TableCell>
                      <TableCell><Badge className={CLASS_COLORS[scan.classification] || ""}>{scan.classification === "sobrante" ? "Sobrante" : "S. Desconocido"}</Badge></TableCell>
                    </TableRow>
                  ); })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* ── DIALOGS ── */}

      {/* Cancel */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase tracking-tight text-red-600">Cancelar Auditoría</DialogTitle>
          <DialogDescription>Indica el motivo de cancelación para que quede registrado.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3 space-y-1"><p className="text-sm font-medium">{audit.tienda}</p><p className="text-xs text-muted-foreground">CR: {audit.cr_tienda} · {audit.plaza}</p></div>
            <div className="space-y-1.5"><Label>Motivo de cancelación <span className="text-red-500">*</span></Label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Describe el motivo…" rows={3} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelDialog(false); setCancelReason(""); }} disabled={cancelling}>Cerrar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()} className="gap-2">
              <Ban className="h-4 w-4" />{cancelling ? "Cancelando..." : "Cancelar Auditoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer */}
      <Dialog open={!!transferDialog} onOpenChange={() => setTransferDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase tracking-tight">Transferencia</DialogTitle>
          <DialogDescription>Registrar movimiento de transferencia entre tiendas</DialogDescription></DialogHeader>
          {transferDialog && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 space-y-1.5"><p className="text-xs text-muted-foreground uppercase">Equipo</p>
                <p className="font-mono text-sm">{transferDialog.codigo_barras}</p>
                <p className="text-sm">{transferDialog.equipment_data?.descripcion} · {transferDialog.equipment_data?.marca}</p></div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground uppercase">Tienda Origen</p><p className="text-sm font-medium mt-1">{transferDialog.origin_store?.tienda}</p></div>
                <ArrowRightLeft className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground uppercase">Tienda Destino</p><p className="text-sm font-medium mt-1">{audit.tienda}</p></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransferDialog(null)}>Cancelar</Button>
            <Button onClick={() => handleTransfer(transferDialog!)} className="gap-2"><ArrowRightLeft className="h-4 w-4" />Confirmar Transferencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unknown Surplus */}
      <Dialog open={!!unknownDialog} onOpenChange={(open) => { if (!open && !savingUnknown) setUnknownDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2"><PlusCircle className="h-5 w-5 text-orange-500" />Sobrante Desconocido — Registrar ALTA</DialogTitle>
            <DialogDescription>Este equipo no está en el MAF. Registra sus datos para catalogarlo como ALTA en {audit.tienda}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase mb-0.5">Código de barras</p>
              <p className="font-mono text-sm font-bold text-orange-600">{unknownForm.codigo_barras}</p>
            </div>
            <div className="space-y-1.5"><Label>Descripción <span className="text-red-500">*</span></Label>
              <Select value={unknownForm.descripcion} onValueChange={v => setUnknownForm(f => ({ ...f, descripcion: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo de equipo..." /></SelectTrigger>
                <SelectContent>{UNKNOWN_DESC.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Marca <span className="text-red-500">*</span></Label>
              <Select value={unknownForm.marca} onValueChange={v => setUnknownForm(f => ({ ...f, marca: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar marca..." /></SelectTrigger>
                <SelectContent>{UNKNOWN_MARCA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Modelo <span className="text-red-500">*</span></Label>
              <Input value={unknownForm.modelo} onChange={e => setUnknownForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ej. FX890II..." /></div>
            <div className="space-y-1.5"><Label>Número de Serie</Label>
              <Input value={unknownForm.serie} onChange={e => setUnknownForm(f => ({ ...f, serie: e.target.value }))} placeholder="Opcional" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnknownDialog(null)} disabled={savingUnknown}>Cancelar</Button>
            <Button onClick={handleRegisterUnknown} disabled={savingUnknown} className="gap-2">
              <TrendingUp className="h-4 w-4" />{savingUnknown ? "Registrando..." : "Registrar como ALTA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize */}
      <Dialog open={finalizeDialog} onOpenChange={setFinalizeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase tracking-tight">Finalizar Auditoría</DialogTitle>
          <DialogDescription>¿Está seguro de finalizar? Los equipos no escaneados quedarán como No Localizados.</DialogDescription></DialogHeader>
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm">Escaneados: <span className="font-mono font-bold">{userScans.length}</span></p>
            <p className="text-sm">Total equipos: <span className="font-mono font-bold">{totalEq}</span></p>
            <p className="text-sm text-amber-600">No localizados: <span className="font-mono font-bold">{realTimeNotFound}</span></p>
            {realTimeNotFound > 0 && <p className="text-xs text-muted-foreground">Los equipos no localizados serán dados de BAJA automáticamente.</p>}
            {unknownPending.length > 0 && <p className="text-sm text-orange-600 font-medium">⚠ {unknownPending.length} sobrante(s) desconocido(s) sin registrar.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFinalizeDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleFinalizeCheck} className="gap-2"><FileCheck className="h-4 w-4" />Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disposal */}
      <Dialog open={!!disposalDialog} onOpenChange={() => setDisposalDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase tracking-tight">Solicitar Baja</DialogTitle></DialogHeader>
          {disposalDialog && (
            <div className="bg-muted rounded-lg p-3 space-y-1.5">
              <p className="font-mono text-sm">{disposalDialog.codigo_barras}</p>
              <p className="text-sm">{disposalDialog.equipment_data?.descripcion}</p>
              <p className="text-sm text-muted-foreground">Valor: {fmtMoney(disposalDialog.equipment_data?.valor_real!)}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisposalDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => handleDisposal(disposalDialog!)} className="gap-2"><TrendingDown className="h-4 w-4" />Solicitar Baja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes */}
      <Dialog open={notesDialog} onOpenChange={setNotesDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase tracking-tight">Notas de Auditoría</DialogTitle></DialogHeader>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Agregue notas sobre la auditoría..." rows={5} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotesDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveNotes}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo capture */}
      <Dialog open={photoDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2"><Camera className="h-5 w-5 text-primary" />Foto de Formato de Movimiento</DialogTitle>
            <DialogDescription>Es <strong>obligatorio</strong> tomar foto del formato de movimiento de activo para finalizar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {pendingFinalize?.hasAB && (
              <PhotoCapture label="Formato ALTAS y/o BAJAS"
                icon={<><TrendingUp className="h-4 w-4 text-emerald-500" /><TrendingDown className="h-4 w-4 text-red-500" /></>}
                onCapture={setPhotoAB} captured={photoAB} />
            )}
            {pendingFinalize?.hasTransf && (
              <PhotoCapture label="Formato TRANSFERENCIAS"
                icon={<ArrowRightLeft className="h-4 w-4 text-blue-500" />}
                onCapture={setPhotoTransf} captured={photoTransf} />
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSavePhotos} className="w-full gap-2"
              disabled={(pendingFinalize?.hasAB && !photoAB) || (pendingFinalize?.hasTransf && !photoTransf)}>
              <Camera className="h-4 w-4" />Guardar Fotos y Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
