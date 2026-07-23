"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, Calendar, Clock, Coins, CreditCard, DollarSign, FileText, LoaderCircle, ShieldAlert, ShieldCheck, Printer, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSystemDateClient } from "@/lib/system-date-client";

type Pago = {
  id: string;
  monto: number;
  metodo: string;
  montoEfectivo: number;
  montoYape: number;
  montoTarjeta: number;
  vueltoTotal?: number;
  vueltoEfectivo?: number;
  vueltoYape?: number;
  tipoComprobante: string;
  numeroFactura?: string | null;
  fechaPago: string;
  estado: string;
  detalleEstado?: string | null;
  tramite: {
    codigo: string;
    negocio: {
      razonSocial: string;
      ruc: string;
      domicilioFiscal?: string | null;
    };
  };
};

type Inspeccion = {
  id: string;
  numeroVisita: number;
  fechaProgramada: string;
  bloqueHorario?: string | null;
  resultado: string;
  observaciones?: string | null;
  completadaEn?: string | null;
  inspector: {
    nombre: string;
  };
  tramite: {
    codigo: string;
    negocio: {
      razonSocial: string;
      ruc: string;
    };
  };
};

export default function AdminSupervisionPage() {
  const [activeTab, setActiveTab] = useState<"PAGOS" | "INSPECCIONES">("PAGOS");
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroInspecciones, setFiltroInspecciones] = useState<"TODAS" | "PASADAS" | "FUTURAS">("TODAS");
  const [selectedPagoForInvoice, setSelectedPagoForInvoice] = useState<Pago | null>(null);

  const cargarDatos = async () => {
    try {
      const res = await fetch(`/api/admin/supervision?t=${Date.now()}`);
      if (res.ok) {
        const body = await res.json();
        setPagos(body.pagos || []);
        setInspecciones(body.inspecciones || []);
      }
    } catch (err) {
      console.error("Error al cargar datos de supervisión:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarDatos();
  }, []);

  const getSystemDateNow = () => getSystemDateClient();

  const inspeccionesFiltradas = inspecciones.filter((i) => {
    if (filtroInspecciones === "TODAS") return true;
    const isCompleted = i.resultado !== "PENDIENTE";
    const scheduledTime = new Date(i.fechaProgramada).getTime();
    const currentTime = getSystemDateNow().getTime();
    const isPast = isCompleted || scheduledTime < currentTime;

    if (filtroInspecciones === "PASADAS" && isPast) return true;
    if (filtroInspecciones === "FUTURAS" && !isPast) return true;
    return false;
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Supervisión General"
        description="Monitorea en tiempo real todas las transacciones de pago e inspecciones técnicas de la Municipalidad."
      />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("PAGOS")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "PAGOS"
              ? "border-[var(--blue)] text-[var(--blue)]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Historial de Pagos
        </button>
        <button
          onClick={() => setActiveTab("INSPECCIONES")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === "INSPECCIONES"
              ? "border-[var(--blue)] text-[var(--blue)]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Agenda de Inspecciones
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
          <p className="text-sm font-medium text-slate-500">Cargando registros del sistema...</p>
        </div>
      ) : activeTab === "PAGOS" ? (
        /* VISTA PAGOS */
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <DollarSign size={18} className="text-[var(--blue)]" />
            Transacciones Registradas
          </h3>

          {pagos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No hay transacciones registradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[950px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3">Contribuyente / Trámite</th>
                    <th className="px-4 py-3">Comprobante</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Desglose de Pago</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Fecha Pago</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-850">{p.tramite.negocio.razonSocial}</p>
                        <p className="text-xs text-slate-500 font-mono">RUC: {p.tramite.negocio.ruc} | Trámite: {p.tramite.codigo}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-slate-700">
                        {p.numeroFactura ? (
                          <button
                            onClick={() => setSelectedPagoForInvoice(p)}
                            className="flex items-center gap-1 hover:text-blue-600 font-bold transition text-left cursor-pointer"
                          >
                            <FileText size={12} className="text-slate-400" />
                            {p.tipoComprobante}: {p.numeroFactura}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                          {p.metodo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {p.metodo === "MIXTO" ? (
                          <div className="space-y-0.5">
                            <p className="flex items-center gap-1"><Coins size={11} className="text-amber-600" />Efectivo/Tarjeta: S/ {Number(p.montoEfectivo).toFixed(2)}</p>
                            <p className="flex items-center gap-1"><CreditCard size={11} className="text-sky-600" />Yape: S/ {Number(p.montoYape).toFixed(2)}</p>
                            {Number(p.vueltoTotal || 0) > 0 && (
                              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-1">
                                💡 Vuelto: S/ {Number(p.vueltoTotal).toFixed(2)} (Efectivo: S/ {Number(p.vueltoEfectivo || 0).toFixed(2)} | Yape: S/ {Number(p.vueltoYape || 0).toFixed(2)})
                              </p>
                            )}
                          </div>
                        ) : p.metodo === "EFECTIVO" ? (
                          <p className="flex items-center gap-1"><Coins size={11} className="text-amber-600" />S/ {Number(p.monto).toFixed(2)}</p>
                        ) : p.metodo === "YAPE" ? (
                          <p className="flex items-center gap-1"><CreditCard size={11} className="text-sky-600" />S/ {Number(p.monto).toFixed(2)}</p>
                        ) : (
                          <p className="flex items-center gap-1"><CreditCard size={11} className="text-slate-500" />Tarjeta: S/ {Number(p.monto).toFixed(2)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        S/ {Number(p.monto).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(p.fechaPago).toLocaleString("es-PE")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge>
                          {p.estado === "APPROVED" ? "Aprobado" : "Pendiente"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VISTA INSPECCIONES */
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] pb-3 gap-3">
            <h3 className="text-base font-bold text-[var(--navy)] flex items-center gap-2">
              <Calendar size={18} className="text-[var(--blue)]" />
              Visitas de Seguridad
            </h3>
            
            {/* Filtros de inspección */}
            <div className="flex gap-2">
              {(["TODAS", "PASADAS", "FUTURAS"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFiltroInspecciones(opt)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition ${
                    filtroInspecciones === opt
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt === "TODAS" ? "Todas" : opt === "PASADAS" ? "Pasadas/Completadas" : "Futuras/Programadas"}
                </button>
              ))}
            </div>
          </div>

          {inspeccionesFiltradas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No se encontraron visitas de inspección.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[950px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3">Establecimiento / Trámite</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Bloque</th>
                    <th className="px-4 py-3">Visita</th>
                    <th className="px-4 py-3">Inspector Asignado</th>
                    <th className="px-4 py-3">Resultado</th>
                    <th className="px-4 py-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspeccionesFiltradas.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-850">{i.tramite.negocio.razonSocial}</p>
                        <p className="text-xs text-slate-500 font-mono">RUC: {i.tramite.negocio.ruc} | Trámite: {i.tramite.codigo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-800 font-semibold flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date(i.fechaProgramada).toLocaleDateString("es-PE")}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(i.fechaProgramada).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-slate-600">
                        {i.bloqueHorario || "Inopinada"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-xs font-bold text-slate-650">
                          {i.numeroVisita}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-slate-700">
                        {i.inspector.nombre}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge>
                          {i.resultado === "CONFORME" ? "Aprobado" : i.resultado === "PENDIENTE" ? "Pendiente" : "Observado"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={i.observaciones || "Sin observaciones"}>
                        {i.observaciones || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Visor de Factura para Administrador */}
      {selectedPagoForInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #factura-modal-imprimible, #factura-modal-imprimible * {
                  visibility: visible;
                }
                #factura-modal-imprimible {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: none !important;
                  box-shadow: none !important;
                  margin: 0 !important;
                  padding: 20px !important;
                }
              }
            `}</style>

            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileText size={16} className="text-blue-600" />
                Visor de Comprobante de Pago
              </h3>
              <button
                onClick={() => setSelectedPagoForInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div id="factura-modal-imprimible" className="border-2 border-black p-6 font-mono text-xs text-black space-y-4 bg-white">
                {/* Header */}
                <div className="text-center space-y-1">
                  <h2 className="text-sm font-black uppercase tracking-wider">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h2>
                  <p className="text-[10px] text-slate-700">RUC: 20175638381 | Jr. Almagro N° 412, Trujillo</p>
                  <p className="text-[10px] text-slate-500 font-bold">SUBGERENCIA DE LICENCIAS Y COMERCIALIZACIÓN</p>
                </div>

                <hr className="border-t-2 border-black my-2" />

                {/* Doc Title and Number */}
                <div className="flex justify-between items-center text-xs font-bold bg-slate-50 p-2.5 border border-black">
                  <span className="uppercase">{selectedPagoForInvoice.tipoComprobante === "BOLETA" ? "Boleta de Venta" : "Factura Electrónica"}</span>
                  <span>N° {selectedPagoForInvoice.numeroFactura}</span>
                </div>

                {/* Client / Business Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] leading-relaxed pt-1">
                  <div>
                    <p><strong>Razón Social:</strong> <span className="font-normal">{selectedPagoForInvoice.tramite.negocio.razonSocial}</span></p>
                    <p className="mt-1"><strong>RUC:</strong> <span className="font-normal">{selectedPagoForInvoice.tramite.negocio.ruc}</span></p>
                    <p className="mt-1"><strong>Dirección:</strong> <span className="font-normal">{selectedPagoForInvoice.tramite.negocio.domicilioFiscal || "—"}</span></p>
                  </div>
                  <div>
                    <p><strong>Fecha Pago:</strong> <span className="font-normal">{new Date(selectedPagoForInvoice.fechaPago).toLocaleDateString("es-PE")}</span></p>
                    <p className="mt-1"><strong>Método Pago:</strong> <span className="font-semibold text-blue-900">{selectedPagoForInvoice.detalleEstado || selectedPagoForInvoice.metodo}</span></p>
                    <p className="mt-1"><strong>Código Trámite:</strong> <span className="font-normal">{selectedPagoForInvoice.tramite.codigo}</span></p>
                  </div>
                </div>

                <hr className="border-t border-dashed border-black my-2" />

                {/* Items Table */}
                <div className="space-y-1">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-black font-bold">
                        <th className="py-1">Cant.</th>
                        <th className="py-1">Código</th>
                        <th className="py-1">Descripción</th>
                        <th className="py-1 text-right">P. Unit.</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      <tr>
                        <td className="py-1.5">1</td>
                        <td className="py-1.5 font-mono">SERV-001</td>
                        <td className="py-1.5">Derecho de Trámite Licencia de Funcionamiento (Trujillo)</td>
                        <td className="py-1.5 text-right">180.00</td>
                        <td className="py-1.5 text-right font-bold">180.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Total Box */}
                <div className="flex justify-end pt-2 border-t border-black">
                  <div className="border-2 border-black bg-slate-50 px-4 py-1.5 flex items-center gap-6 font-bold text-xs">
                    <span>IMPORTE TOTAL:</span>
                    <span className="font-black text-sm">S/ 180.00</span>
                  </div>
                </div>

                {/* Amount in words */}
                <div className="border border-black p-2 text-center font-bold text-[10px] uppercase tracking-wide">
                  SON: CIENTO OCHENTA CON 00/100 SOLES
                </div>

                {/* Footer breakdown */}
                <div className="text-right text-[9px] text-slate-600 font-mono pt-1">
                  Op. Gravada: S/ 152.54 | IGV (18%): S/ 27.46 | Hash: {(selectedPagoForInvoice.id || "78F29A9A").slice(-8).toUpperCase()}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
              >
                <Printer size={14} />
                Imprimir Comprobante
              </button>
              <button
                onClick={() => setSelectedPagoForInvoice(null)}
                className="flex-1 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition"
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
