"use client";

import { useEffect, useState, useTransition } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, ArrowUpRight, Building2, Check, CheckCircle2, Clock, Coins, CreditCard, DollarSign, Eye, Landmark, LoaderCircle, Plus, ShieldCheck, Store, Wallet, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Pago = {
  id: string;
  monto: number;
  montoEfectivo: number;
  montoYape: number;
  metodo: string;
  estado: string;
  tipoComprobante: string;
  numeroFactura?: string | null;
  fechaPago: string;
  tramite: {
    codigo: string;
    negocio: {
      razonSocial: string;
      ruc: string;
    };
  };
};

type CajaSession = {
  id: string;
  montoApertura: number;
  montoCierreEfectivo?: number | null;
  montoCierreYape?: number | null;
  diferenciaArqueo?: number | null;
  justificacionArqueo?: string | null;
  estado: "ABIERTA" | "SOLICITADO_CIERRE" | "CERRADA" | "SOLICITADO_APERTURA";
  fechaApertura: string;
  fechaCierre?: string | null;
  cajero: {
    id: string;
    nombre: string;
    email: string;
  };
  pagos?: Pago[];
};

type TesoreriaMPT = {
  efectivoBoveda: number;
  digitales: number;
  depositosDirectos: number;
  total: number;
};

type DineroCajeros = {
  efectivo: number;
  yape: number;
  total: number;
};

type DepositoDirecto = {
  id: string;
  monto: number;
  concepto: string;
  referencia?: string | null;
  registradoPor: string;
  creadoEn: string;
};

type CajeroInfo = {
  id: string;
  nombre: string;
  email: string;
};

