"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, Monitor, Store, Upload, Download } from "lucide-react";

export default function AdminPage() {
  const { api, user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

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
          <div className="px-5 py-3 border-b border-border font-medium text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><Users className="h-4 w-4" />Usuarios ({users.length})</span>
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
        <div className="space-y-4">
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
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-700">
            Para resetear los datos, use el endpoint <code className="font-mono">/api/admin/reset-data</code> con los archivos MAF.xlsx y USUARIOS.xlsx.
          </div>
        </div>
      )}
    </div>
  );
}
