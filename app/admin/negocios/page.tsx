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

  // Estado para controlar cuáles acordeones de negocio están desplegados
  const [expandedNegocioIds, setExpandedNegocioIds] = useState<Record<string, boolean>>({});

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
        const body: Negocio[] = await res.json();
        setNegocios(body);
        
        // Expandir por defecto el primer negocio o todos los que tienen múltiples sucursales
        const initialExpanded: Record<string, boolean> = {};
        body.forEach((n, index) => {
          if (index === 0 || n.tramites.length > 1) {
            initialExpanded[n.id] = true;
          }
        });
        setExpandedNegocioIds(prev => ({ ...initialExpanded, ...prev }));
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
    setExpandedNegocioIds((prev) => ({
      ...prev,
      [negocioId]: !prev[negocioId],
    }));
  };

  const abrirModalEditarFechas = (negocio: Negocio, tramite?: Tramite) => {
    setEditingNegocio(negocio);
    const selectedTramite = tramite || negocio.tramites[0] || null;
    setEditingTramite(selectedTramite);
    setEditError("");

    let inicio: Date;
    let fin: Date;

    if (selectedTramite?.licencia?.emitidaEn) {
      inicio = new Date(selectedTramite.licencia.emitidaEn);
      fin = new Date(selectedTramite.licencia.venceEn);
    } else if (selectedTramite?.pagos?.[0]?.fechaPago) {
      inicio = new Date(selectedTramite.pagos[0].fechaPago);
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
      n.tramites.some(t => (t.direccionTrujillo || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeading
        title="Negocios Registrados"
        description="Lista desplegable de negocios y sucursales registradas con licencias y fechas administrables."
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
            placeholder="Buscar por RUC, razón social, sucursal..."
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
          <p className="mt-3 text-sm font-medium">Cargando negocios y sucursales...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white py-20 text-center">
          <Building2 className="text-slate-300" size={48} />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {search ? "No se encontraron negocios con ese criterio." : "No hay negocios registrados aún."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.map((n) => {
            const isExpanded = Boolean(expandedNegocioIds[n.id]);
            const cuentaActiva = n.usuario?.estado === "ACTIVO";
            const totalSucursales = n.tramites.length;

            return (
              <div
                key={n.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* CABECERA PRINCIPAL DEL NEGOCIO (RUC / RAZÓN SOCIAL) */}
                <div
                  onClick={() => toggleExpand(n.id)}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 cursor-pointer bg-slate-50/50 hover:bg-indigo-50/40 transition select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-[280px]">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base leading-snug">{n.razonSocial}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-900">
                          🏬 {totalSucursales} {totalSucursales === 1 ? "Sucursal" : "Sucursales"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-mono text-slate-500">RUC: {n.ruc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-slate-600">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Domicilio Fiscal</span>
                      <div className="flex items-center gap-1 font-medium text-slate-700 mt-0.5">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span>{n.domicilioFiscal}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Cuenta de Usuario</span>
                      {n.usuario ? (
                        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cuentaActiva ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {cuentaActiva ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {n.usuario.email}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sin cuenta</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* TABLA ACCORDEÓN DESPLEGABLE CON LAS SUCURSALES / LOCALES DE ESTE NEGOCIO */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/80 p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Building2 size={14} className="text-indigo-600" />
                        Locales / Sucursales Registradas de este RUC ({totalSucursales}):
                      </p>
                      <span className="text-[11px] text-slate-500 italic">
                        Haz clic en &quot;Editar Fechas&quot; o &quot;Ver Licencia&quot; para administrar cada sucursal individualmente.
                      </span>
                    </div>

                    {totalSucursales === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                        No hay sucursales registradas aún para este RUC.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                          <thead className="bg-slate-100/80 text-[10px] uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Código Trámite</th>
                              <th className="px-4 py-3">Dirección del Local a Licenciar (Sucursal)</th>
                              <th className="px-4 py-3">Inicio Licencia (Fecha y Hora)</th>
                              <th className="px-4 py-3">Fin Licencia / Vencimiento</th>
                              <th className="px-4 py-3">Estado Sucursal</th>
                              <th className="px-4 py-3 text-center">Acciones de Sucursal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {n.tramites.map((tramite) => {
                              const badgeInfo = estadoTramiteBadge[tramite.estado] || { label: tramite.estado, className: "bg-slate-100 text-slate-700" };

                              let fechaInicioObj: Date;
                              let fechaFinObj: Date;

                              if (tramite.licencia?.emitidaEn) {
                                fechaInicioObj = new Date(tramite.licencia.emitidaEn);
                                fechaFinObj = new Date(tramite.licencia.venceEn);
                              } else if (tramite.pagos?.[0]?.fechaPago) {
                                fechaInicioObj = new Date(tramite.pagos[0].fechaPago);
                                fechaFinObj = new Date(fechaInicioObj);
                                fechaFinObj.setFullYear(fechaFinObj.getFullYear() + 1);
                              } else {
                                fechaInicioObj = new Date(tramite.creadoEn);
                                fechaFinObj = new Date(fechaInicioObj);
                                fechaFinObj.setFullYear(fechaFinObj.getFullYear() + 1);
                              }

                              const fechaInicioStr = formatFechaHora(fechaInicioObj);
                              const fechaFinStr = formatFechaHora(fechaFinObj);
                              const esVencida = new Date() > fechaFinObj;
                              const direccionSucursal = tramite.direccionTrujillo || n.domicilioFiscal;

                              return (
                                <tr key={tramite.id} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3.5 font-bold font-mono text-indigo-900">
                                    {tramite.codigo}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-start gap-1.5 text-slate-800 font-medium">
                                      <MapPin size={13} className="text-blue-600 shrink-0 mt-0.5" />
                                      <span>{direccionSucursal}</span>
                                    </div>
                                  </td>
                                  <td
                                    className="px-4 py-3.5 cursor-pointer hover:bg-blue-50/60 transition rounded-lg group"
                                    onClick={() => abrirModalEditarFechas(n, tramite)}
                                    title="Clic para modificar fecha y hora de inicio"
                                  >
                                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                      <Calendar size={13} className="text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                                      <span>{fechaInicioStr}</span>
                                      <Edit3 size={11} className="text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </td>
                                  <td
                                    className="px-4 py-3.5 cursor-pointer hover:bg-indigo-50/60 transition rounded-lg group"
                                    onClick={() => abrirModalEditarFechas(n, tramite)}
                                    title="Clic para modificar fecha y hora de vencimiento"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <CalendarCheck size={13} className="text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                                        <span>{fechaFinStr}</span>
                                        <Edit3 size={11} className="text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${esVencida ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>
                                        {esVencida ? "⚠️ Licencia Vencida" : "✓ Licencia Vigente"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeInfo.className}`}>
                                      {badgeInfo.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => window.open(`/api/licencias-pdf/${tramite.id}`, "_blank")}
                                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                                        title="Visualizar documento PDF de la licencia de esta sucursal"
                                      >
                                        <FileText size={12} />
                                        Ver Licencia
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => abrirModalEditarFechas(n, tramite)}
                                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                                        title="Modificar fecha y hora de esta sucursal"
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL ADMINISTRABLE PARA MODIFICAR FECHA Y HORA DE LICENCIA SUCURSAL */}
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
                  Ajusta los plazos de inicio y vencimiento para esta sucursal.
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

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5 space-y-1.5 text-xs text-slate-700">
              <p className="font-bold text-slate-900 text-sm">{editingNegocio.razonSocial}</p>
              <p className="font-mono text-slate-500">RUC: {editingNegocio.ruc}</p>
              {editingTramite && (
                <div className="border-t border-indigo-200/60 pt-1.5 mt-1 space-y-0.5">
                  <p className="font-bold text-indigo-950 font-mono">Trámite ID: {editingTramite.codigo}</p>
                  <p className="text-slate-700">
                    <strong>Sucursal:</strong> {editingTramite.direccionTrujillo || editingNegocio.domicilioFiscal}
                  </p>
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
