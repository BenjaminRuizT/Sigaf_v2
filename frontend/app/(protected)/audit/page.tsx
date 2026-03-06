"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AuditIndexPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-muted-foreground">Selecciona una tienda desde el Panel para iniciar una auditoría.</p>
      <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Ir al Panel
      </button>
    </div>
  );
}
