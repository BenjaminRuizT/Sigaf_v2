"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, Download, Upload, RefreshCw, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export default function AdminPage() {
  const { api, user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mafFile, setMafFile] = useState<File | null>(null);
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const mafRef = useRef<HTMLInputElement>(null);
  const usersRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.perfil !== "Super Administrador") return;
    api.get("/admin/users").then(r => setUsers(r.data)).catch(() => toast.error("Error")).finally(() => setLoading(false));
  }, [api, user]);

  if (user?.perfil !== "Super Administrador") {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Acceso restringido a Super Administradores.</div>;
  }

  const downloadTemplate = (type: string) => {
    const token = localStorage.getItem("sigaf_token");
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/template/${type}?token=${token}`, "_blank");
  };

  const handleResetData = async () => {
    if (!mafFile || !usersFile) {
      toast.error("Selecciona ambos archivos antes de continuar");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("maf_file", mafFile);
      form.append("users_file", usersFile);
      const token = localStorage.getItem("sigaf_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reset-data`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      toast.success(`Datos cargados: ${data.equipment} equipos, ${data.stores} tiendas, ${data.users} usuarios`);
      setMafFile(null);
      setUsersFile(null);
      if (mafRef.current) mafRef.current.value = "";
      if (usersRef.current) usersRef.current.value = "";
    } catch (e) {
      toast.error(`Error al cargar datos: ${e}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Administración</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {[{k:"users",l:"Usuarios"},{k:"data",l:"Datos"}].map(({k,l}) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===k?"bg-background shadow-sm":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "users" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-medium text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Usuarios ({users.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border"><tr>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Perfil</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">Cargando…</td></tr>
              : users.map((u: Record<string, unknown>) => (
                <tr key={String(u.id)} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{String(u.nombre)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{String(u.email)}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{String(u.perfil)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "data" && (
        <div className="space-y-6">
          {/* Download templates */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Plantillas</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[{type:"maf",label:"MAF Template"},{type:"usuarios",label:"Usuarios Template"}].map(({type,label}) => (
                <div key={type} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                  <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground mt-0.5">Descargar plantilla Excel</p></div>
                  <button onClick={() => downloadTemplate(type)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-sm hover:bg-accent transition-colors">
                    <Download className="h-4 w-4" /> Descargar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Upload / Reset data */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cargar / Resetear Datos</h2>
            <div className="bg-card border border-border rounded-xl p-6 space-y-5">
              <p className="text-sm text-muted-foreground">
                Selecciona los archivos <strong>MAF.xlsx</strong> y <strong>USUARIOS.xlsx</strong> para reemplazar todos los datos del sistema.
                <span className="text-amber-600 font-medium"> Esta acción elimina los datos existentes.</span>
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* MAF file */}
                <div>
                  <label className="block text-sm font-medium mb-2">Archivo MAF</label>
                  <div
                    onClick={() => mafRef.current?.click()}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                      ${mafFile ? "border-green-500 bg-green-500/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                  >
                    {mafFile ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <span className="text-sm truncate">{mafFile ? mafFile.name : "Seleccionar MAF.xlsx"}</span>
                  </div>
                  <input ref={mafRef} type="file" accept=".xlsx" className="hidden"
                    onChange={e => setMafFile(e.target.files?.[0] ?? null)} />
                </div>

                {/* USUARIOS file */}
                <div>
                  <label className="block text-sm font-medium mb-2">Archivo Usuarios</label>
                  <div
                    onClick={() => usersRef.current?.click()}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                      ${usersFile ? "border-green-500 bg-green-500/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                  >
                    {usersFile ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <span className="text-sm truncate">{usersFile ? usersFile.name : "Seleccionar USUARIOS.xlsx"}</span>
                  </div>
                  <input ref={usersRef} type="file" accept=".xlsx" className="hidden"
                    onChange={e => setUsersFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>

              <button
                onClick={handleResetData}
                disabled={uploading || !mafFile || !usersFile}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {uploading
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> Procesando…</>
                  : <><Upload className="h-4 w-4" /> Cargar y Resetear Datos</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
