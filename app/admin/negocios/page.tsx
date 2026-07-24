"use client";

import React, { useEffect, useState } from "react";
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
  ExternalLink,
  FileCode,
  FileText,
  History,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Save,
  Store,
  User,
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

type HistorialItem = {
  id: string;
  fechaHora: string;
  negocioRuc: string;
  razonSocial: string;
  usuarioNombre: string;
  usuarioEmail: string;
  codigoTramite: string;
  direccionSucursal: string;
  tipoModificacion: string;
  descripcion: string;
  planoUrl?: string | null;
  declaracionUrl?: string | null;
  estadoResultante?: string | null;
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
  const [activeTab, setActiveTab] = useState<"negocios" | "historial">("negocios");

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
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

  // Modal para ver plano en la misma página
  const [planoModalItem, setPlanoModalItem] = useState<HistorialItem | null>(null);

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

  const cargarHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const res = await fetch(`/api/admin/negocios-historial?t=${Date.now()}`);
      if (res.ok) {
        const body = await res.json();
        setHistorial(body);
      }
    } catch (err) {
      console.error("Error al cargar historial:", err);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const refrescarTodoSilencioso = async () => {
    try {
      const [resNeg, resHist] = await Promise.all([
        fetch(`/api/admin/negocios?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/admin/negocios-historial?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (resNeg.ok) {
        const bodyNeg = await resNeg.json();
        setNegocios(bodyNeg);
      }
      if (resHist.ok) {
        const bodyHist = await resHist.json();
        setHistorial(bodyHist);
      }
    } catch (err) {
      console.error("Error al refrescar datos en segundo plano:", err);
    }
  };

  useEffect(() => {
    void cargarNegocios();
    void cargarHistorial();

    const interval = setInterval(() => {
      void refrescarTodoSilencioso();
    }, 2000);

    const handleFocusOrVisibility = () => {
      void refrescarTodoSilencioso();
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, []);

  useEffect(() => {
    void refrescarTodoSilencioso();
  }, [activeTab]);

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
      await cargarHistorial();
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

  const historialFiltrado = historial.filter(
    (h) =>
      h.negocioRuc.includes(search) ||
      h.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      h.codigoTramite.toLowerCase().includes(search.toLowerCase()) ||
      h.direccionSucursal.toLowerCase().includes(search.toLowerCase()) ||
      h.tipoModificacion.toLowerCase().includes(search.toLowerCase()) ||
      h.descripcion.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeading
        title="Gestión de Negocios Registrados"
        description="Administra los negocios RUCs, sus sucursales desplegables y revisa el historial completo de modificaciones."
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

      {/* BOTONES DE NAVEGACIÓN ENTRE VISTAS (TABS) */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("negocios")}
          className={`inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-xs font-bold transition shadow-sm ${
            activeTab === "negocios"
              ? "bg-[var(--blue)] text-white shadow-blue-200"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Building2 size={16} />
          Negocios Registrados
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("historial")}
          className={`inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-xs font-bold transition shadow-sm ${
            activeTab === "historial"
              ? "bg-[var(--blue)] text-white shadow-blue-200"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <History size={16} />
          Historial de Negocios
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "negocios"
                ? "Buscar por RUC, razón social o dirección de sucursal..."
                : "Buscar por RUC, razón social, trámite o tipo de modificación..."
            }
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-4 text-sm outline-none focus:border-[var(--blue)]"
          />
        </div>
        <span className="text-sm font-semibold text-slate-500">
          {activeTab === "negocios"
            ? `${filtrados.length} negocio${filtrados.length !== 1 ? "s" : ""}`
            : `${historialFiltrado.length} registro${historialFiltrado.length !== 1 ? "s" : ""}`}
        </span>

        <button
          type="button"
          onClick={() => void refrescarTodoSilencioso()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm active:scale-95 ml-auto"
          title="Actualizar datos en tiempo real"
        >
          <RefreshCw size={14} className="text-indigo-600" />
          Actualizar
        </button>
      </div>

      {/* TAB 1: NEGOCIOS REGISTRADOS (TABLA CON SUBFILAS DESPLEGABLES) */}
      {activeTab === "negocios" && (
        loading ? (
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
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3.5 w-10 text-center"></th>
                  <th className="px-4 py-3.5">NEGOCIO / RUC / SUCURSAL</th>
                  <th className="px-4 py-3.5">CUENTA / CÓDIGO TRÁMITE</th>
                  <th className="px-4 py-3.5">DIRECCIÓN (SUNAT / SUCURSAL)</th>
                  <th className="px-4 py-3.5">FECHAS LICENCIA</th>
                  <th className="px-4 py-3.5">ESTADO</th>
                  <th className="px-4 py-3.5 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtrados.map((n) => {
                  const isExpanded = Boolean(expandedNegocios[n.id]);
                  const numSucursales = n.tramites.length;
                  const cuentaActiva = n.usuario?.estado === "ACTIVO";

                  return (
                    <React.Fragment key={n.id}>
                      {/* FILA PRINCIPAL DEL RUC EN LA TABLA */}
                      <tr
                        onClick={() => toggleExpand(n.id)}
                        className={`cursor-pointer transition ${
                          isExpanded ? "bg-slate-100/90" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-4 text-center">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/80 text-slate-700 transition hover:bg-slate-300"
                          >
                            {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900 text-sm leading-snug">{n.razonSocial}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                              RUC: {n.ruc}
                            </span>
                            <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full text-[11px]">
                              🏢 {numSucursales} {numSucursales === 1 ? "Sucursal / Local" : "Sucursales / Locales"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-800">{n.usuario?.nombre || "Sin cuenta"}</p>
                          <p className="text-slate-500 text-xs">{n.usuario?.email || "—"}</p>
                        </td>

                        <td className="px-4 py-4 text-slate-700 max-w-[240px]">
                          <div className="flex items-start gap-1.5">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <span className="leading-snug">{n.domicilioFiscal}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-slate-400 italic">
                          {numSucursales > 0 ? `${numSucursales} local(es)` : "Sin registros"}
                        </td>

                        <td className="px-4 py-4">
                          {n.usuario ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                                cuentaActiva ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {cuentaActiva ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              {cuentaActiva ? "Activa" : "Inactiva"}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(n.id);
                            }}
                            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                          >
                            {isExpanded ? "Ocultar" : `Ver Sucursales (${numSucursales})`}
                          </button>
                        </td>
                      </tr>

                      {/* SUBFILAS DE SUCURSALES DIRECTAMENTE EN LA MISMA TABLA */}
                      {isExpanded &&
                        (numSucursales === 0 ? (
                          <tr key={`${n.id}-empty`} className="bg-slate-50">
                            <td></td>
                            <td colSpan={6} className="px-4 py-3 text-slate-500 italic text-xs">
                              No hay sucursales ni trámites registrados para este RUC.
                            </td>
                          </tr>
                        ) : (
                          n.tramites.map((t, idx) => {
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
                              <tr
                                key={t.id}
                                className="bg-indigo-50/40 hover:bg-indigo-50/70 transition border-t border-slate-200"
                              >
                                <td className="px-3 py-3 text-right text-indigo-400 font-mono text-xs">
                                  └
                                </td>

                                <td className="px-4 py-3 pl-6 font-medium text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <Building2 size={14} className="text-indigo-600 shrink-0" />
                                    <span className="font-bold text-slate-900">Sucursal #{idx + 1}</span>
                                  </div>
                                </td>

                                <td className="px-4 py-3 font-mono font-bold text-indigo-900">
                                  {t.codigo}
                                </td>

                                <td className="px-4 py-3 font-medium text-slate-800 max-w-[240px]">
                                  <div className="flex items-start gap-1.5">
                                    <MapPin size={13} className="mt-0.5 shrink-0 text-indigo-600" />
                                    <span className="leading-snug">{direccionSucursal}</span>
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <div
                                      className="flex items-center gap-1.5 cursor-pointer hover:underline text-slate-700"
                                      onClick={() => abrirModalEditarFechas(n, t)}
                                      title="Clic para editar inicio"
                                    >
                                      <Calendar size={12} className="text-blue-600 shrink-0" />
                                      <span>Inicio: {fechaInicioStr}</span>
                                    </div>
                                    <div
                                      className="flex items-center gap-1.5 font-bold text-slate-900 cursor-pointer hover:underline"
                                      onClick={() => abrirModalEditarFechas(n, t)}
                                      title="Clic para editar vencimiento"
                                    >
                                      <CalendarCheck size={12} className="text-indigo-600 shrink-0" />
                                      <span>Fin: {fechaFinStr}</span>
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
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeInfo.className}`}
                                    >
                                      <FileText size={11} />
                                      {badgeInfo.label}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Sin estado</span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => window.open(`/api/licencias-pdf/${t.id}`, "_blank")}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                                      title="Ver documento PDF de la licencia para esta sucursal"
                                    >
                                      <FileText size={12} />
                                      Ver Licencia
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => abrirModalEditarFechas(n, t)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                                      title="Modificar fecha y hora para esta sucursal"
                                    >
                                      <Edit3 size={12} />
                                      Editar Fechas
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* TAB 2: HISTORIAL DE MODIFICACIONES DE NEGOCIOS */}
      {activeTab === "historial" && (
        loadingHistorial ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
            <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
            <p className="mt-3 text-sm font-medium">Cargando historial de modificaciones de negocios...</p>
          </div>
        ) : historialFiltrado.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white py-20 text-center">
            <History className="text-slate-300" size={48} />
            <p className="mt-4 text-sm font-semibold text-slate-500">
              {search ? "No hay registros con ese criterio de búsqueda." : "No hay modificaciones registradas en el historial."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">FECHA Y HORA</th>
                  <th className="px-4 py-3.5">NEGOCIO / RUC</th>
                  <th className="px-4 py-3.5">LOCAL / SUCURSAL</th>
                  <th className="px-4 py-3.5">TIPO DE MODIFICACIÓN</th>
                  <th className="px-4 py-3.5">DETALLE DE CAMBIOS</th>
                  <th className="px-4 py-3.5 text-center">PLANOS / ADJUNTOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historialFiltrado.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-4 w-[170px]">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 whitespace-nowrap">
                        <Clock size={13} className="text-indigo-600 shrink-0" />
                        <span>{formatFechaHora(h.fechaHora)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 leading-snug mt-1.5">
                        <p className="font-semibold text-slate-400">Por:</p>
                        <p className="font-medium text-slate-600 break-words">{h.usuarioNombre}</p>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900 text-sm leading-snug">{h.razonSocial}</p>
                      <p className="font-mono text-xs font-semibold text-slate-500 mt-0.5">RUC: {h.negocioRuc}</p>
                    </td>

                    <td className="px-4 py-4 max-w-[230px]">
                      <span className="font-mono font-bold text-indigo-900 block text-xs">{h.codigoTramite}</span>
                      <div className="flex items-start gap-1 text-slate-600 mt-0.5">
                        <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="leading-snug">{h.direccionSucursal}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-800">
                        <History size={12} />
                        {h.tipoModificacion}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-slate-700 max-w-[280px]">
                      <p className="leading-relaxed font-medium">{h.descripcion}</p>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {h.planoUrl ? (
                        <button
                          type="button"
                          onClick={() => setPlanoModalItem(h)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-sm active:scale-95"
                          title="Visualizar plano en la misma página"
                        >
                          <FileCode size={13} className="text-blue-600" />
                          <span>Ver Plano</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Sin plano cargado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
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

      {/* MODAL EN LA MISMA PÁGINA PARA VISUALIZAR PLANO ARQUITECTÓNICO */}
      {planoModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Cabecera del modal */}
            <div className="flex items-start justify-between border-b border-slate-100 p-5 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-indigo-600" />
                  Plano Arquitectónico y Distribución de Ambientes
                </h3>
                <p className="text-xs text-slate-700 mt-1">
                  Empresa: <strong className="text-slate-900">{planoModalItem.razonSocial}</strong> &bull; RUC: <span className="font-mono">{planoModalItem.negocioRuc}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Local: <span>{planoModalItem.direccionSucursal}</span> &bull; Trámite: <span className="font-mono font-bold text-indigo-700">{planoModalItem.codigoTramite}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanoModalItem(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cuerpo del modal (Visor del plano en la misma página) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100 flex flex-col items-center justify-center">
              {planoModalItem.planoUrl && (planoModalItem.planoUrl.startsWith("data:image") || planoModalItem.planoUrl.startsWith("http")) ? (
                <div className="w-full max-w-3xl rounded-2xl border border-slate-300 bg-white p-4 shadow-md space-y-3 text-center">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-bold text-slate-700">Imagen Adjunta del Plano (Cargada por el Negocio)</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      <CheckCircle2 size={13} /> Plano Validado por la MPT
                    </span>
                  </div>
                  <img
                    src={planoModalItem.planoUrl}
                    alt="Plano Arquitectónico Adjunto"
                    className="max-h-[520px] w-auto max-w-full rounded-xl object-contain mx-auto shadow-sm border border-slate-200"
                  />
                </div>
              ) : (
                <div className="w-full max-w-3xl rounded-2xl border-2 border-indigo-900 bg-[#0a2540] p-6 text-white shadow-xl relative overflow-hidden space-y-6">
                  <div className="flex items-center justify-between border-b border-blue-800/80 pb-3">
                    <div>
                      <h4 className="text-xs font-bold tracking-wider text-blue-200 uppercase">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h4>
                      <p className="text-[10px] text-blue-300">SUBGERENCIA DE EDIFICACIONES — DIBUJO ARQUITECTÓNICO EN PLANTA CON COTAS Y SEGURIDAD</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/40">
                      <CheckCircle2 size={13} />
                      PLANO VALIDADO MPT
                    </span>
                  </div>

                  {/* Gráfica del Plano Vectorial */}
                  <div className="relative min-h-[300px] w-full rounded-xl border-2 border-white/80 bg-[#081f36] p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start text-[10px] text-blue-300 font-mono">
                      <span>[ EJE X: 15.00m ]</span>
                      <span>[ VISTA EN PLANTA — ESCALA 1:50 ]</span>
                      <span>[ EJE Y: 12.00m ]</span>
                    </div>

                    {/* Distribución Técnica de Ambientes */}
                    <div className="my-6 grid grid-cols-12 gap-3 h-48">
                      <div className="col-span-8 rounded-lg border-2 border-dashed border-white/60 bg-blue-900/40 p-4 flex flex-col items-center justify-center text-center relative">
                        <span className="absolute top-2 left-2 text-[9px] text-sky-300 font-mono">► INGRESO PRINCIPAL</span>
                        <p className="text-sm font-bold text-white tracking-wide">ZONA COMERCIAL Y ATENCIÓN AL PÚBLICO</p>
                        <p className="text-[11px] text-blue-200 mt-1">Piso: Porcelanato de alto tránsito &bull; Área: 120.50 m²</p>
                      </div>
                      <div className="col-span-4 flex flex-col gap-3">
                        <div className="flex-1 rounded-lg border-2 border-dashed border-white/60 bg-blue-950/60 p-2 flex flex-col items-center justify-center text-center">
                          <p className="text-xs font-bold text-white">ALMACÉN / OFICINA</p>
                          <p className="text-[10px] text-blue-300">Área: 35.20 m²</p>
                        </div>
                        <div className="flex-1 rounded-lg border-2 border-dashed border-white/60 bg-blue-950/60 p-2 flex flex-col items-center justify-center text-center">
                          <p className="text-xs font-bold text-white">S.S.H.H. DAMAS / VARONES</p>
                          <p className="text-[10px] text-blue-300">Ventilación Directa &bull; 15.80 m²</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end border-t border-blue-800/80 pt-3">
                      <div className="rounded-lg bg-emerald-950/80 border border-emerald-500/50 px-3 py-1.5 text-xs text-emerald-300 font-semibold">
                        ✓ Inspección y Sello de Seguridad N° {planoModalItem.codigoTramite}
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">Salida de Emergencia ◄</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pie del modal */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white p-4">
              <a
                href={`/api/planos-pdf/${planoModalItem.codigoTramite}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-md active:scale-95"
              >
                <ExternalLink size={15} />
                Abrir / Descargar PDF Oficial del Plano
              </a>
              <button
                type="button"
                onClick={() => setPlanoModalItem(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
