"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, PlusCircle, Pencil, Trash2, Search, ArrowUpDown, Eye, EyeOff,
  Box, AlertTriangle, Download, Upload, Loader2, RefreshCw, Check, X, FileSpreadsheet,
  DatabaseZap, ShieldAlert,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppUser { id: string; nombre: string; email: string; perfil: string; activo: boolean; created_at?: string; }
interface Equipment {
  id: string; codigo_barras: string; no_activo?: string; descripcion: string; marca: string; modelo: string;
  serie?: string; costo: number; valor_real: number; depreciado: boolean; plaza: string; tienda: string; cr_tienda: string;
  anio_adquisicion?: number;
}

const PROFILES = ["Técnico", "Administrador", "Super Administrador"];
const EMPTY_USER = { nombre: "", email: "", password: "", perfil: "Técnico", activo: true };
const EMPTY_EQ = { descripcion: "", marca: "", modelo: "", serie: "", costo: "", depreciado: false as boolean };

// ── Sort hook ─────────────────────────────────────────────────────────────────
function useSortable(def: string, defDir: "asc" | "desc" = "asc") {
  const [key, setKey] = useState(def);
  const [dir, setDir] = useState<"asc" | "desc">(defDir);
  const toggle = (k: string) => { if (key === k) setDir(d => d === "asc" ? "desc" : "asc"); else { setKey(k); setDir("asc"); } };
  const sorted = <T extends Record<string, unknown>>(arr: T[]) =>
    [...arr].sort((a, b) => {
      const av = a[key] ?? "", bv = b[key] ?? "";
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  const SH = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <button onClick={() => toggle(col)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap text-xs font-medium uppercase">
      {children}<ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  );
  return { sorted, SH };
}

// ── Admin Page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user: authUser, api } = useAuth();
  const isSuperAdmin = authUser?.perfil === "Super Administrador";

  // Users
  const [users, setUsers]               = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch]     = useState("");
  const [userDialog, setUserDialog]     = useState(false);
  const [editingUser, setEditingUser]   = useState<AppUser | null>(null);
  const [userForm, setUserForm]         = useState(EMPTY_USER);
  const [showPwd, setShowPwd]           = useState(false);
  const [savingUser, setSavingUser]     = useState(false);
  const [deleteUser, setDeleteUser]     = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const userSort = useSortable("nombre");

  // Equipment
  const [equipment, setEquipment]           = useState<Equipment[]>([]);
  const [eqLoading, setEqLoading]           = useState(false);
  const [eqSearch, setEqSearch]             = useState("");
  const [eqPlazaFilter, setEqPlazaFilter]   = useState("all");
  const [eqPage, setEqPage]                 = useState(1);
  const [eqTotal, setEqTotal]               = useState(0);
  const [editingEq, setEditingEq]           = useState<Equipment | null>(null);
  const [eqForm, setEqForm]                 = useState(EMPTY_EQ);
  const [savingEq, setSavingEq]             = useState(false);
  const [plazas, setPlazas]                 = useState<string[]>([]);
  const eqSort = useSortable("descripcion");
  const EQ_PAGE_SIZE = 20;

  // Reset data
  const [resetDialog, setResetDialog]     = useState(false);
  const [mafFile, setMafFile]             = useState<File | null>(null);
  const [usersFile, setUsersFile]         = useState<File | null>(null);
  const [resetting, setResetting]         = useState(false);
  const [resetConfirm, setResetConfirm]   = useState("");
  const [dragOverMaf, setDragOverMaf]     = useState(false);
  const [dragOverUsers, setDragOverUsers] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers((await api.get<AppUser[]>("/admin/users")).data); }
    catch { toast.error("Error cargando usuarios"); }
    finally { setUsersLoading(false); }
  }, [api]);

  const loadEquipment = useCallback(async () => {
    setEqLoading(true);
    try {
      const params: Record<string, unknown> = { page: eqPage, page_size: EQ_PAGE_SIZE };
      if (eqSearch.trim()) params.search = eqSearch.trim();
      if (eqPlazaFilter !== "all") params.plaza = eqPlazaFilter;
      const { data } = await api.get<{ equipment: Equipment[]; total: number; plazas?: string[] }>("/admin/equipment", { params });
      setEquipment(data.equipment);
      setEqTotal(data.total);
      if (data.plazas?.length) setPlazas(data.plazas);
    } catch { toast.error("Error cargando equipos"); }
    finally { setEqLoading(false); }
  }, [api, eqPage, eqSearch, eqPlazaFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── User CRUD ─────────────────────────────────────────────────────────────
  const openCreateUser = () => { setEditingUser(null); setUserForm(EMPTY_USER); setShowPwd(false); setUserDialog(true); };
  const openEditUser = (u: AppUser) => { setEditingUser(u); setUserForm({ nombre: u.nombre, email: u.email, password: "", perfil: u.perfil, activo: u.activo }); setShowPwd(false); setUserDialog(true); };
  const handleSaveUser = async () => {
    if (!userForm.nombre.trim() || !userForm.email.trim()) { toast.error("Nombre y email son requeridos"); return; }
    if (!editingUser && !userForm.password.trim()) { toast.error("La contraseña es requerida para usuarios nuevos"); return; }
    setSavingUser(true);
    try {
      const payload: Record<string, unknown> = { nombre: userForm.nombre.trim(), email: userForm.email.trim(), perfil: userForm.perfil, activo: userForm.activo };
      if (userForm.password.trim()) payload.password = userForm.password.trim();
      if (editingUser) await api.put(`/admin/users/${editingUser.id}`, payload);
      else await api.post("/admin/users", payload);
      toast.success(editingUser ? "Usuario actualizado" : "Usuario creado");
      setUserDialog(false);
      await loadUsers();
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(d || "Error al guardar usuario");
    } finally { setSavingUser(false); }
  };
  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setDeletingUser(true);
    try {
      await api.delete(`/admin/users/${deleteUser.id}`);
      toast.success("Usuario eliminado");
      setDeleteUser(null);
      await loadUsers();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error");
    } finally { setDeletingUser(false); }
  };

  // ── Equipment edit ────────────────────────────────────────────────────────
  const openEditEq = (eq: Equipment) => {
    setEditingEq(eq);
    setEqForm({ descripcion: eq.descripcion, marca: eq.marca, modelo: eq.modelo, serie: eq.serie || "", costo: String(eq.costo), depreciado: eq.depreciado });
  };
  const handleSaveEq = async () => {
    if (!editingEq) return;
    setSavingEq(true);
    try {
      await api.put(`/admin/equipment/${editingEq.id}`, { ...eqForm, costo: parseFloat(eqForm.costo as string) || 0 });
      toast.success("Equipo actualizado");
      setEditingEq(null);
      await loadEquipment();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error");
    } finally { setSavingEq(false); }
  };

  // ── Reset data ────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (resetConfirm !== "RESET") { toast.error("Escribe RESET para confirmar"); return; }
    if (!mafFile) { toast.error("MAF.xlsx es requerido"); return; }
    const fd = new FormData();
    fd.append("maf_file", mafFile);
    if (usersFile) fd.append("users_file", usersFile);
    setResetting(true);
    try {
      const { data } = await api.post<{ message: string; stores_imported: number; equipment_imported: number }>("/admin/reset-data", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.message} — ${data.equipment_imported} equipos, ${data.stores_imported} tiendas`);
      setResetDialog(false); setMafFile(null); setUsersFile(null); setResetConfirm("");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Error en el reset");
    } finally { setResetting(false); }
  };

  const downloadTemplate = async (type: string) => {
    try {
      const res = await api.get(`/admin/template/${type}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = `plantilla_${type}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Error descargando plantilla"); }
  };

  const filteredUsers = users.filter(u =>
    userSearch ? (u.nombre.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())) : true
  );

  const fmtMoney = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

  if (!authUser || !["Administrador", "Super Administrador"].includes(authUser.perfil)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Acceso Restringido</p>
        <p className="text-sm text-muted-foreground">Solo administradores pueden acceder a esta sección</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">Administración</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de usuarios, equipos y datos del sistema</p>
        </div>
        {isSuperAdmin && (
          <Button variant="destructive" onClick={() => setResetDialog(true)} className="gap-2">
            <DatabaseZap className="h-4 w-4" /> Reset de Datos
          </Button>
        )}
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Usuarios ({users.length})</TabsTrigger>
          <TabsTrigger value="equipment" className="gap-2" onClick={() => { if (!equipment.length && !eqLoading) loadEquipment(); }}>
            <Box className="h-4 w-4" />Equipos
          </TabsTrigger>
        </TabsList>

        {/* ── Users Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar usuarios…" className="pl-9" />
            </div>
            <Button onClick={openCreateUser} className="gap-2"><PlusCircle className="h-4 w-4" />Nuevo Usuario</Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><userSort.SH col="nombre">Nombre</userSort.SH></TableHead>
                  <TableHead><userSort.SH col="email">Email</userSort.SH></TableHead>
                  <TableHead><userSort.SH col="perfil">Perfil</userSort.SH></TableHead>
                  <TableHead><userSort.SH col="activo">Estado</userSort.SH></TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : userSort.sorted(filteredUsers as unknown as Record<string, unknown>[]).map((row) => {
                  const u = row as unknown as AppUser;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.perfil}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.activo ? "default" : "secondary"} className={`text-xs ${u.activo ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" : ""}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {isSuperAdmin && u.id !== authUser?.id && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteUser(u)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!usersLoading && filteredUsers.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Sin usuarios{userSearch ? " coincidentes" : ""}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Equipment Tab ────────────────────────────────────────────────── */}
        <TabsContent value="equipment" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={eqSearch} onChange={e => { setEqSearch(e.target.value); setEqPage(1); }} placeholder="Buscar equipos…" className="pl-9" />
            </div>
            <Select value={eqPlazaFilter} onValueChange={v => { setEqPlazaFilter(v); setEqPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todas las plazas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plazas</SelectItem>
                {plazas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={loadEquipment} variant="outline" size="icon"><RefreshCw className={`h-4 w-4 ${eqLoading ? "animate-spin" : ""}`} /></Button>
          </div>

          <p className="text-xs text-muted-foreground">{eqTotal} equipos encontrados</p>

          <div className="rounded-md border overflow-x-auto">
            <Table style={{ minWidth: 900 }}>
              <TableHeader>
                <TableRow>
                  <TableHead><eqSort.SH col="codigo_barras">Código</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="descripcion">Descripción</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="marca">Marca</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="modelo">Modelo</eqSort.SH></TableHead>
                  <TableHead className="font-mono text-xs">Serie</TableHead>
                  <TableHead><eqSort.SH col="costo">Costo</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="valor_real">Val. Real</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="depreciado">Depr.</eqSort.SH></TableHead>
                  <TableHead><eqSort.SH col="plaza">Plaza</eqSort.SH></TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eqLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : eqSort.sorted(equipment as unknown as Record<string, unknown>[]).map((row) => {
                  const eq = row as unknown as Equipment;
                  return (
                    <TableRow key={eq.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{eq.codigo_barras}</TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate whitespace-nowrap">{eq.descripcion}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{eq.marca}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{eq.modelo}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{eq.serie || "—"}</TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap">{fmtMoney(eq.costo)}</TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap">{fmtMoney(eq.valor_real)}</TableCell>
                      <TableCell><Badge variant={eq.depreciado ? "destructive" : "outline"} className="text-[10px]">{eq.depreciado ? "Sí" : "No"}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{eq.plaza}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEq(eq)}><Pencil className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!eqLoading && equipment.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                    {eqSearch || eqPlazaFilter !== "all" ? "Sin equipos coincidentes" : "Haz clic en Actualizar para cargar equipos"}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {eqTotal > EQ_PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {eqPage} de {Math.ceil(eqTotal / EQ_PAGE_SIZE)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEqPage(p => Math.max(1, p - 1))} disabled={eqPage === 1}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setEqPage(p => p + 1)} disabled={eqPage >= Math.ceil(eqTotal / EQ_PAGE_SIZE)}>Siguiente</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── DIALOGS ──────────────────────────────────────────────────────────── */}

      {/* User create/edit */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight">{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Nombre <span className="text-red-500">*</span></Label>
              <Input value={userForm.nombre} onChange={e => setUserForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" /></div>
            <div className="space-y-1.5"><Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" /></div>
            <div className="space-y-1.5">
              <Label>{editingUser ? "Nueva Contraseña (dejar vacío para no cambiar)" : <span>Contraseña <span className="text-red-500">*</span></span>}</Label>
              <div className="relative">
                <Input type={showPwd ? "text" : "password"} value={userForm.password}
                  onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? "Sin cambios" : "Mínimo 8 caracteres"} className="pr-10" />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Perfil</Label>
              <Select value={userForm.perfil} onValueChange={v => setUserForm(f => ({ ...f, perfil: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROFILES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="flex items-center gap-3">
              <Label>Estado</Label>
              <button onClick={() => setUserForm(f => ({ ...f, activo: !f.activo }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${userForm.activo ? "bg-emerald-500" : "bg-muted-foreground/30"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${userForm.activo ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-muted-foreground">{userForm.activo ? "Activo" : "Inactivo"}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUserDialog(false)} disabled={savingUser}>Cancelar</Button>
            <Button onClick={handleSaveUser} disabled={savingUser} className="gap-2">
              {savingUser ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : <><Check className="h-4 w-4" />{editingUser ? "Actualizar" : "Crear"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user confirm */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase text-red-600">Eliminar Usuario</DialogTitle>
          <DialogDescription>Esta acción es permanente y no se puede deshacer.</DialogDescription></DialogHeader>
          {deleteUser && <div className="bg-muted rounded-lg p-3 space-y-0.5"><p className="font-medium">{deleteUser.nombre}</p><p className="text-sm text-muted-foreground">{deleteUser.email}</p></div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deletingUser}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deletingUser} className="gap-2">
              <Trash2 className="h-4 w-4" />{deletingUser ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit equipment */}
      <Dialog open={!!editingEq} onOpenChange={() => setEditingEq(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading uppercase tracking-tight">Editar Equipo</DialogTitle></DialogHeader>
          {editingEq && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 space-y-1"><p className="font-mono text-xs">{editingEq.codigo_barras}</p><p className="text-xs text-muted-foreground">{editingEq.tienda} · {editingEq.plaza}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2"><Label>Descripción</Label><Input value={eqForm.descripcion} onChange={e => setEqForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Marca</Label><Input value={eqForm.marca} onChange={e => setEqForm(f => ({ ...f, marca: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Modelo</Label><Input value={eqForm.modelo} onChange={e => setEqForm(f => ({ ...f, modelo: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Serie</Label><Input value={eqForm.serie} onChange={e => setEqForm(f => ({ ...f, serie: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Costo (MXN)</Label><Input type="number" value={eqForm.costo} onChange={e => setEqForm(f => ({ ...f, costo: e.target.value }))} /></div>
              </div>
              <div className="flex items-center gap-3">
                <Label>Depreciado</Label>
                <button onClick={() => setEqForm(f => ({ ...f, depreciado: !f.depreciado }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${eqForm.depreciado ? "bg-red-500" : "bg-muted-foreground/30"}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${eqForm.depreciado ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-sm text-muted-foreground">{eqForm.depreciado ? "Sí" : "No"}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingEq(null)} disabled={savingEq}>Cancelar</Button>
            <Button onClick={handleSaveEq} disabled={savingEq} className="gap-2">
              {savingEq ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : <><Check className="h-4 w-4" />Guardar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset data */}
      <Dialog open={resetDialog} onOpenChange={v => { if (!resetting) setResetDialog(v); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight text-red-600 flex items-center gap-2">
              <DatabaseZap className="h-5 w-5" /> Reset de Datos del Sistema
            </DialogTitle>
            <DialogDescription>Esta operación reemplazará todos los equipos, tiendas y opcionalmente los usuarios.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-5 pr-2">
              {/* Danger notice */}
              <div className="flex gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-red-600">¡ADVERTENCIA!</p>
                  <p className="text-muted-foreground">Todos los datos de equipos y tiendas serán eliminados y reemplazados. Las auditorías completadas, movimientos y bitácoras permanecerán.</p>
                </div>
              </div>

              <Separator />

              {/* File structure info */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Estructura requerida de archivos</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card className="border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-green-500" />MAF.xlsx <span className="text-red-500">*</span></CardTitle></CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Columnas requeridas:</p>
                      <p>• Código de Barras (o Codigo_Barras)</p><p>• No. Activo (o No_Activo)</p>
                      <p>• Descripción / Marca / Modelo / Serie</p><p>• Costo / Año Adquisición</p>
                      <p>• Tienda / CR Tienda / Plaza</p>
                      <Button size="sm" variant="outline" className="mt-2 gap-1.5 h-7 text-xs" onClick={() => downloadTemplate("maf")}>
                        <Download className="h-3 w-3" />Descargar plantilla
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-blue-500" />USUARIOS.xlsx</CardTitle></CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Columnas requeridas:</p>
                      <p>• Nombre / Email / Contraseña</p><p>• Perfil (Técnico / Administrador / Super Administrador)</p>
                      <p className="italic">Opcional — si no se sube, los usuarios actuales no cambian.</p>
                      <Button size="sm" variant="outline" className="mt-2 gap-1.5 h-7 text-xs" onClick={() => downloadTemplate("users")}>
                        <Download className="h-3 w-3" />Descargar plantilla
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* File upload areas */}
              <div className="space-y-3">
                <DropZone label="MAF.xlsx" required file={mafFile} setFile={setMafFile} dragOver={dragOverMaf} setDragOver={setDragOverMaf} accept=".xlsx,.xls" />
                <DropZone label="USUARIOS.xlsx (opcional)" required={false} file={usersFile} setFile={setUsersFile} dragOver={dragOverUsers} setDragOver={setDragOverUsers} accept=".xlsx,.xls" />
              </div>

              <Separator />

              {/* Confirmation */}
              <div className="space-y-1.5">
                <Label>Escribe <span className="font-mono font-bold text-red-500">RESET</span> para confirmar</Label>
                <Input value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder="RESET" className="font-mono" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setResetDialog(false); setMafFile(null); setUsersFile(null); setResetConfirm(""); }} disabled={resetting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting || !mafFile || resetConfirm !== "RESET"} className="gap-2">
              {resetting ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</> : <><DatabaseZap className="h-4 w-4" />Ejecutar Reset</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Drop Zone Component ───────────────────────────────────────────────────────
function DropZone({ label, required, file, setFile, dragOver, setDragOver, accept }: {
  label: string; required: boolean; file: File | null; setFile: (f: File | null) => void;
  dragOver: boolean; setDragOver: (v: boolean) => void; accept: string;
}) {
  const inputRef = useState<HTMLInputElement | null>(null)[0];
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />{label}{required && <span className="text-red-500">*</span>}</Label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        className={`relative flex items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors cursor-pointer
          ${dragOver ? "border-primary bg-primary/5" : file ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:border-muted-foreground/50"}`}
        onClick={() => document.getElementById(`file-input-${label}`)?.click()}
      >
        {file ? (
          <>
            <FileSpreadsheet className="h-6 w-6 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p></div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={e => { e.stopPropagation(); setFile(null); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">Arrastra aquí o <span className="text-primary font-medium">haz clic para seleccionar</span></p>
          </>
        )}
        <input id={`file-input-${label}`} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} ref={el => { (inputRef as unknown as HTMLInputElement | null); }} />
      </div>
    </div>
  );
}
