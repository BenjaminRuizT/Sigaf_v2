"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ClipboardList, FileText, Settings,
  LogOut, Menu, X, Moon, Sun, Shield, BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",  label: "Panel",          icon: LayoutDashboard, roles: ["all"] },
  { href: "/logs",       label: "Bitácoras",      icon: ClipboardList,   roles: ["all"] },
  { href: "/reports",    label: "Reportes",       icon: FileText,        roles: ["Administrador","Super Administrador"] },
  { href: "/admin",      label: "Administración", icon: Shield,          roles: ["Super Administrador"] },
  { href: "/settings",   label: "Configuración",  icon: Settings,        roles: ["all"] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle }  = useTheme();
  const pathname           = usePathname();
  const [open, setOpen]    = useState(false);

  const visibleNav = navItems.filter(n => n.roles.includes("all") || (user && n.roles.includes(user.perfil)));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <span className="font-heading text-2xl font-bold text-primary tracking-tight">SIGAF</span>
        </div>
        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        {/* User */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-semibold truncate">{user?.nombre}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.perfil}</p>
            </div>
            <button onClick={toggle} className="p-1.5 rounded hover:bg-accent transition-colors">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-4 w-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur flex items-center px-4 md:px-6 gap-4">
          <button className="md:hidden p-1.5 rounded hover:bg-accent" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-heading font-bold text-sm uppercase tracking-widest text-muted-foreground">
            {visibleNav.find(n => pathname.startsWith(n.href))?.label ?? "SIGAF"}
          </span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
