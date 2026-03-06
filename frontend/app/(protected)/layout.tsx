"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Providers from "@/components/Providers";
import { Loader2 } from "lucide-react";

function ProtectedInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);
  if (loading) return (<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  if (!user) return null;
  return <Layout>{children}</Layout>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <Providers><ProtectedInner>{children}</ProtectedInner></Providers>;
}
