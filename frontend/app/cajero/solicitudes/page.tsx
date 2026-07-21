"use client";

import { useEffect, useState } from "react";
import { Search, Clock3, FileText } from "lucide-react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
  const [busqueda, setBusqueda] = useState("");

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
    // Polling en tiempo real cada 2 segundos para reflejar pagos e inspecciones instantáneamente
    const interval = setInterval(cargarTramites, 2000);
    return () => clearInterval(interval);
  }, []);

  const getLegibleEstado = (t: TramiteDB) => {
    switch (t.estado) {
      case "BORRADOR": return "En revisión";
      case "PAGO_PENDIENTE": return "Pago pendiente";
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
      case "VENCIDO": return "Vencido";
      default: return t.estado;
    }
  };

  const tramitesFiltrados = tramites.filter((t) => {
    if (["BORRADOR", "PAGO_PENDIENTE", "PAGO_RECHAZADO"].includes(t.estado)) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      t.codigo.toLowerCase().includes(q) ||
      t.negocio.ruc.includes(q) ||
      t.negocio.razonSocial.toLowerCase().includes(q) ||
      t.negocio.distrito.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Solicitudes"
        description="Revisa y gestiona en tiempo real los trámites registrados en la plataforma."
        action={
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Buscar por RUC, razón social o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="focus-ring h-10 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-4 text-xs shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--blue)]"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
            <Clock3 className="animate-spin text-[var(--blue)]" size={32} />
            <p className="mt-3 text-sm font-medium">Cargando solicitudes registradas...</p>
          </div>
        ) : tramitesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="text-slate-300 mb-3" size={42} />
            <h3 className="font-bold text-slate-700">No hay solicitudes registradas</h3>
            <p className="mt-1 text-xs text-[var(--muted)] max-w-sm">
              {busqueda
                ? "No se encontraron coincidencias para la búsqueda."
                : "Aún no hay trámites registrados en la base de datos."}
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
            Sincronizado en tiempo real
          </span>
        </div>
      </div>
    </div>
  );
}
