"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  LoaderCircle,
  MapPin,
  Save,
  Store,
  X,
  XCircle,
} from "lucide-react";

type Tramite = {
  id: string;
  codigo: string;
  estado: string;
  direccionTrujillo?: string | null;
  rubro?: string | null;
  tipoTramite?: string | null;
  creadoEn: string;
  licencia?: {
    id: string;
    numero: string;
    emitidaEn: string;
    venceEn: string;
  } | null;
  pagos?: {
    fechaPago: string;
  }[];
};

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
  tramites: Tramite[];
};

const estadoTramiteBadge: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  PAGO_PENDIENTE: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  PAGO_RECHAZADO: { label: "Pago Rechazado", className: "bg-red-50 text-red-700" },
  INSPECCION_PROGRAMADA: { label: "Insp. Programada", className: "bg-blue-50 text-blue-700" },
  OBSERVADO: { label: "Observado", className: "bg-orange-50 text-orange-700" },
  APROBADO: { label: "Aprobado", className: "bg-emerald-50 text-emerald-700" },
  DENEGADO: { label: "Denegado", className: "bg-red-50 text-red-700" },
  VENCIDO: { label: "Vencido", className: "bg-red-100 text-red-800" },
};

const toDatetimeLocal = (dateStr?: string | Date): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatFechaHora = (dateStr?: string | Date): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function AdminNegociosPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedNegocios, setExpandedNegocios] = useState<Record<string, boolean>>({});

  // Modal para editar fechas y horas de licencia
  const [editingNegocio, setEditingNegocio] = useState<Negocio | null>(null);
  const [editingTramite, setEditingTramite] = useState<Tramite | null>(null);
  const [emitidaEnInput, setEmitidaEnInput] = useState("");
  const [venceEnInput, setVenceEnInput] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editError, setEditError] = useState("");
  const [toastSuccess, setToastSuccess] = useState("");

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

  const toggleExpand = (negocioId: string) => {
    setExpandedNegocios((prev) => ({
      ...prev,
      [negocioId]: !prev[negocioId],
    }));
  };

  const abrirModalEditarFechas = (negocio: Negocio, tramite?: Tramite) => {
    setEditingNegocio(negocio);
    const targetTramite = tramite || negocio.tramites[0] || null;
    setEditingTramite(targetTramite);
    setEditError("");

    let inicio: Date;
    let fin: Date;

    if (targetTramite?.licencia?.emitidaEn) {
      inicio = new Date(targetTramite.licencia.emitidaEn);
      fin = new Date(targetTramite.licencia.venceEn);
    } else if (targetTramite?.pagos?.[0]?.fechaPago) {
      inicio = new Date(targetTramite.pagos[0].fechaPago);
      fin = new Date(inicio);
      fin.setFullYear(fin.getFullYear() + 1);
    } else {
      inicio = new Date(negocio.creadoEn);
      fin = new Date(inicio);
      fin.setFullYear(fin.getFullYear() + 1);
    }

    setEmitidaEnInput(toDatetimeLocal(inicio));
    setVenceEnInput(toDatetimeLocal(fin));
  };

  const handleAplicarPredet1Ano = () => {
    if (!emitidaEnInput) return;
    const inicio = new Date(emitidaEnInput);
    if (isNaN(inicio.getTime())) return;
    const fin = new Date(inicio);
    fin.setFullYear(fin.getFullYear() + 1);
    setVenceEnInput(toDatetimeLocal(fin));
  };

  const handleAplicarPredet6Meses = () => {
    if (!emitidaEnInput) return;
    const inicio = new Date(emitidaEnInput);
    if (isNaN(inicio.getTime())) return;
    const fin = new Date(inicio);
    fin.setMonth(fin.getMonth() + 6);
    setVenceEnInput(toDatetimeLocal(fin));
  };

  const handleAplicarVencerHoy = () => {
    const ayer = new Date();
    ayer.setMinutes(ayer.getMinutes() - 5);
    setVenceEnInput(toDatetimeLocal(ayer));
  };

  const handleGuardarFechasLicencia = async () => {
    if (!editingNegocio) return;
    if (!emitidaEnInput || !venceEnInput) {
      setEditError("Ambas fechas y horas son obligatorias.");
      return;
    }

    setGuardando(true);
    setEditError("");

    try {
      const res = await fetch("/api/admin/licencias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId: editingNegocio.id,
          tramiteId: editingTramite?.id,
          emitidaEn: new Date(emitidaEnInput).toISOString(),
          venceEn: new Date(venceEnInput).toISOString(),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "No se pudieron actualizar las fechas de la licencia.");
      }

      setToastSuccess(`¡Fechas de licencia actualizadas con éxito para ${editingNegocio.razonSocial}!`);
      setEditingNegocio(null);
      setEditingTramite(null);
      await cargarNegocios();
      setTimeout(() => setToastSuccess(""), 4000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al guardar las fechas.");
    } finally {
      setGuardando(false);
    }
  };

  const filtrados = negocios.filter(
    (n) =>
      n.ruc.includes(search) ||
      n.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      n.distrito.toLowerCase().includes(search.toLowerCase()) ||
      n.tramites.some((t) => (t.direccionTrujillo || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeading
        title="Negocios Registrados"
        description="Tabla con filas desplegables para visualizar cada negocio RUC y sus respectivas sucursales o locales."
      />

      {toastSuccess && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{toastSuccess}</span>
          </div>
          <button onClick={() => setToastSuccess("")} className="text-emerald-700 hover:text-emerald-900">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por RUC, razón social o dirección de sucursal..."
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
          <p className="mt-3 text-sm font-medium">Cargando tabla de negocios y sucursales...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white py-20 text-center">
          <Building2 className="text-slate-300" size={48} />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {search ? "No se encontraron negocios con ese criterio." : "No hay negocios registrados aún."}
          </p>
        </div>
      ) : (
        /* TABLA UNIFICADA DE NEGOCIOS CON FILAS DESPLEGABLES */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">NEGOCIO / RUC</th>
                <th className="px-5 py-3.5">CUENTA</th>
                <th className="px-5 py-3.5">UBICACIÓN (SUNAT)</th>
                <th className="px-5 py-3.5 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtrados.map((n) => {
                const isExpanded = Boolean(expandedNegocios[n.id]);
                const numSucursales = n.tramites.length;
                const cuentaActiva = n.usuario?.estado === "ACTIVO";

                return (
                  <FragmentRow
                    key={n.id}
                    n={n}
                    isExpanded={isExpanded}
                    numSucursales={numSucursales}
                    cuentaActiva={cuentaActiva}
                    toggleExpand={() => toggleExpand(n.id)}
                    abrirModalEditarFechas={abrirModalEditarFechas}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL ADMINISTRABLE PARA MODIFICAR FECHA Y HORA DE LICENCIA */}
      {editingNegocio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  Modificar Fechas y Horas de Licencia
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajusta los plazos oficiales de inicio y vencimiento para este local.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingNegocio(null);
                  setEditingTramite(null);
                }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-xs text-slate-700">
              <p className="font-bold text-slate-900 text-sm">{editingNegocio.razonSocial}</p>
              <p className="font-mono text-slate-500">RUC: {editingNegocio.ruc}</p>
              {editingTramite && (
                <div className="pt-1.5 border-t border-slate-200 text-indigo-900 font-semibold space-y-0.5">
                  <p>Trámite: <strong>{editingTramite.codigo}</strong></p>
                  <p>Local: <strong>{editingTramite.direccionTrujillo || editingNegocio.domicilioFiscal}</strong></p>
                </div>
              )}
            </div>

            {editError && (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-semibold">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600" />
                  Fecha y Hora de Inicio de Licencia:
                </label>
                <input
                  type="datetime-local"
                  value={emitidaEnInput}
                  onChange={(e) => setEmitidaEnInput(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <CalendarCheck size={14} className="text-indigo-600" />
                  Fecha y Hora de Fin / Vencimiento:
                </label>
                <input
                  type="datetime-local"
                  value={venceEnInput}
                  onChange={(e) => setVenceEnInput(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              {/* Botones de atajo rápido */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500">Ajustes rápidos de vigencia:</p>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={handleAplicarPredet1Ano}
                    className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-slate-700 hover:bg-slate-100 transition"
                  >
                    +1 Año
                  </button>
                  <button
                    type="button"
                    onClick={handleAplicarPredet6Meses}
                    className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-slate-700 hover:bg-slate-100 transition"
                  >
                    +6 Meses
                  </button>
                  <button
                    type="button"
                    onClick={handleAplicarVencerHoy}
                    className="rounded-xl border border-red-200 bg-red-50 py-1.5 text-red-700 hover:bg-red-100 transition"
                  >
                    ⚡ Vencer Hoy
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setEditingNegocio(null);
                  setEditingTramite(null);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarFechasLicencia}
                disabled={guardando}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 px-5 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
              >
                {guardando ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  n,
  isExpanded,
  numSucursales,
  cuentaActiva,
  toggleExpand,
  abrirModalEditarFechas,
}: {
  n: Negocio;
  isExpanded: boolean;
  numSucursales: number;
  cuentaActiva: boolean;
  toggleExpand: () => void;
  abrirModalEditarFechas: (negocio: Negocio, tramite?: Tramite) => void;
}) {
  return (
    <>
      {/* FILA PRINCIPAL DE LA TABLA */}
      <tr
        onClick={toggleExpand}
        className={`cursor-pointer transition ${isExpanded ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-snug">{n.razonSocial}</p>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  RUC: {n.ruc}
                </span>
                <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full text-[11px]">
                  🏢 {numSucursales} {numSucursales === 1 ? "Sucursal" : "Sucursales"}
                </span>
              </div>
            </div>
          </div>
        </td>

        <td className="px-5 py-4">
          <p className="font-bold text-slate-800">{n.usuario?.nombre || "Sin cuenta"}</p>
          <p className="text-slate-500 text-xs mt-0.5">{n.usuario?.email || "—"}</p>
          {n.usuario && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold mt-1 ${
                cuentaActiva ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {cuentaActiva ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              {cuentaActiva ? "Activa" : "Inactiva"}
            </span>
          )}
        </td>

        <td className="px-5 py-4 text-slate-700 max-w-[250px]">
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span className="leading-snug">{n.domicilioFiscal}</span>
          </div>
        </td>

        <td className="px-5 py-4 text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand();
            }}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
          >
            {isExpanded ? "Ocultar Sucursales" : `Ver Sucursales (${numSucursales})`}
          </button>
        </td>
      </tr>

      {/* SUBFILA DESPLEGABLE CON TABLA SECUNDARIA DE SUCURSALES */}
      {isExpanded && (
        <tr className="bg-slate-50/80">
          <td colSpan={4} className="p-4 border-t border-b border-slate-200">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Building2 size={15} className="text-indigo-600" />
                  Sucursales / Locales Registrados a este RUC ({numSucursales}):
                </h4>
                <span className="text-[11px] text-slate-500 italic">
                  Haz clic en &quot;Editar Fechas&quot; o &quot;Ver Licencia&quot; para administrar cada sucursal individualmente.
                </span>
              </div>

              {numSucursales === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                  No hay trámites ni sucursales registradas para este RUC.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                    <thead className="bg-slate-100 text-[11px] uppercase text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Código Trámite</th>
                        <th className="px-4 py-2.5">Dirección del Local a Licenciar (Sucursal)</th>
                        <th className="px-4 py-2.5">Inicio Licencia (Fecha y Hora)</th>
                        <th className="px-4 py-2.5">Fin Licencia / Vencimiento</th>
                        <th className="px-4 py-2.5">Estado Sucursal</th>
                        <th className="px-4 py-2.5 text-center">Acciones de Sucursal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {n.tramites.map((t) => {
                        const badgeInfo = estadoTramiteBadge[t.estado];

                        let fechaInicioObj: Date;
                        let fechaFinObj: Date;

                        if (t.licencia?.emitidaEn) {
                          fechaInicioObj = new Date(t.licencia.emitidaEn);
                          fechaFinObj = new Date(t.licencia.venceEn);
                        } else if (t.pagos?.[0]?.fechaPago) {
                          fechaInicioObj = new Date(t.pagos[0].fechaPago);
                          fechaFinObj = new Date(fechaInicioObj);
                          fechaFinObj.setFullYear(fechaFinObj.getFullYear() + 1);
                        } else {
                          fechaInicioObj = new Date(t.creadoEn);
                          fechaFinObj = new Date(fechaInicioObj);
                          fechaFinObj.setFullYear(fechaFinObj.getFullYear() + 1);
                        }

                        const fechaInicioStr = formatFechaHora(fechaInicioObj);
                        const fechaFinStr = formatFechaHora(fechaFinObj);
                        const esVencida = new Date() > fechaFinObj;
                        const direccionSucursal = t.direccionTrujillo || n.domicilioFiscal;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-900">
                              {t.codigo}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              <div className="flex items-start gap-1.5">
                                <MapPin size={13} className="mt-0.5 shrink-0 text-indigo-600" />
                                <span>{direccionSucursal}</span>
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer hover:bg-blue-50/70 transition rounded-lg group"
                              onClick={() => abrirModalEditarFechas(n, t)}
                              title="Clic para modificar fecha y hora de inicio"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                <Calendar size={13} className="text-blue-600 shrink-0" />
                                <span>{fechaInicioStr}</span>
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 cursor-pointer hover:bg-indigo-50/70 transition rounded-lg group"
                              onClick={() => abrirModalEditarFechas(n, t)}
                              title="Clic para modificar fecha y hora de vencimiento"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                  <CalendarCheck size={13} className="text-indigo-600 shrink-0" />
                                  <span>{fechaFinStr}</span>
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    esVencida ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {esVencida ? "⚠️ Licencia Vencida" : "✓ Licencia Vigente"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {badgeInfo ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeInfo.className}`}
                                >
                                  <FileText size={11} />
                                  {badgeInfo.label}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Sin estado</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => window.open(`/api/licencias-pdf/${t.id}`, "_blank")}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                                  title="Ver documento PDF de la licencia para este local"
                                >
                                  <FileText size={12} />
                                  Ver Licencia
                                </button>

                                <button
                                  type="button"
                                  onClick={() => abrirModalEditarFechas(n, t)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                                  title="Modificar fecha y hora de inicio y vencimiento para este local"
                                >
                                  <Edit3 size={12} />
                                  Editar Fechas
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
