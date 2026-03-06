"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Moon, Sun, Download } from "lucide-react";

export default function SettingsPage() {
  const { api, user } = useAuth();
  const { theme, toggle } = useTheme();
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/auth/profile", { nombre: nombre || undefined, password: password || undefined });
      toast.success("Perfil actualizado");
      setPassword("");
    } catch { toast.error("Error actualizando perfil"); }
    finally { setSaving(false); }
  };

  const dlManual = () => window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/download/manual?token=${localStorage.getItem("sigaf_token")}`, "_blank");

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Configuración</h1>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-medium">Perfil</h3>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nueva Contraseña (opcional)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Dejar en blanco para no cambiar" />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60 hover:bg-primary/90 transition-colors">
            {saving ? "Guardando…" : "Guardar Cambios"}
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-medium">Apariencia</h3>
        <button onClick={toggle} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-input hover:bg-accent transition-colors text-sm">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h3 className="font-medium">Documentación</h3>
        <button onClick={dlManual} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input text-sm hover:bg-accent transition-colors">
          <Download className="h-4 w-4" /> Manual de Usuario (PDF)
        </button>
      </div>
    </div>
  );
}
