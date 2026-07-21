"use client";

import { useState, useTransition } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, CheckCircle2, Cpu, LoaderCircle, Sparkles } from "lucide-react";

export default function AdminSimuladorPage() {
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const handleEjecutarCron = () => {
    setErrorMsg("");
    setSuccessMsg("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/simulador/cron", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "Error al procesar el cron job.");
        } else {
          setSuccessMsg(`¡Cron Job ejecutado con éxito! Se escanearon las licencias y se expiraron ${body.expiradosCount} licencia(s) comercial(es). Se registraron las notificaciones de correo respectivas.`);
        }
      } catch (err) {
        setErrorMsg("Error de conexión al ejecutar el simulador.");
      }
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        title="Simulador de Tareas MPT"
        description="Fuerza la ejecución de cron jobs y tareas automáticas del servidor para evaluar el comportamiento temporal."
      />

      {errorMsg && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in" role="alert">
          <AlertCircle className="shrink-0 text-red-500" size={20} />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 animate-in fade-in" role="status">
          <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Sección Cron Job */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4 shadow-sm">
              <Cpu size={20} />
            </span>
            <h3 className="text-lg font-bold text-[var(--navy)]">Cron: Vencimiento de Licencias</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Escaneará todas las licencias de funcionamiento vigentes en la base de datos. Si su fecha de vencimiento es anterior a la fecha simulada actual, se actualizará el trámite a estado **VENCIDO** y se le enviará un correo electrónico de alerta para que proceda con su renovación.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleEjecutarCron}
              disabled={pending}
              className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-xs font-bold text-white shadow-sm transition disabled:opacity-55"
            >
              {pending && <LoaderCircle className="animate-spin" size={14} />}
              Ejecutar Expiración Automática
            </button>
          </div>
        </div>

        {/* Sección Override de Fecha */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4 shadow-sm">
              <Sparkles size={20} />
            </span>
            <h3 className="text-lg font-bold text-[var(--navy)]">Control de Tiempo</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Para cambiar la fecha general del servidor, utiliza el widget flotante ubicado en la **esquina inferior derecha** de tu pantalla. Este control de fecha se propaga de manera consistente a la base de datos (para registros de pago, asignaciones de visitas del inspector y cálculos de vencimiento).
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl py-3 border border-slate-100">
            El tiempo corre de forma natural a partir de la simulación.
          </div>
        </div>
      </div>
    </div>
  );
}
