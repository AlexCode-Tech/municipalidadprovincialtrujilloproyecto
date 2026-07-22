"use client";

import { useEffect, useState } from "react";
import { Search, Clock3, FileText, Banknote, LoaderCircle } from "lucide-react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CajaCerradaBlock } from "@/components/caja/CajaCerradaBlock";
import Link from "next/link";

type InspeccionDB = {
  numeroVisita: number;
  resultado: string;
};

type TramiteDB = {
  id: string;
  codigo: string;
  estado: string;
  creadoEn: string;
  negocio: {
    razonSocial: string;
    ruc: string;
    distrito: string;
    domicilioFiscal: string;
  };
  inspecciones?: InspeccionDB[];
};

export default function SolicitudesPage() {
  const [tramites, setTramites] = useState<TramiteDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [cajaLoading, setCajaLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<"PENDIENTES" | "PROCESADOS">("PENDIENTES");

  const cargarTramites = async () => {
    try {
      const res = await fetch(`/api/tramites?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
      });
      if (res.ok) {
        const data = await res.json();
        setTramites(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error al cargar solicitudes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarTramites();
    const interval = setInterval(cargarTramites, 3000);
    return () => clearInterval(interval);
  }, []);

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
        setCajaLoading(false);
      }
    }
    void checkCaja();
  }, []);

  const getLegibleEstado = (t: TramiteDB) => {
    switch (t.estado) {
      case "BORRADOR":
      case "PAGO_PENDIENTE":
      case "PENDIENTE_PAGO": return "Pago pendiente";
      case "PAGO_RECHAZADO": return "Pago rechazado";
      case "INSPECCION_PROGRAMADA": {
        const vis = t.inspecciones && t.inspecciones.length > 0 ? t.inspecciones[t.inspecciones.length - 1].numeroVisita : 1;
        return vis > 1 ? `Inspección programada (Visita ${vis} de 2)` : "Inspección programada";
      }
      case "OBSERVADO": {
        const obsContadas = (t.inspecciones || []).filter(i => i.resultado === "OBSERVADO").length;
        const numObs = obsContadas > 0 ? obsContadas : 1;
        return `Observado (${numObs}° observación)`;
      }
      case "APROBADO": return "Aprobado";
      case "DENEGADO": return "Denegado";
      case "RECHAZADO": return "Rechazado definitivo";
      case "VENCIDO": return "Vencido";
      default: return t.estado;
    }
  };

  const isPendingState = (status: string) => {
    return ["BORRADOR", "PAGO_PENDIENTE", "PENDIENTE_PAGO", "PAGO_RECHAZADO"].includes(status);
  };

  const tramitesFiltrados = tramites.filter((t) => {
    // Filtrar por pestaña activa
    const pending = isPendingState(t.estado);
    if (pestana === "PENDIENTES" && !pending) return false;
    if (pestana === "PROCESADOS" && pending) return false;

    // Filtrar por texto de búsqueda
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      t.codigo.toLowerCase().includes(q) ||
      t.negocio.ruc.includes(q) ||
      t.negocio.razonSocial.toLowerCase().includes(q) ||
      t.negocio.distrito.toLowerCase().includes(q)
    );
  });

  if (loading || cajaLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <LoaderCircle className="animate-spin text-[var(--blue)]" size={36} />
        <p className="text-sm font-semibold text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Solicitudes"
        description="Revisa y gestiona en tiempo real los trámites registrados en la plataforma."
        action={
          cajaAbierta ? (
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                placeholder="Buscar por RUC, razón social..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="focus-ring h-10 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-4 text-xs shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--blue)]"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            </div>
          ) : undefined
        }
      />

      {!cajaAbierta ? (
        <div className="mt-8">
          <CajaCerradaBlock accion="visualizar y buscar solicitudes de trámites" />
        </div>
      ) : (
        <>
          {/* Selector de pestañas */}
          <div className="mb-6 flex border-b border-[var(--border)]">
            <button
              onClick={() => setPestana("PENDIENTES")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition ${
                pestana === "PENDIENTES"
                  ? "border-[var(--blue)] text-[var(--blue)]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Por Cobrar (Pendientes)
            </button>
            <button
              onClick={() => setPestana("PROCESADOS")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition ${
                pestana === "PROCESADOS"
                  ? "border-[var(--blue)] text-[var(--blue)]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Procesados (Pagados & Aprobados)
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            {tramitesFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="text-slate-300 mb-3" size={42} />
                <h3 className="font-bold text-slate-700">No hay solicitudes</h3>
                <p className="mt-1 text-xs text-[var(--muted)] max-w-sm">
                  {busqueda
                    ? "No se encontraron coincidencias para la búsqueda."
                    : pestana === "PENDIENTES"
                    ? "No hay trámites en espera de cobro presencial en este momento."
                    : "Aún no hay trámites pagados o aprobados en la base de datos."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead className="bg-[#f7f8fb] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Código</th>
                      <th className="px-5 py-4 font-semibold">Razón social</th>
                      <th className="px-5 py-4 font-semibold">RUC</th>
                      <th className="px-5 py-4 font-semibold">Distrito</th>
                      <th className="px-5 py-4 font-semibold">Estado</th>
                      <th className="px-5 py-4 font-semibold">Fecha Registro</th>
                      {pestana === "PENDIENTES" && <th className="px-5 py-4 font-semibold text-right">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-sm">
                    {tramitesFiltrados.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 font-mono font-semibold text-[var(--blue)]">
                          {t.codigo}
                        </td>
                        <td className="px-5 py-4 font-medium">{t.negocio.razonSocial}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">{t.negocio.ruc}</td>
                        <td className="px-5 py-4">{t.negocio.distrito}</td>
                        <td className="px-5 py-4">
                          <StatusBadge>{getLegibleEstado(t)}</StatusBadge>
                        </td>
                        <td className="px-5 py-4 text-[var(--muted)] text-xs">
                          {new Date(t.creadoEn).toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        {pestana === "PENDIENTES" && (
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/cajero/cobro?tramiteId=${t.id}`}
                              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                            >
                              <Banknote size={13} />
                              Cobrar
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4 text-xs text-[var(--muted)]">
              <span>Mostrando {tramitesFiltrados.length} solicitud(es)</span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Sincronizado en tiempo real (3s)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
