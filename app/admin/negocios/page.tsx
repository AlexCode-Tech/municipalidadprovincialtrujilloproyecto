"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { Building2, CheckCircle2, FileText, LoaderCircle, MapPin, Phone, Store, XCircle } from "lucide-react";

type Negocio = {
  id: string;
  ruc: string;
  razonSocial: string;
  domicilioFiscal: string;
  distrito: string;
  telefono: string | null;
  creadoEn: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    estado: "ACTIVO" | "INACTIVO";
    creadoEn: string;
  } | null;
  tramites: { id: string; estado: string }[];
};

const estadoTramiteBadge: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: "Pago Pendiente", className: "bg-amber-50 text-amber-700" },
  PAGO_PENDIENTE: { label: "Pago Pendiente", className: "bg-amber-50 text-amber-700" },
  PAGO_RECHAZADO: { label: "Pago Rechazado", className: "bg-red-50 text-red-700" },
  INSPECCION_PROGRAMADA: { label: "Insp. Programada", className: "bg-blue-50 text-blue-700" },
  OBSERVADO: { label: "Observado", className: "bg-orange-50 text-orange-700" },
  APROBADO: { label: "Aprobado", className: "bg-emerald-50 text-emerald-700" },
  DENEGADO: { label: "Denegado", className: "bg-red-50 text-red-700" },
};

export default function AdminNegociosPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const cargarNegocios = async () => {
    try {
      const res = await fetch(`/api/admin/negocios?t=${Date.now()}`);
      if (res.ok) {
        const body = await res.json();
        setNegocios(body);
      }
    } catch (err) {
      console.error("Error al cargar negocios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarNegocios();
  }, []);

  const filtrados = negocios.filter(
    (n) =>
      n.ruc.includes(search) ||
      n.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      n.distrito.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Negocios Registrados"
        description="Lista de personas jurídicas registradas en el sistema con acceso al portal de trámites."
      />

      {/* Barra de búsqueda */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por RUC, razón social o distrito..."
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-4 text-sm outline-none focus:border-[var(--blue)]"
          />
        </div>
        <span className="text-sm font-semibold text-slate-500">
          {filtrados.length} negocio{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
          <p className="mt-3 text-sm font-medium">Cargando negocios...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white py-20 text-center">
          <Building2 className="text-slate-300" size={48} />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {search ? "No se encontraron negocios con ese criterio." : "No hay negocios registrados aún."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
              <tr>
                <th className="px-5 py-3.5">Negocio / RUC</th>
                <th className="px-5 py-3.5">Cuenta</th>
                <th className="px-5 py-3.5">Ubicación</th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5">Último Trámite</th>
                <th className="px-5 py-3.5">Estado Cuenta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((n) => {
                const ultimoTramite = n.tramites[0];
                const badgeInfo = ultimoTramite ? estadoTramiteBadge[ultimoTramite.estado] : null;
                const cuentaActiva = n.usuario?.estado === "ACTIVO";

                return (
                  <tr key={n.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800 leading-tight">{n.razonSocial}</p>
                      <p className="mt-0.5 text-xs font-mono text-slate-500">{n.ruc}</p>
                    </td>
                    <td className="px-5 py-4">
                      {n.usuario ? (
                        <>
                          <p className="font-semibold text-slate-700 text-xs">{n.usuario.nombre}</p>
                          <p className="text-xs text-slate-500">{n.usuario.email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin cuenta</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-1.5 text-xs text-slate-600">
                        <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>
                          {n.domicilioFiscal}
                          <br />
                          <span className="text-slate-400">Dist. {n.distrito}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {n.telefono ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone size={13} className="text-slate-400" />
                          {n.telefono}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {badgeInfo ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeInfo.className}`}>
                          <FileText size={11} />
                          {badgeInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin trámite</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {n.usuario ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cuentaActiva ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {cuentaActiva ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {cuentaActiva ? "Activa" : "Inactiva"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
