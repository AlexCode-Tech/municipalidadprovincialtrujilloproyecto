"use client";

import { useEffect, useState, useTransition } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, ArrowRightLeft, Banknote, Calendar, CheckCircle2, Clock, Coins, CreditCard, DollarSign, History, LoaderCircle, Store } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

type CajaSession = {
  id: string;
  montoApertura: number;
  montoCierreEfectivo?: number | null;
  montoCierreYape?: number | null;
  diferenciaArqueo?: number | null;
  justificacionArqueo?: string | null;
  estado: "ABIERTA" | "SOLICITADO_CIERRE" | "CERRADA";
  fechaApertura: string;
  fechaCierre?: string | null;
};

type SessionResponse = {
  session: CajaSession | null;
  expected?: {
    efectivo: number;
    yape: number;
    total: number;
    totalCobros: number;
  };
};

export default function CajeroCajaPage() {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [montoCierreEfectivo, setMontoCierreEfectivo] = useState("");
  const [montoCierreYape, setMontoCierreYape] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const handleDecimalInput = (val: string): string => {
    if (!val) return "";
    const parts = val.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return val;
  };

  const handleBlurFormat = (val: string, setter: (v: string) => void) => {
    if (!val || isNaN(parseFloat(val))) return;
    setter(parseFloat(val).toFixed(2));
  };

  const cargarCaja = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/cajas?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
      });
      if (res.ok) {
        const body = await res.json();
        setData(body);
      }
    } catch (err) {
      console.error("Error al cargar la caja:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void cargarCaja(true);
    const interval = setInterval(() => {
      void cargarCaja(false);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Cálculo en tiempo real del descuadre
  const efDeclarado = parseFloat(montoCierreEfectivo || "0");
  const ypDeclarado = parseFloat(montoCierreYape || "0");
  const totalDeclarado = efDeclarado + ypDeclarado;
  const totalEsperado = data?.expected?.total ?? Number(data?.session?.montoApertura ?? 0);
  const tieneIngresos = montoCierreEfectivo !== "" || montoCierreYape !== "";
  const descuadre = tieneIngresos ? totalDeclarado - totalEsperado : 0;

  const handleSolicitarCierre = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!data?.session) return;

    if (montoCierreEfectivo === "" || montoCierreYape === "") {
      setErrorMsg("Debes ingresar el monto físico en efectivo y YAPE.");
      return;
    }

    const ef = parseFloat(montoCierreEfectivo);
    const yp = parseFloat(montoCierreYape);

    if (isNaN(ef) || ef < 0 || isNaN(yp) || yp < 0) {
      setErrorMsg("Ingresa montos físicos válidos.");
      return;
    }

    // Exigir justificación obligatoria si hay descuadre
    if (descuadre !== 0 && !justificacion.trim()) {
      setErrorMsg("Se ha detectado un descuadre en caja. Debes ingresar una justificación obligatoria antes de solicitar el cierre.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CLOSE",
            sessionId: data.session?.id,
            montoCierreEfectivo: ef,
            montoCierreYape: yp,
            justificacionArqueo: justificacion.trim() || undefined,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo solicitar el cierre de caja.");
        } else {
          setSuccessMsg("Cierre solicitado con éxito. En espera de aprobación del Administrador.");
          void cargarCaja(true);
        }
      } catch (err) {
        setErrorMsg("Error de red al solicitar el cierre.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <LoaderCircle className="animate-spin text-[var(--blue)]" size={36} />
        <p className="text-sm font-semibold text-slate-500">Cargando estado de la caja...</p>
      </div>
    );
  }

  const session = data?.session;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeading
        title="Gestión de Caja"
        description="Manejo de turnos, arqueos físicos y solicitudes de cierre de caja presencial."
      />

      {errorMsg && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in" role="alert">
          <AlertCircle className="shrink-0 text-red-500" size={20} />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 animate-in fade-in" role="status">
          <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {/* CASO A: Sin caja abierta o cerrada — esperando al administrador */}
      {(!session || session.estado === "CERRADA") && (
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <Store size={28} className="text-[var(--blue)]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Caja Inactiva</span>
          <h2 className="mt-1 text-xl font-black text-[var(--navy)]">Turno no iniciado</h2>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 text-left space-y-2">
            <p className="font-bold flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500 shrink-0" />
              Fondo de apertura asignado por el Administrador
            </p>
            <p className="text-xs text-amber-700 leading-relaxed">
              El monto con el que iniciará tu caja es establecido exclusivamente por el <strong>Administrador MPT</strong>.
              Una vez que el administrador te asigne tu fondo, tu caja aparecerá como activa automáticamente.
            </p>
          </div>

          <p className="mt-5 text-xs text-slate-400">
            La página se actualizará automáticamente cuando tu caja sea asignada.
          </p>
        </div>
      )}

      {/* CASO B: Caja Abierta */}
      {session && session.estado === "ABIERTA" && (
        <div className="grid gap-7 lg:grid-cols-3">
          {/* Columna Izquierda: Tarjetas de Estado y Totales */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Sesión de Caja</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--navy)]">ID: {session.id}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Abierta
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#f8fafc] p-4">
                  <p className="text-xs font-medium text-slate-500">Fecha Apertura</p>
                  <p className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar size={15} className="text-[var(--blue)]" />
                    {new Date(session.fechaApertura).toLocaleString("es-PE")}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f8fafc] p-4">
                  <p className="text-xs font-medium text-slate-500">Monto Apertura</p>
                  <p className="mt-1 text-lg font-black text-slate-800">
                    S/ {Number(session.montoApertura).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Totales Esperados en Caja */}
            <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-[var(--navy)] flex items-center gap-2">
                <DollarSign size={18} className="text-[var(--blue)]" />
                Arqueo y Saldos Esperados
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">Calculados en tiempo real según cobros aprobados en el turno.</p>
              
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                    <Coins size={14} className="text-amber-600" />
                    Efectivo Esperado
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    S/ {data?.expected?.efectivo.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Incluye fondo inicial</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                    <CreditCard size={14} className="text-sky-600" />
                    Yape Esperado
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    S/ {data?.expected?.yape.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Total digital cobrado</p>
                </div>

                <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
                  <p className="text-xs text-blue-700 flex items-center gap-1 font-bold">
                    <ArrowRightLeft size={14} className="text-blue-700" />
                    Total en Turno
                  </p>
                  <p className="mt-2 text-2xl font-black text-blue-900">
                    S/ {data?.expected?.total.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] text-blue-600">S/ {data?.expected?.totalCobros.toFixed(2)} en cobros</p>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Formulario de Solicitud de Cierre */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-[var(--navy)]">Solicitar cierre de caja</h3>
            <p className="text-xs text-[var(--muted)] leading-5">
              Ingresa el arqueo físico y digital exacto que posees físicamente en caja. El Administrador verificará los descuadres.
            </p>

            <form onSubmit={handleSolicitarCierre} className="space-y-4">
              <label className="block text-sm font-semibold">
                Efectivo Físico en Caja (S/)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoCierreEfectivo}
                  onChange={(e) => setMontoCierreEfectivo(handleDecimalInput(e.target.value))}
                  onBlur={() => handleBlurFormat(montoCierreEfectivo, setMontoCierreEfectivo)}
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none placeholder:text-slate-300 focus:border-[var(--blue)] font-semibold"
                  placeholder="S/ 0.00"
                  required
                />
              </label>

              <label className="block text-sm font-semibold">
                Yape Físico Validado (S/)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoCierreYape}
                  onChange={(e) => setMontoCierreYape(handleDecimalInput(e.target.value))}
                  onBlur={() => handleBlurFormat(montoCierreYape, setMontoCierreYape)}
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none placeholder:text-slate-300 focus:border-[var(--blue)] font-semibold"
                  placeholder="S/ 0.00"
                  required
                />
              </label>

              {/* Alerta y Campo de Justificación Obligatoria por Descuadre */}
              {tieneIngresos && descuadre !== 0 && (
                <div className={`p-4 rounded-xl border text-xs space-y-2.5 animate-in fade-in ${descuadre < 0 ? "bg-red-50 border-red-200 text-red-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertCircle size={17} className={descuadre < 0 ? "text-red-600" : "text-amber-600"} />
                    <span>{descuadre < 0 ? `Descuadre Faltante: S/ ${Math.abs(descuadre).toFixed(2)}` : `Descuadre Sobrante: S/ ${descuadre.toFixed(2)}`}</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    Existe una diferencia con el saldo esperado de caja. Es obligatorio registrar una justificación para la revisión del administrador.
                  </p>
                  <label className="block font-bold text-slate-800">
                    Justificación del Descuadre *
                    <textarea
                      rows={3}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-blue-500 font-normal bg-white text-slate-800"
                      placeholder="Escribe el motivo del descuadre (ej: vuelto mal entregado, billete roto rechazado, etc.)..."
                      value={justificacion}
                      onChange={(e) => setJustificacion(e.target.value)}
                      required
                    />
                  </label>
                </div>
              )}

              <button
                disabled={pending}
                className="focus-ring mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-sm font-bold text-white shadow-sm transition disabled:opacity-55"
              >
                {pending && <LoaderCircle className="animate-spin" size={16} />}
                Solicitar Cierre de Turno
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CASO C: Turno con Cierre Solicitado (Pendiente Aprobación) */}
      {session && session.estado === "SOLICITADO_CIERRE" && (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 shadow-md">
            <Clock size={30} />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-[var(--navy)]">
            Cierre de Caja Solicitado
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
            Tu solicitud de cierre de caja ha sido registrada y está en espera de aprobación por el Administrador municipal.
          </p>

          <div className="mx-auto mt-8 max-w-lg rounded-xl border border-slate-100 bg-[#f8fafc] p-5 text-left text-sm space-y-3">
            <p className="font-bold text-slate-800 border-b border-slate-200 pb-2 flex justify-between items-center">
              <span>Detalles del arqueo enviado</span>
              <StatusBadge>Observado</StatusBadge>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">Sesión ID:</span>
              <span className="font-semibold">{session.id}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">Efectivo Físico Declarado:</span>
              <span className="font-semibold text-slate-800">S/ {Number(session.montoCierreEfectivo).toFixed(2)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">Yape Declarado:</span>
              <span className="font-semibold text-slate-800">S/ {Number(session.montoCierreYape).toFixed(2)}</span>
            </p>
            <p className="flex justify-between font-bold border-t border-slate-200 pt-2">
              <span className="text-slate-600">Diferencia Arqueo (Descuadre):</span>
              <span className={Number(session.diferenciaArqueo || 0) !== 0 ? "text-red-600" : "text-slate-800"}>
                S/ {Number(session.diferenciaArqueo).toFixed(2)}
              </span>
            </p>
            {session.justificacionArqueo && (
              <div className="border-t border-slate-200 pt-2.5">
                <span className="text-xs font-semibold text-slate-500 block mb-1">Justificación enviada:</span>
                <p className="italic bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-xs font-medium">
                  "{session.justificacionArqueo}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
