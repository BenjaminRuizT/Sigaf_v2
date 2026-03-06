'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'es' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  es: {
    'app.fullName': 'Sistema Integral de Gestión de Activo Fijo',
    'auth.login': 'Iniciar Sesión',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.welcome': 'Bienvenido',
    'auth.invalidCredentials': 'Credenciales inválidas',
    'auth.logout': 'Cerrar sesión',
    'nav.dashboard': 'Dashboard',
    'nav.stores': 'Tiendas',
    'nav.audit': 'Auditoría',
    'nav.reports': 'Reportes',
    'nav.logs': 'Bitácoras',
    'nav.admin': 'Administración',
    'nav.settings': 'Configuración',
    'common.search': 'Buscar',
    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.export': 'Exportar',
    'common.total': 'Total',
    'common.status': 'Estado',
    'audit.scan': 'Escanear',
    'audit.finalize': 'Finalizar Auditoría',
    'audit.cancel': 'Cancelar Auditoría',
    'audit.located': 'Localizado',
    'audit.surplus': 'Sobrante',
    'audit.notFound': 'No Localizado',
  },
  en: {
    'app.fullName': 'Fixed Asset Management System',
    'auth.login': 'Sign In',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.welcome': 'Welcome',
    'auth.invalidCredentials': 'Invalid credentials',
    'auth.logout': 'Sign out',
    'nav.dashboard': 'Dashboard',
    'nav.stores': 'Stores',
    'nav.audit': 'Audit',
    'nav.reports': 'Reports',
    'nav.logs': 'Logs',
    'nav.admin': 'Administration',
    'nav.settings': 'Settings',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.export': 'Export',
    'common.total': 'Total',
    'common.status': 'Status',
    'audit.scan': 'Scan',
    'audit.finalize': 'Finalize Audit',
    'audit.cancel': 'Cancel Audit',
    'audit.located': 'Located',
    'audit.surplus': 'Surplus',
    'audit.notFound': 'Not Found',
  },
};

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    const saved = (localStorage.getItem('sigaf_lang') as Lang) || 'es';
    setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('sigaf_lang', l);
  };

  const t = (key: string): string => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
}
