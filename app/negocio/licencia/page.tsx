"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileCheck2, ShieldCheck, AlertCircle, Clock, FileX2, ArrowRight, Search, AlertTriangle } from "lucide-react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSystemDateClient } from "@/lib/system-date-client";

type Licencia = {
  id: string;
  numero: string;
  emitidaEn: string;
  venceEn: string;
};

type Tramite = {
  id: string;
  codigo: string;
  estado: string;
  negocio: {
    razonSocial: string;
    ruc: string;
    domicilioFiscal: string;
    distrito: string;
  };
  licencia?: Licencia | null;
};

export default function LicenciaPage() {
  const [rucInput, setRucInput] = useState("");
  const [rucConsulta, setRucConsulta] = useState("");
  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [loading, setLoading] = useState(false);
  const [realizadoBusqueda, setRealizadoBusqueda] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState("");

  // Polling automático cada 2 segundos para sincronizar en tiempo real el estado de la licencia sin recargar
  useEffect(() => {
    if (!rucConsulta) return;

    let active = true;

    async function cargarLicencia() {
      try {
        const res = await fetch(`/api/tramites/mi-tramite?ruc=${rucConsulta}`);
        if (res.ok && active) {
          const data = await res.json();
          setTramite(data);
          if (!data) {
            setErrorConsulta("No se encontró ningún trámite o licencia registrada para el RUC ingresado.");
          } else {
            setErrorConsulta("");
          }
        }
      } catch (err) {
        console.error("Error al cargar datos de la licencia:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    setLoading(true);
    setErrorConsulta("");
    void cargarLicencia();

    const interval = setInterval(cargarLicencia, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [rucConsulta]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^20\d{9}$/.test(rucInput)) {
      setErrorConsulta("Ingresa un RUC 20 válido de 11 dígitos.");
      return;
    }
    setErrorConsulta("");
    setRealizadoBusqueda(true);
    setRucConsulta(rucInput);
  };

  const handleLimpiarConsulta = () => {
    setRucConsulta("");
    setRucInput("");
    setTramite(null);
    setRealizadoBusqueda(false);
    setErrorConsulta("");
  };

  // 1. Formulario inicial de búsqueda por RUC
  if (!realizadoBusqueda) {
    return (
      <div className="mx-auto max-w-2xl mt-10">
        <div className="text-center mb-8">
          <PageHeading
            title="Mi licencia"
            description="Ingresa el RUC del negocio para consultar y descargar la Licencia de Funcionamiento."
          />
        </div>

        <form onSubmit={handleBuscar} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-md">
          <label className="text-sm font-semibold text-slate-700 block mb-3">
            Ingresa el RUC de la Empresa o Negocio:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                className="w-full h-12 rounded-xl border border-slate-300 pl-4 pr-10 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-blue-100 font-mono text-sm tracking-wider"
                placeholder="20123456789"
                maxLength={11}
                value={rucInput}
                onChange={(e) => setRucInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
                required
              />
              <Search className="absolute right-3.5 top-3.5 text-slate-400" size={18} />
            </div>
            <button
              type="submit"
              className="focus-ring h-12 px-6 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-sm transition-colors flex items-center gap-2 shrink-0"
            >
              Ver Licencia
            </button>
          </div>
          {errorConsulta && (
            <p className="mt-3 text-xs text-[var(--danger)] flex items-center gap-1.5 font-medium" role="alert">
              <AlertTriangle size={14} /> {errorConsulta}
            </p>
          )}
        </form>
      </div>
    );
  }

  const tieneLicencia = tramite && tramite.licencia;
  const estaVencida = tieneLicencia && (tramite.estado === "VENCIDO" || new Date(tramite.licencia!.venceEn) < getSystemDateClient());

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Mi licencia"
        description="Descarga el documento para imprimirlo y colocarlo en un lugar visible del establecimiento."
        action={
          <button
            onClick={handleLimpiarConsulta}
            className="focus-ring rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Consultar otro RUC
          </button>
        }
      />

      {estaVencida ? (
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900 shadow-sm animate-pulse">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 text-red-600 mt-0.5" size={24} />
            <div>
              <h4 className="font-bold text-red-800 text-base">⚠️ LICENCIA VENCIDA</h4>
              <p className="mt-1 text-sm text-red-700 leading-relaxed font-medium">
                La vigencia de tu Licencia de Funcionamiento ha expirado. El PDF descargable ahora cuenta con la marca de agua <strong>&quot;VENCIDA&quot;</strong>. Debes realizar nuevamente el trámite para regularizar tu establecimiento.
              </p>
            </div>
          </div>
          <Link
            href="/negocio/registro"
            className="focus-ring shrink-0 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 shadow"
          >
            Iniciar Nuevo Trámite
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--muted)]">Cargando información de la licencia para RUC {rucConsulta}...</p>
        </div>
      ) : tieneLicencia && tramite && tramite.licencia ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className={`relative overflow-hidden rounded-2xl border p-7 shadow-sm bg-white ${estaVencida ? "border-red-300" : "border-[var(--border)]"}`}>
            <div className={`absolute right-0 top-0 h-32 w-32 rounded-bl-full ${estaVencida ? "bg-red-100/50" : "bg-blue-50"}`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className={`grid h-14 w-14 place-items-center rounded-2xl ${estaVencida ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                  {estaVencida ? <FileX2 size={28} /> : <FileCheck2 size={28} />}
                </div>
                <StatusBadge>
                  {estaVencida ? "Vencido" : "Aprobado"}
                </StatusBadge>
              </div>
              <p className="mt-8 text-xs font-bold uppercase tracking-[.13em] text-[var(--muted)]">
                Licencia de funcionamiento
              </p>
              <h2 className="mt-2 font-mono text-2xl font-bold">
                {tramite.licencia.numero}
              </h2>
              <dl className="mt-7 grid gap-5 border-y border-[var(--border)] py-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--muted)]">Razón social</dt>
                  <dd className="mt-1 font-semibold">{tramite.negocio.razonSocial}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">RUC</dt>
                  <dd className="mt-1 font-mono font-semibold">{tramite.negocio.ruc}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Fecha de emisión</dt>
                  <dd className="mt-1 font-semibold">
                    {new Date(tramite.licencia.emitidaEn).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Vigente hasta</dt>
                  <dd className={`mt-1 font-semibold ${estaVencida ? "text-red-600 font-bold" : ""}`}>
                    {new Date(tramite.licencia.venceEn).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/api/licencias-pdf/${tramite.id}`}
                target="_blank"
                className={`focus-ring mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition ${
                  estaVencida ? "bg-red-600 hover:bg-red-700" : "bg-[var(--blue)] hover:bg-blue-700"
                }`}
              >
                <Download size={19} /> {estaVencida ? "Descargar Licencia PDF (Con marca VENCIDA)" : "Descargar Licencia PDF"}
              </Link>
            </div>
          </section>

          <aside className="rounded-2xl border border-[var(--border)] bg-white p-6">
            <ShieldCheck className={estaVencida ? "text-red-600" : "text-[var(--blue)]"} size={32} />
            <h3 className="mt-4 font-bold">Documento oficial verificable</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              El PDF incluye número único, fechas de vigencia, firma digitalizada y datos oficializados de tu establecimiento.
            </p>
            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {estaVencida ? "Estado del Trámite" : "Renovación"}
              </p>
              <p className="mt-2 text-sm leading-6">
                {estaVencida
                  ? "Esta licencia no se encuentra vigente. Para obtener una licencia limpia y autorizada, debes iniciar un nuevo trámite."
                  : "Te notificaremos antes del vencimiento para confirmar que no hubo cambios y autorizar el trámite correspondiente."}
              </p>
              {estaVencida && (
                <Link
                  href="/negocio/registro"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-800"
                >
                  Iniciar Nuevo Trámite <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center py-6">
            {tramite?.estado === "OBSERVADO" ? (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-orange-600">
                <AlertCircle size={32} />
              </div>
            ) : tramite?.estado === "DENEGADO" ? (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600">
                <FileX2 size={32} />
              </div>
            ) : tramite ? (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-blue-600">
                <Clock size={32} />
              </div>
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <FileX2 size={32} />
              </div>
            )}

            <h3 className="mt-4 text-xl font-bold">
              {tramite?.estado === "OBSERVADO"
                ? "El trámite se encuentra Observado"
                : tramite?.estado === "DENEGADO"
                ? "El trámite ha sido Denegado"
                : tramite
                ? "El trámite se encuentra en proceso"
                : "No registras ningún trámite para este RUC"}
            </h3>

            <p className="mt-2 max-w-md text-sm text-[var(--muted)] leading-relaxed">
              {tramite?.estado === "OBSERVADO"
                ? "El trámite de Licencia registra observaciones en la inspección técnica. Una vez subsanadas y aprobadas las inspecciones, la Licencia de Funcionamiento aparecerá aquí."
                : tramite?.estado === "DENEGADO"
                ? "El trámite ha sido denegado tras la inspección. Puedes iniciar un nuevo trámite desde la plataforma."
                : tramite
                ? `Actualmente el trámite (${tramite.codigo}) se encuentra en estado ${tramite.estado}. La Licencia de Funcionamiento se emitirá una vez concluida exitosamente la inspección.`
                : `No se encontró ninguna solicitud registrada para el RUC ${rucConsulta}.`}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={handleLimpiarConsulta}
                className="focus-ring rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Consultar otro RUC
              </button>
              {tramite ? (
                <Link
                  href="/negocio/estado"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Ver estado del trámite <ArrowRight size={16} />
                </Link>
              ) : (
                <Link
                  href="/negocio/registro"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--blue)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Iniciar Nuevo Trámite <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


