"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { RegistroTramiteForm } from "@/components/tramites/RegistroTramiteForm";
import { CajaCerradaBlock } from "@/components/caja/CajaCerradaBlock";
import { LoaderCircle } from "lucide-react";

export default function NuevoTramitePage() {
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkCaja() {
      try {
        const res = await fetch(`/api/cajas?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
        });
        if (res.ok) {
          const data = await res.json();
          setCajaAbierta(data?.session?.estado === "ABIERTA");
        } else {
          setCajaAbierta(false);
        }
      } catch (err) {
        setCajaAbierta(false);
      } finally {
        setLoading(false);
      }
    }
    void checkCaja();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <LoaderCircle className="animate-spin text-[var(--blue)]" size={36} />
        <p className="text-sm font-semibold text-slate-500">Verificando estado de caja...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        title="Registrar solicitud presencial"
        description="Ingresa los datos entregados por el negocio. El trámite se activa cuando se confirma el pago de S/180."
      />
      {cajaAbierta ? (
        <RegistroTramiteForm presencial />
      ) : (
        <CajaCerradaBlock accion="registrar una solicitud presencial" />
      )}
    </div>
  );
}