export default function AdminCajasPage() {
  const [sessions, setSessions] = useState<CajaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedSession, setSelectedSession] = useState<CajaSession | null>(null);
  const [pending, startTransition] = useTransition();

  const [tesoreria, setTesoreria] = useState<TesoreriaMPT>({
    efectivoBoveda: 0,
    digitales: 0,
    depositosDirectos: 0,
    total: 0,
  });
  const [dineroCajeros, setDineroCajeros] = useState<DineroCajeros>({
    efectivo: 0,
    yape: 0,
    total: 0,
  });
  const [depositos, setDepositos] = useState<DepositoDirecto[]>([]);
  const [cajerosList, setCajerosList] = useState<CajeroInfo[]>([]);

  // Modal de Depósito Directo MPT
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositMonto, setDepositMonto] = useState("");
  const [depositConcepto, setDepositConcepto] = useState("");
  const [depositReferencia, setDepositReferencia] = useState("");
  const [depositError, setDepositError] = useState("");

  // Modal de Abrir Caja para Cajero
  const [showOpenCajaModal, setShowOpenCajaModal] = useState(false);
  const [openCajaCajeroId, setOpenCajaCajeroId] = useState("");
  const [openCajaMontoApertura, setOpenCajaMontoApertura] = useState("100");
  const [openCajaError, setOpenCajaError] = useState("");

  // Tab del panel de historial
  const [activeHistTab, setActiveHistTab] = useState<"turnos" | "transacciones">("turnos");

  const handleDecimalInput = (val: string): string => {
    if (!val) return "";
    const sanitized = val.replace(",", ".");
    const parts = sanitized.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return sanitized;
  };

  const handleBlurFormat = (val: string, setter: (v: string) => void) => {
    if (!val || isNaN(parseFloat(val))) return;
    setter(parseFloat(val).toFixed(2));
  };

  const cargarCajas = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/cajas?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
      });
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body)) {
          setSessions(body);
        } else {
          const newSessions = body.sessions || [];
          setSessions(newSessions);
          if (body.tesoreriaMPT) setTesoreria(body.tesoreriaMPT);
          if (body.dineroCajerosActivos) setDineroCajeros(body.dineroCajerosActivos);
          if (body.depositos) setDepositos(body.depositos);
          if (body.cajerosList) setCajerosList(body.cajerosList);

          if (selectedSession) {
            const updated = newSessions.find((s: CajaSession) => s.id === selectedSession.id);
            if (updated) setSelectedSession(updated);
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar cajas:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Polling automático cada 2 segundos para sincronizar en tiempo real con las acciones del cajero
  useEffect(() => {
    void cargarCajas(true);
    const interval = setInterval(() => {
      void cargarCajas(false);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleAprobarCierre = (sessionId: string) => {
    setErrorMsg("");
    setSuccessMsg("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", sessionId }),
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo aprobar el cierre de caja.");
        } else {
          setSuccessMsg("Cierre de caja verificado y transferido con éxito a la Tesorería de la MPT.");
          setSelectedSession(null);
          void cargarCajas(false);
        }
      } catch (err) {
        setErrorMsg("Error de red al aprobar cierre de caja.");
      }
    });
  };

  const handleRegistrarDeposito = (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError("");
    setErrorMsg("");
    setSuccessMsg("");

    const val = parseFloat(depositMonto);
    if (isNaN(val) || val <= 0) {
      setDepositError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!depositConcepto.trim()) {
      setDepositError("El concepto del depósito es obligatorio.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DIRECT_DEPOSIT",
            monto: val,
            concepto: depositConcepto.trim(),
            referencia: depositReferencia.trim(),
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setDepositError(body.error ?? "No se pudo registrar el depósito.");
        } else {
          setSuccessMsg(`Depósito de S/ ${val.toFixed(2)} ingresado correctamente a la Tesorería MPT.`);
          setShowDepositModal(false);
          setDepositMonto("");
          setDepositConcepto("");
          setDepositReferencia("");
          void cargarCajas(false);
        }
      } catch (err) {
        setDepositError("Error de red al registrar el depósito.");
      }
    });
  };

  const handleOpenCaja = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenCajaError("");
    setErrorMsg("");
    setSuccessMsg("");

    const val = parseFloat(openCajaMontoApertura);
    if (isNaN(val) || val < 0) {
      setOpenCajaError("Ingresa un monto de apertura válido (puede ser 0).");
      return;
    }
    if (!openCajaCajeroId) {
      setOpenCajaError("Selecciona un cajero.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "OPEN_FOR_CAJERO",
            cajeroId: openCajaCajeroId,
            montoApertura: val,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setOpenCajaError(body.error ?? "No se pudo abrir la caja.");
        } else {
          const cajero = cajerosList.find(c => c.id === openCajaCajeroId);
          setSuccessMsg(`Caja abierta con fondo de S/ ${val.toFixed(2)} para ${cajero?.nombre ?? "el cajero"}.`);
          setShowOpenCajaModal(false);
          setOpenCajaCajeroId("");
          setOpenCajaMontoApertura("100");
          void cargarCajas(false);
        }
      } catch (err) {
        setOpenCajaError("Error de red al abrir la caja.");
      }
    });
  };

  const handleAprobarSencillo = (sessionId: string) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APROBAR_SENCILLO", sessionId }),
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo aprobar la solicitud de sencillo.");
        } else {
          setSuccessMsg(body.message ?? "Solicitud de sencillo aprobada con éxito.");
          void cargarCajas(false);
        }
      } catch (err) {
        setErrorMsg("Error de conexión al aprobar el sencillo.");
      }
    });
  };

  const handleRechazarSencillo = (sessionId: string) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "RECHAZAR_SENCILLO", sessionId }),
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo rechazar la solicitud.");
        } else {
          setSuccessMsg("Solicitud de sencillo rechazada.");
          void cargarCajas(false);
        }
      } catch (err) {
        setErrorMsg("Error de conexión al rechazar.");
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Supervisión y Arqueo de Cajas"
        description="Auditoría detallada de saldos, arqueos físicos, cuadres y aprobación de turnos de cajeros."
      />

      {/* TARJETAS DE FONDOS Y TESORERÃA MPT */}
      <div className="mb-7 grid gap-5 md:grid-cols-3">
        {/* Card 1: Dinero de la Municipalidad Provincial de Trujillo */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-900/40 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-200 flex items-center gap-1.5">
              <Landmark size={15} className="text-blue-400" />
              Municipalidad Provincial de Trujillo
            </span>
            <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-bold text-blue-200">
              Tesorería MPT
            </span>
          </div>

          <div className="mt-3">
            <p className="text-3xl font-black tracking-tight text-white">
              S/ {tesoreria.total.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-blue-200/80">
              Dinero total acumulado en la cuenta institucional MPT
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-blue-800/60 pt-3 text-xs">
            <div>
              <p className="text-[11px] text-blue-300">Bóveda Efectivo:</p>
              <p className="font-bold text-white">S/ {tesoreria.efectivoBoveda.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] text-blue-300">Digitales / Yape:</p>
              <p className="font-bold text-white">S/ {tesoreria.digitales.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-4 pt-1">
            <button
              onClick={() => {
                setDepositError("");
                setShowDepositModal(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
            >
              <Plus size={15} />
              Ingresar Efectivo a MPT
            </button>
          </div>
        </div>

        {/* Card 2: Dinero en Posesión de Cajeros (Turnos Activos) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Store size={15} className="text-blue-600" />
                Dinero en Cajeros (Turnos Activos)
              </span>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 animate-pulse">
                En Turno
              </span>
            </div>

            <div className="mt-3">
              <p className="text-3xl font-black tracking-tight text-slate-900">
                S/ {dineroCajeros.total.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Retenido por cajeros en turnos abiertos o pendientes
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Efectivo en Cajas:</p>
              <p className="font-bold text-amber-800">S/ {dineroCajeros.efectivo.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Yape en Cajas:</p>
              <p className="font-bold text-sky-800">S/ {dineroCajeros.yape.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Card 3: Balance Global Recaudado */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Coins size={15} className="text-emerald-600" />
                Recaudación Total Sincronizada
              </span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                ✓ Sincronizado
              </span>
            </div>

            <div className="mt-3">
              <p className="text-3xl font-black tracking-tight text-emerald-700">
                S/ {(tesoreria.total + dineroCajeros.total).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Suma total acumulada entre Tesorería MPT y Cajeros
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 text-xs flex items-center justify-between text-slate-500">
            <span>Transferencias por cierre:</span>
            <span className="font-bold text-slate-800">Automáticas</span>
          </div>
        </div>
      </div>

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

      {/* NOTIFICACIONES EN TIEMPO REAL DE SOLICITUDES DE SENCILLO / FONDO ADICIONAL */}
      {sessions.filter(s => (s as any).estadoSencillo === "PENDIENTE" || (s.estado as string) === "SOLICITADO_SENCILLO").map(req => (
        <div key={`sencillo-${req.id}`} className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-5 shadow-md animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-600 text-white shadow-md">
              <Coins size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800 animate-pulse">
                  🔔 Solicitud de Sencillo Pendiente
                </span>
              </div>
              <h4 className="mt-1 text-base font-bold text-slate-900">
                El cajero(a) <strong className="text-amber-900">{req.cajero.nombre}</strong> solicita <strong>S/ {Number((req as any).montoSolicitadoSencillo || 0).toFixed(2)}</strong> de sencillo de Tesorería MPT
              </h4>
              <p className="text-xs text-slate-600">
                {(req as any).motivoSencillo || "Solicitud de dinero adicional desde Bóveda MPT para entregar vuelto."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleAprobarSencillo(req.id)}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
            >
              <Check size={16} />
              Aprobar y Transferir Sencillo
            </button>
            <button
              onClick={() => handleRechazarSencillo(req.id)}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 transition disabled:opacity-50"
            >
              <X size={16} />
              Rechazar
            </button>
          </div>
        </div>
      ))}

      {/* NOTIFICACIONES EN TIEMPO REAL DE SOLICITUDES DE APERTURA DE CAJA */}
      {sessions.filter(s => (s.estado as string) === "SOLICITADO_APERTURA").map(req => (
        <div key={req.id} className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-sky-300 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 p-5 shadow-md animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-md">
              <Store size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-700 animate-pulse">
                  🔔 Solicitud de Apertura Pendiente
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {new Date(req.fechaApertura).toLocaleTimeString("es-PE")}
                </span>
              </div>
              <h4 className="mt-1 text-base font-bold text-slate-900">
                El cajero(a) <strong className="text-blue-900">{req.cajero.nombre}</strong> ({req.cajero.email}) solicita apertura de caja
              </h4>
              <p className="text-xs text-slate-600">
                Asigna el fondo de apertura inicial para activar su turno de cobro de inmediato.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setOpenCajaCajeroId(req.cajero.id);
              setOpenCajaMontoApertura("100");
              setOpenCajaError("");
              setShowOpenCajaModal(true);
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-xs font-bold text-white shadow-md transition active:scale-[0.98]"
          >
            <Plus size={16} />
            Asignar Fondo y Abrir Caja
          </button>
        </div>
      ))}

      {/* PANEL DE ESTADO EN TIEMPO REAL POR CAJERO */}
      {(() => {
        // Agrupar por cajero: mostrar la sesión más reciente de cada cajero que está ABIERTA, SOLICITADO_CIERRE o SOLICITADO_APERTURA
        const cajeroMap = new Map<string, typeof sessions[0]>();
        sessions.forEach(s => {
          const key = s.cajero.email;
          if (!cajeroMap.has(key)) {
            cajeroMap.set(key, s);
          } else {
            const prev = cajeroMap.get(key)!;
            if (s.estado === "ABIERTA" || s.estado === "SOLICITADO_APERTURA" || (s.estado === "SOLICITADO_CIERRE" && prev.estado === "CERRADA")) {
              cajeroMap.set(key, s);
            }
          }
        });

        const allCajeros = Array.from(cajeroMap.values());
        if (allCajeros.length === 0) return null;

        return (
          <div className="mb-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
              <Wallet size={18} className="text-[var(--blue)]" />
              Estado de Cajas por Cajero — Tiempo Real
              <span className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => {
                    setOpenCajaCajeroId("");
                    setOpenCajaMontoApertura("100");
                    setOpenCajaError("");
                    setShowOpenCajaModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition"
                >
                  <Plus size={13} />
                  Abrir Caja para Cajero
                </button>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                  En vivo
                </span>
              </span>
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allCajeros.map(s => {
                const isAbierta = s.estado === "ABIERTA";
                const isPendingCierre = s.estado === "SOLICITADO_CIERRE";
                const isPendingApertura = (s.estado as string) === "SOLICITADO_APERTURA";
                const isCerrada = s.estado === "CERRADA";

                // Calcular saldo actual en caja
                let cobrosEfectivo = 0;
                let cobrosYape = 0;
                let totalCobros = 0;
                (s.pagos || []).forEach(p => {
                  if (p.estado === "APPROVED") {
                    cobrosEfectivo += Number(p.montoEfectivo || 0);
                    cobrosYape += Number(p.montoYape || 0);
                    totalCobros += Number(p.monto || 0);
                  }
                });

                const efectivoActual = isAbierta
                  ? Number(s.montoApertura) + cobrosEfectivo
                  : Number(s.montoCierreEfectivo || 0);
                const yapeActual = isAbierta
                  ? cobrosYape
                  : Number(s.montoCierreYape || 0);
                const totalActual = efectivoActual + yapeActual;

                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border p-4 space-y-3 transition ${
                      isAbierta
                        ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm"
                        : isPendingCierre
                        ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-sm"
                        : isPendingApertura
                        ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white shadow-sm"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{s.cajero.nombre}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{s.cajero.email}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        isAbierta
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : isPendingCierre
                          ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                          : isPendingApertura
                          ? "bg-sky-100 text-sky-700 border border-sky-300 animate-pulse"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isAbierta ? "bg-emerald-500 animate-pulse" : isPendingCierre ? "bg-amber-500" : isPendingApertura ? "bg-sky-500 animate-ping" : "bg-slate-400"}`}></span>
                        {isAbierta ? "Caja Abierta" : isPendingCierre ? "Pend. Cierre" : isPendingApertura ? "Sol. Apertura" : "Cerrada"}
                      </span>
                    </div>

                    {/* Botón de acción rápido si hay solicitud de apertura */}
                    {isPendingApertura && (
                      <button
                        onClick={() => {
                          setOpenCajaCajeroId(s.cajero.id);
                          setOpenCajaMontoApertura("100");
                          setOpenCajaError("");
                          setShowOpenCajaModal(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
                      >
                        <Plus size={14} />
                        Asignar Fondo de Apertura
                      </button>
                    )}

                    {/* Saldo total en caja */}
                    <div className={`rounded-xl p-3 text-center ${isAbierta ? "bg-emerald-600" : isPendingCierre ? "bg-amber-500" : "bg-slate-400"}`}>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                        {isCerrada ? "Cierre Declarado" : "Saldo Actual en Caja"}
                      </p>
                      <p className="mt-0.5 text-2xl font-black text-white">
                        S/ {totalActual.toFixed(2)}
                      </p>
                    </div>

                    {/* Desglose */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white border border-slate-100 px-3 py-2">
                        <p className="text-slate-500 font-medium flex items-center gap-1"><Coins size={10} className="text-amber-500" /> Efectivo</p>
                        <p className="font-bold text-slate-900 mt-0.5">S/ {efectivoActual.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 px-3 py-2">
                        <p className="text-slate-500 font-medium flex items-center gap-1"><CreditCard size={10} className="text-sky-500" /> Yape</p>
                        <p className="font-bold text-slate-900 mt-0.5">S/ {yapeActual.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Info de apertura */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(s.fechaApertura).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>
                        Fondo inicial: <strong className="text-slate-700">S/ {Number(s.montoApertura).toFixed(2)}</strong>
                      </span>
                      {isAbierta && (
                        <span className="text-emerald-600 font-semibold">
                          {(s.pagos || []).filter((p: any) => p.estado === "APPROVED").length} cobro(s)
                        </span>
                      )}
                      {isPendingCierre && (
                        <button
                          onClick={() => handleAprobarCierre(s.id)}
                          disabled={pending}
                          className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 font-bold text-[10px] transition disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      )}
                    </div>

                    {/* Botón abrir caja (solo si está cerrada) */}
                    {isCerrada && (
                      <button
                        onClick={() => {
                          setOpenCajaCajeroId(s.cajero.id);
                          setOpenCajaMontoApertura("100");
                          setOpenCajaError("");
                          setShowOpenCajaModal(true);
                        }}
                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-2 text-xs font-bold text-blue-700 transition"
                      >
                        <Plus size={13} />
                        Establecer Fondo y Abrir Caja
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-[var(--border)] px-4 pt-3 pb-0">
          <button
            onClick={() => setActiveHistTab("turnos")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition ${
              activeHistTab === "turnos"
                ? "border-[var(--blue)] text-[var(--blue)] bg-blue-50/60"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Store size={14} />
            Historial de Turnos y Arqueos
          </button>
          <button
            onClick={() => setActiveHistTab("transacciones")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition ${
              activeHistTab === "transacciones"
                ? "border-blue-900 text-blue-900 bg-blue-950/5"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Landmark size={14} />
            Transacciones MPT
          </button>
        </div>

        {/* â”€â”€ TAB 1: Historial de Turnos y Arqueos â”€â”€ */}
        {activeHistTab === "turnos" && (
          <div className="p-5 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
                <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
                <p className="mt-3 text-sm font-medium">Cargando sesiones de caja...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--muted)]">
                <p className="text-sm">No se han registrado turnos de caja en el sistema.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[950px]">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3">Cajero</th>
                      <th className="px-4 py-3">Apertura</th>
                      <th className="px-4 py-3">Fondo Apertura</th>
                      <th className="px-4 py-3">Declarado Físico</th>
                      <th className="px-4 py-3">Descuadre</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map((s) => {
                      const difVal = Number(s.diferenciaArqueo || 0);
                      const isNeg = difVal < 0;
                      const isPos = difVal > 0;

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800">{s.cajero.nombre}</p>
                            <p className="text-xs text-slate-500">{s.cajero.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-700 flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              {new Date(s.fechaApertura).toLocaleString("es-PE")}
                            </p>
                            {s.fechaCierre && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Cierre: {new Date(s.fechaCierre).toLocaleString("es-PE")}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-850">
                            S/ {Number(s.montoApertura).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            {s.estado !== "ABIERTA" ? (
                              <div className="text-xs space-y-0.5 text-slate-700 font-medium">
                                <p className="flex items-center gap-1"><Coins size={11} className="text-amber-600" />Efectivo: S/ {Number(s.montoCierreEfectivo).toFixed(2)}</p>
                                <p className="flex items-center gap-1"><CreditCard size={11} className="text-sky-600" />Yape: S/ {Number(s.montoCierreYape).toFixed(2)}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Sin declarar</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {s.estado !== "ABIERTA" ? (
                              <span className={`text-xs font-bold ${isNeg ? "text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md" : isPos ? "text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md" : "text-slate-750"}`}>
                                S/ {difVal.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge>
                              {s.estado === "CERRADA" ? "Aprobado" : s.estado === "SOLICITADO_CIERRE" ? "Observado" : "Pendiente"}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedSession(s)}
                                className="inline-flex items-center gap-1 justify-center h-8 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                              >
                                <Eye size={13} />
                                Ver Arqueo
                              </button>
                              {s.estado === "SOLICITADO_CIERRE" && (
                                <button
                                  onClick={() => handleAprobarCierre(s.id)}
                                  disabled={pending}
                                  className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-55"
                                >
                                  Aprobar
                                </button>
                              )}
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

        {/* â”€â”€ TAB 2: Transacciones MPT â”€â”€ */}
        {activeHistTab === "transacciones" && (() => {
          type TxRow = {
            id: string;
            fecha: Date;
            tipo: "DEPOSITO_DIRECTO" | "ASIGNACION_CAJERO" | "TRANSFERENCIA_CIERRE" | "DIGITAL_YAPE";
            concepto: string;
            referencia?: string;
            actor: string;
            monto: number;
            signo: "+" | "-";
          };
          const txRows: TxRow[] = [];
          depositos.forEach(d => {
            txRows.push({ id: `dep-${d.id}`, fecha: new Date(d.creadoEn), tipo: "DEPOSITO_DIRECTO", concepto: d.concepto, referencia: d.referencia ?? undefined, actor: d.registradoPor, monto: Number(d.monto), signo: "+" });
          });
          sessions.forEach(s => {
            if (Number(s.montoApertura) > 0) {
              txRows.push({ id: `asig-${s.id}`, fecha: new Date(s.fechaApertura), tipo: "ASIGNACION_CAJERO", concepto: `Asignación de fondo a ${s.cajero.nombre}`, actor: s.cajero.nombre, monto: Number(s.montoApertura), signo: "-" });
            }
          });
          sessions.filter(s => s.estado === "CERRADA").forEach(s => {
            const mEff = Number(s.montoCierreEfectivo || 0);
            if (mEff > 0) {
              txRows.push({ id: `cierre-eff-${s.id}`, fecha: s.fechaCierre ? new Date(s.fechaCierre) : new Date(s.fechaApertura), tipo: "TRANSFERENCIA_CIERRE", concepto: `Cierre aprobado — ${s.cajero.nombre}`, actor: s.cajero.nombre, monto: mEff, signo: "+" });
            }
          });
          txRows.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
          const totalEntradas = txRows.filter(t => t.signo === "+").reduce((s, t) => s + t.monto, 0);
          const totalSalidas  = txRows.filter(t => t.signo === "-").reduce((s, t) => s + t.monto, 0);
          const saldoActual = totalEntradas - totalSalidas;
          const tipoConfig = {
            DEPOSITO_DIRECTO:     { label: "Depósito Directo",       bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
            ASIGNACION_CAJERO:    { label: "Asignación a Cajero",     bg: "bg-red-50 border-red-200",         text: "text-red-600",     dot: "bg-red-500" },
            TRANSFERENCIA_CIERRE: { label: "Transferencia por Cierre", bg: "bg-blue-50 border-blue-200",       text: "text-blue-700",   dot: "bg-blue-500" },
            DIGITAL_YAPE:         { label: "Cobro Digital/Yape",       bg: "bg-sky-50 border-sky-200",         text: "text-sky-700",    dot: "bg-sky-500" },
          };
          return (
            <div>
              {/* KPIs */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                <div className="px-5 py-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Entradas</p>
                  <p className="mt-0.5 text-lg font-black text-emerald-700">+ S/ {totalEntradas.toFixed(2)}</p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Salidas</p>
                  <p className="mt-0.5 text-lg font-black text-red-600">- S/ {totalSalidas.toFixed(2)}</p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Saldo Neto MPT</p>
                  <p className={`mt-0.5 text-lg font-black ${saldoActual >= 0 ? "text-blue-800" : "text-red-700"}`}>S/ {saldoActual.toFixed(2)}</p>
                </div>
              </div>
              {/* Tabla */}
              {txRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400">
                  <Landmark size={32} className="mb-3 text-slate-200" />
                  <p className="text-sm font-medium">No hay transacciones registradas aún.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 w-[170px]">Fecha</th>
                        <th className="px-5 py-3">Tipo</th>
                        <th className="px-5 py-3">Concepto / Referencia</th>
                        <th className="px-5 py-3">Actor</th>
                        <th className="px-5 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {txRows.map(tx => {
                        const cfg = tipoConfig[tx.tipo];
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                              <span className="flex items-center gap-1.5"><Clock size={11} className="text-slate-300" />{tx.fecha.toLocaleString("es-PE")}</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}></span>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-xs font-semibold text-slate-800 leading-tight">{tx.concepto}</p>
                              {tx.referencia && <p className="text-[11px] text-slate-400 font-mono mt-0.5">Ref: {tx.referencia}</p>}
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-600 font-medium">{tx.actor}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`text-sm font-black ${tx.signo === "+" ? "text-emerald-700" : "text-red-600"}`}>
                                {tx.signo} S/ {tx.monto.toFixed(2)}
                              </span>
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
        })()}
      </div>



      {/* Modal Visor de Arqueo Completo */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign size={20} className="text-[var(--blue)]" />
                  Arqueo de Caja — {selectedSession.cajero.nombre}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  ID: <span className="font-semibold text-slate-700">{selectedSession.id}</span> | Apertura: {new Date(selectedSession.fechaApertura).toLocaleString("es-PE")}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Tarjetas de Arqueo y Saldos */}
              {(() => {
                let cobradoEfectivo = 0;
                let cobradoYape = 0;
                let totalCobros = 0;

                (selectedSession.pagos || []).forEach(p => {
                  if (p.estado === "APPROVED") {
                    cobradoEfectivo += Number(p.montoEfectivo);
                    cobradoYape += Number(p.montoYape);
                    totalCobros += Number(p.monto);
                  }
                });

                const esperadoEfectivo = Number(selectedSession.montoApertura) + cobradoEfectivo;
                const esperadoYape = cobradoYape;
                const esperadoTotal = esperadoEfectivo + esperadoYape;

                const declaradoEfectivo = Number(selectedSession.montoCierreEfectivo || 0);
                const declaradoYape = Number(selectedSession.montoCierreYape || 0);
                const declaradoTotal = declaradoEfectivo + declaradoYape;

                const descuadre = Number(selectedSession.diferenciaArqueo || 0);

                return (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-500">Fondo Inicial Apertura</p>
                        <p className="mt-1.5 text-lg font-bold text-slate-800">
                          S/ {Number(selectedSession.montoApertura).toFixed(2)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-500">Total Cobrado en Turno</p>
                        <p className="mt-1.5 text-lg font-bold text-slate-800">
                          S/ {totalCobros.toFixed(2)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Eff: S/ {cobradoEfectivo.toFixed(2)} | Yape: S/ {cobradoYape.toFixed(2)}
                        </p>
                      </div>

                      <div className={`rounded-xl border p-4 ${descuadre < 0 ? "border-red-300 bg-red-50 text-red-900" : descuadre > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-blue-300 bg-blue-50 text-blue-900"}`}>
                        <p className="text-xs font-bold uppercase tracking-wider">Descuadre / Arqueo</p>
                        <p className="mt-1.5 text-xl font-black">
                          S/ {descuadre.toFixed(2)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold">
                          {descuadre < 0 ? "âš ï¸ Descuadre Negativo (Faltante)" : descuadre > 0 ? "Sobrante de Caja" : "✓ Cuadre Físico Exacto"}
                        </p>
                      </div>
                    </div>

                    {/* Comparativa Declarado vs Esperado */}
                    <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-xs space-y-2.5">
                      <p className="font-bold text-slate-800 border-b border-slate-200 pb-2">
                        Resumen Comparativo de Auditoría
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-500 font-semibold mb-1">Monto Esperado en Sistema:</p>
                          <p className="text-slate-700">Efectivo (Fondo + Cobros): <strong>S/ {esperadoEfectivo.toFixed(2)}</strong></p>
                          <p className="text-slate-700">Yape Registrado: <strong>S/ {esperadoYape.toFixed(2)}</strong></p>
                          <p className="text-slate-900 font-bold mt-1">Total Esperado: S/ {esperadoTotal.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold mb-1">Monto Declarado por Cajero:</p>
                          <p className="text-slate-700">Efectivo Físico: <strong>S/ {declaradoEfectivo.toFixed(2)}</strong></p>
                          <p className="text-slate-700">Yape Físico: <strong>S/ {declaradoYape.toFixed(2)}</strong></p>
                          <p className="text-slate-900 font-bold mt-1">Total Declarado: S/ {declaradoTotal.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Justificación del Descuadre si existe */}
                    {selectedSession.justificacionArqueo && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs space-y-1 text-amber-900">
                        <p className="font-bold flex items-center gap-1.5 text-amber-950">
                          <AlertCircle size={15} className="text-amber-600" />
                          Justificación del Descuadre presentada por el cajero:
                        </p>
                        <p className="italic font-medium leading-relaxed bg-white/80 p-2.5 rounded-lg border border-amber-200 mt-1.5 text-amber-950">
                          "{selectedSession.justificacionArqueo}"
                        </p>
                      </div>
                    )}

                    {/* Lista de Comprobantes del Turno */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Comprobantes Cobrados en el Turno ({selectedSession.pagos?.length || 0})
                      </h4>
                      {!selectedSession.pagos || selectedSession.pagos.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                          No se registraron cobros durante este turno de caja.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2.5">Factura / Boleta</th>
                                <th className="px-3 py-2.5">Trámite</th>
                                <th className="px-3 py-2.5">Contribuyente</th>
                                <th className="px-3 py-2.5">Método</th>
                                <th className="px-3 py-2.5 text-right">Monto</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedSession.pagos.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                    {p.numeroFactura || "—"}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-slate-600">
                                    {p.tramite.codigo}
                                  </td>
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-slate-800">{p.tramite.negocio.razonSocial}</p>
                                    <p className="text-[10px] text-slate-400">RUC: {p.tramite.negocio.ruc}</p>
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-slate-700">
                                    <p>{p.metodo}</p>
                                    {Number((p as any).vueltoTotal || 0) > 0 && (
                                      <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                        💡 Vuelto: S/ {Number((p as any).vueltoTotal).toFixed(2)} (Efectivo: S/ {Number((p as any).vueltoEfectivo || 0).toFixed(2)} | Yape: S/ {Number((p as any).vueltoYape || 0).toFixed(2)})
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-900">
                                    S/ {Number(p.monto).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 flex items-center justify-between">
              <button
                onClick={() => setSelectedSession(null)}
                className="h-10 px-5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cerrar Detalle
              </button>

              {selectedSession.estado === "SOLICITADO_CIERRE" && (
                <button
                  onClick={() => handleAprobarCierre(selectedSession.id)}
                  disabled={pending}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 text-xs font-bold text-white shadow-sm transition disabled:opacity-55"
                >
                  {pending && <LoaderCircle className="animate-spin" size={14} />}
                  Aprobar Cierre de Turno
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial de Ingresos Directos a Tesorería MPT */}
      {depositos.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <Landmark size={18} className="text-[var(--blue)]" />
            Ingresos Directos de Efectivo a Tesorería MPT
            <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-0.5">
              Últimos {depositos.length}
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Registrado por</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {depositos.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(d.creadoEn).toLocaleString("es-PE")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{d.concepto}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{d.referencia || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{d.registradoPor}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-emerald-700 text-sm">+ S/ {Number(d.monto).toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Ingreso Directo de Efectivo a MPT */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Landmark size={18} className="text-blue-600" />
                  Ingresar Efectivo a Tesorería MPT
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Registra un ingreso directo de efectivo a la cuenta de la Municipalidad Provincial de Trujillo.
                </p>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ml-3"
              >
                <X size={18} />
              </button>
            </div>

            {depositError && (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="shrink-0 text-red-500" size={16} />
                <p className="font-medium">{depositError}</p>
              </div>
            )}

            <form onSubmit={handleRegistrarDeposito} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Monto en Efectivo (S/) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={depositMonto}
                  onChange={(e) => setDepositMonto(handleDecimalInput(e.target.value))}
                  onBlur={() => handleBlurFormat(depositMonto, setDepositMonto)}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-base font-semibold text-slate-900 outline-none focus:border-blue-600"
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Concepto del Depósito *</label>
                <input
                  type="text"
                  value={depositConcepto}
                  onChange={(e) => setDepositConcepto(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600"
                  placeholder="Ej: Recaudación turno mañana, ingreso fondo bóveda..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">N° Documento / Referencia (Opcional)</label>
                <input
                  type="text"
                  value={depositReferencia}
                  onChange={(e) => setDepositReferencia(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600"
                  placeholder="Ej: REC-2026-0001, Voucher #..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={pending}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 text-xs font-bold text-white shadow-sm transition disabled:opacity-55"
                >
                  {pending && <LoaderCircle className="animate-spin" size={14} />}
                  Confirmar Ingreso MPT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Abrir Caja para Cajero con Fondo de Apertura */}
      {showOpenCajaModal && (() => {
        const montoIngresado = parseFloat(openCajaMontoApertura) || 0;
        const excedeSaldo = montoIngresado > tesoreria.efectivoBoveda;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Wallet size={18} className="text-blue-600" />
                    Abrir Caja con Fondo de Apertura
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    El cajero seleccionado podrá empezar a cobrar inmediatamente con el fondo que establezcas.
                  </p>
                </div>
                <button
                  onClick={() => setShowOpenCajaModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ml-3"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Balance disponible MPT */}
              <div className={`rounded-xl border p-3 flex items-center justify-between text-xs ${excedeSaldo ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                <span className={`font-semibold flex items-center gap-1.5 ${excedeSaldo ? "text-red-700" : "text-emerald-700"}`}>
                  <Landmark size={13} />
                  Bóveda Efectivo MPT disponible:
                </span>
                <span className={`font-black text-sm ${excedeSaldo ? "text-red-700" : "text-emerald-800"}`}>
                  S/ {tesoreria.efectivoBoveda.toFixed(2)}
                </span>
              </div>

              {openCajaError && (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="shrink-0 text-red-500" size={16} />
                  <p className="font-medium">{openCajaError}</p>
                </div>
              )}

              <form onSubmit={handleOpenCaja} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Cajero *</label>
                  <select
                    value={openCajaCajeroId}
                    onChange={(e) => setOpenCajaCajeroId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-900 bg-white outline-none focus:border-blue-600 cursor-pointer"
                    required
                  >
                    <option value="">— Selecciona un cajero —</option>
                    {cajerosList.map(c => {
                      const tieneSessionActiva = sessions.some(
                        s => s.cajero.email === c.email && (s.estado === "ABIERTA" || s.estado === "SOLICITADO_CIERRE")
                      );
                      return (
                        <option key={c.id} value={c.id} disabled={tieneSessionActiva}>
                          {c.nombre} ({c.email}){tieneSessionActiva ? " — Ya tiene caja activa" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Fondo de Apertura (S/) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={Math.round(tesoreria.efectivoBoveda * 100) / 100}
                      value={openCajaMontoApertura}
                      onChange={(e) => setOpenCajaMontoApertura(handleDecimalInput(e.target.value))}
                      onBlur={() => handleBlurFormat(openCajaMontoApertura, setOpenCajaMontoApertura)}
                      className={`h-12 w-full rounded-xl border pl-9 pr-3 text-xl font-black text-slate-900 outline-none transition ${
                        excedeSaldo
                          ? "border-red-400 bg-red-50 focus:border-red-500"
                          : "border-slate-300 focus:border-blue-600"
                      }`}
                      placeholder="100.00"
                      required
                      autoFocus
                    />
                  </div>
                  {excedeSaldo ? (
                    <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle size={11} />
                      Excede el saldo disponible en la Bóveda MPT (S/ {tesoreria.efectivoBoveda.toFixed(2)})
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Máximo disponible: <strong className="text-slate-700">S/ {tesoreria.efectivoBoveda.toFixed(2)}</strong>. Puede ser S/ 0.00.
                    </p>
                  )}
                </div>

                {/* Presets rápidos de monto */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-2">Montos frecuentes:</p>
                  <div className="flex flex-wrap gap-2">
                    {["50", "100", "200", "500"].map((m) => {
                      const mv = parseFloat(m);
                      const disabled = mv > tesoreria.efectivoBoveda;
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={disabled}
                          onClick={() => setOpenCajaMontoApertura(m)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                            openCajaMontoApertura === m
                              ? "border-blue-600 bg-blue-600 text-white"
                              : disabled
                              ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          S/ {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowOpenCajaModal(false)}
                    className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={pending || excedeSaldo}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 px-6 text-xs font-bold text-white shadow-sm transition disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {pending && <LoaderCircle className="animate-spin" size={14} />}
                    Abrir Caja
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
