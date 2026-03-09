"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  User, Lock, Sun, Moon, Languages, Palette, ChevronRight,
  Eye, EyeOff, Shield, FileText, BarChart2, Box, ArrowRightLeft,
  RefreshCw, Laptop, Smartphone, Info, Check,
} from "lucide-react";

// ── Color palette tokens ──────────────────────────────────────────────────────
type Palette = "professional" | "oxxo";

const PALETTES: { id: Palette; label: string; bg: string; dot1: string; dot2: string }[] = [
  { id: "professional", label: "Profesional", bg: "bg-slate-800", dot1: "bg-blue-500", dot2: "bg-slate-300" },
  { id: "oxxo", label: "OXXO", bg: "bg-red-700", dot1: "bg-yellow-400", dot2: "bg-white" },
];

// ── App features info ─────────────────────────────────────────────────────────
const FEATURES = [
  { icon: BarChart2, label: "Dashboard con métricas en tiempo real" },
  { icon: Box, label: "Escaneo de códigos de barras con modo offline" },
  { icon: ArrowRightLeft, label: "Gestión de transferencias y altas/bajas" },
  { icon: FileText, label: "Exportación a Excel (clasificaciones, movimientos)" },
  { icon: Shield, label: "Control de acceso por perfil de usuario" },
  { icon: RefreshCw, label: "Sincronización automática de escaneos offline" },
];

const MOVEMENT_TYPES = [
  { key: "ALTA", color: "bg-emerald-500/20 text-emerald-700 border-emerald-400/40", desc: "Incorporación de equipo no registrado" },
  { key: "BAJA", color: "bg-red-500/20 text-red-700 border-red-400/40", desc: "Retiro de equipo del MAF" },
  { key: "TRANSFER", color: "bg-blue-500/20 text-blue-700 border-blue-400/40", desc: "Cambio de tienda del equipo" },
];

const PROFILES = [
  { name: "Técnico", desc: "Puede realizar auditorías, ver reportes básicos" },
  { name: "Administrador", desc: "Acceso completo a reportes y configuración" },
  { name: "Super Administrador", desc: "Acceso total incluido gestión de usuarios y reset" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, api } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, setLang } = useLanguage();

  const [nombre, setNombre]         = useState(user?.nombre || "");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [palette, setPalette]       = useState<Palette>(() =>
    (typeof window !== "undefined" ? (localStorage.getItem("sigaf_palette") as Palette) : null) || "professional"
  );

  // ── Profile update ────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!nombre.trim()) { toast.error("El nombre no puede estar vacío"); return; }
    setSaving(true);
    try {
      const payload: Record<string, string> = { nombre: nombre.trim() };
      if (password.trim()) payload.password = password.trim();
      await api.put("/auth/profile", payload);
      toast.success("Perfil actualizado correctamente");
      setPassword("");
      setTimeout(() => window.location.reload(), 800);
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(d || "Error al actualizar perfil");
    } finally { setSaving(false); }
  };

  const handlePaletteChange = (p: Palette) => {
    setPalette(p);
    localStorage.setItem("sigaf_palette", p);
    toast.success(`Paleta "${p === "professional" ? "Profesional" : "OXXO"}" aplicada`);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tus preferencias y perfil de usuario</p>
      </div>

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-heading uppercase text-base tracking-wide">
            <User className="h-4 w-4 text-primary" /> Perfil de Usuario
          </CardTitle>
          <CardDescription>Actualiza tu nombre y contraseña de acceso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-lg select-none">
              {(nombre || user?.nombre || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{user?.nombre}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Badge variant="outline" className="text-xs">{user?.perfil}</Badge>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Nueva Contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPwd ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Dejar vacío para no cambiar" className="pr-10" />
              <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full gap-2">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Guardando...</> : <><Check className="h-4 w-4" />Guardar Cambios</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-heading uppercase text-base tracking-wide">
            <Palette className="h-4 w-4 text-primary" /> Apariencia
          </CardTitle>
          <CardDescription>Personaliza el aspecto visual de la aplicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Modo de color</p>
              <p className="text-xs text-muted-foreground">Cambia entre tema claro y oscuro</p>
            </div>
            <button onClick={toggleTheme}
              className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                ${theme === "dark" ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow transition-transform
                ${theme === "dark" ? "translate-x-8" : "translate-x-1"}`}>
                {theme === "dark" ? <Moon className="h-3.5 w-3.5 text-slate-700" /> : <Sun className="h-3.5 w-3.5 text-yellow-500" />}
              </span>
            </button>
          </div>

          <Separator />

          {/* Language selector */}
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium flex items-center gap-1.5"><Languages className="h-4 w-4" /> Idioma</p>
              <p className="text-xs text-muted-foreground">Selecciona el idioma de la interfaz</p>
            </div>
            <div className="flex gap-2">
              {[
                { id: "es" as const, flag: "🇲🇽", label: "Español" },
                { id: "en" as const, flag: "🇺🇸", label: "English" },
              ].map(opt => (
                <button key={opt.id} onClick={() => { setLang(opt.id); toast.success(`Language set to ${opt.label}`); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors
                    ${lang === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50"}`}>
                  <span className="text-lg">{opt.flag}</span> {opt.label}
                  {lang === opt.id && <Check className="h-3.5 w-3.5 ml-0.5" />}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Color palette */}
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Paleta de colores</p>
              <p className="text-xs text-muted-foreground">Define el esquema de colores del sistema</p>
            </div>
            <div className="flex gap-3">
              {PALETTES.map(p => (
                <button key={p.id} onClick={() => handlePaletteChange(p.id)}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium w-40
                    ${palette === p.id ? "border-primary shadow-md" : "border-border hover:border-muted-foreground/40"}`}>
                  <div className={`h-8 w-8 rounded-full ${p.bg} flex items-center justify-center shrink-0`}>
                    <div className={`h-2.5 w-2.5 rounded-full ${p.dot1}`} />
                  </div>
                  <span>{p.label}</span>
                  {palette === p.id && <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── App Info ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 font-heading uppercase text-base tracking-wide">
            <Info className="h-4 w-4 text-primary" /> Acerca de SIGAF
          </CardTitle>
          <CardDescription>Información del sistema y guía rápida de funcionalidades</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <div>
              <p className="font-semibold text-sm">Sistema Integral de Gestión de Activo Fijo</p>
              <p className="text-xs text-muted-foreground mt-0.5">SIGAF v2.0.0 — Next.js 15 + FastAPI + PostgreSQL</p>
            </div>
            <div className="flex gap-1.5">
              <Laptop className="h-4 w-4 text-muted-foreground" />
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" /> Funcionalidades
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-2.5 bg-muted/50 rounded-lg p-2.5">
                  <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-snug">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" /> Tipos de Movimiento
            </p>
            <div className="space-y-2">
              {MOVEMENT_TYPES.map(({ key, color, desc }) => (
                <div key={key} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30">
                  <Badge className={`text-xs font-bold w-16 justify-center ${color}`}>{key}</Badge>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" /> Perfiles de Usuario
            </p>
            <div className="space-y-2">
              {PROFILES.map(({ name, desc }) => (
                <div key={name} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/30">
                  <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div><p className="text-xs font-semibold">{name}</p><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" /> Documentos Exportables
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "MAF — Clasificaciones de Activo Fijo",
                "Movimientos ALTAS/BAJAS",
                "Movimientos TRANSFERENCIAS",
                "Resumen de Auditorías",
              ].map(doc => (
                <div key={doc} className="flex items-center gap-2 bg-muted/50 p-2.5 rounded-lg">
                  <FileText className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-xs text-muted-foreground">{doc}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
