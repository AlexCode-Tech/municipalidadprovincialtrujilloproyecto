"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck, ArrowRight, ExternalLink, HelpCircle, AlertCircle, Play, CreditCard, QrCode, Split, X, Check, Coins } from "lucide-react";

function PagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tramiteId = searchParams.get("tramiteId") ?? "";
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para el modal de simulación de pago
  const [showModalSimular, setShowModalSimular] = useState(false);
  const [metodoSimulacion, setMetodoSimulacion] = useState<"TARJETA" | "YAPE" | "MIXTO">("TARJETA");
  const [montoTarjetaInput, setMontoTarjetaInput] = useState("100.00");
  const [montoYapeInput, setMontoYapeInput] = useState("80.00");

  // Estado para gestión de vuelto en Pago Mixto
  const [vueltoModo, setVueltoModo] = useState<"EFECTIVO" | "YAPE" | "MIXTO">("EFECTIVO");
  const [vueltoEfectivoCustom, setVueltoEfectivoCustom] = useState("0.00");
  const [vueltoYapeCustom, setVueltoYapeCustom] = useState("0.00");

  // Estado de caja y solicitud de sencillo
  const [saldoDisponibleEnCaja, setSaldoDisponibleEnCaja] = useState<number>(100.00);
  const [solicitandoSencillo, setSolicitandoSencillo] = useState(false);
  const [sencilloEnviado, setSencilloEnviado] = useState(false);
  const [estadoSencilloStatus, setEstadoSencilloStatus] = useState<string | null>(null);

  const handleDecimalInput = (val: string): string => {
    if (!val) return "";
    const sanitized = val.replace(",", ".");
    const parts = sanitized.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return sanitized;
  };

  // Cálculos de vuelto en tiempo real
  const montoTarjetaVal = parseFloat(montoTarjetaInput) || 0;
  const montoYapeVal = parseFloat(montoYapeInput) || 0;
  const totalEntregado = montoTarjetaVal + montoYapeVal;
  const vueltoCalculadoTotal = Math.max(0, Math.round((totalEntregado - 180.00) * 100) / 100);

  let vueltoEfectivoCalculado = 0;
  if (vueltoCalculadoTotal > 0) {
    if (vueltoModo === "EFECTIVO") vueltoEfectivoCalculado = vueltoCalculadoTotal;
    else if (vueltoModo === "YAPE") vueltoEfectivoCalculado = 0;
    else vueltoEfectivoCalculado = parseFloat(vueltoEfectivoCustom) || 0;
  }

  // Cargar saldo de caja y verificar estado en tiempo real
  useEffect(() => {
    if (!tramiteId) return;

    async function verificarYObtenerPreferencia() {
      try {
        // 1. Verificar si el trámite ya fue pagado
        const checkRes = await fetch(`/api/tramites/${tramiteId}?t=${Date.now()}`, { cache: "no-store" });
        if (checkRes.ok) {
          const tData = await checkRes.json();
          const tienePago = (tData.pagos || []).some((p: any) => p.estado === "APPROVED");
          if (tienePago || (tData.estado && tData.estado !== "PAGO_PENDIENTE" && tData.estado !== "BORRADOR" && tData.estado !== "PENDIENTE_PAGO")) {
            router.replace(`/negocio/pago/resultado?tramiteId=${tramiteId}&estado=aprobado`);
            return;
          }
        }

        // 2. Cargar dinero disponible en caja activa o Tesorería MPT
        const cajaRes = await fetch(`/api/cajas?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
        if (cajaRes && cajaRes.ok) {
          const cData = await cajaRes.json();
          if (cData.session) {
            const expEff = cData.expected?.efectivo || Number(cData.session.montoApertura || 100);
            setSaldoDisponibleEnCaja(Math.max(100, expEff));
            if (cData.session.estadoSencillo) {
              setEstadoSencilloStatus(cData.session.estadoSencillo);
            }
          }
        }

        // 3. Obtener preferencia de Mercado Pago
        const res = await fetch("/api/pagos/preferencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tramiteId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "No se pudo generar la orden de pago");
        }

        const data = (await res.json()) as { checkoutUrl: string };
        setCheckoutUrl(data.checkoutUrl);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de conexión");
        setLoading(false);
      }
    }

    void verificarYObtenerPreferencia();
  }, [tramiteId, router]);

  // Polling para verificar si el Administrador aprobó o rechazó la solicitud de sencillo
  useEffect(() => {
    if (!sencilloEnviado) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/cajas?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            const status = data.session.estadoSencillo;
            if (status === "APROBADO") {
              setEstadoSencilloStatus("APROBADO");
              setSaldoDisponibleEnCaja(prev => prev + 500); // Incrementar saldo de caja disponible
              setSencilloEnviado(false);
              clearInterval(interval);
            } else if (status === "RECHAZADO") {
              setEstadoSencilloStatus("RECHAZADO");
              setSencilloEnviado(false);
              clearInterval(interval);
            }
          }
        }
      } catch (e) {
        console.error("Error polling sencillo status:", e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sencilloEnviado]);

  const handlePedirSencillo = async () => {
    setSolicitandoSencillo(true);
    setError(null);
    const montoSencillo = Math.max(50, vueltoEfectivoCalculado - saldoDisponibleEnCaja + 50);

    try {
      const res = await fetch("/api/cajas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SOLICITAR_SENCILLO",
          montoSencillo,
          motivo: `Solicitud de sencillo para entregar vuelto de S/ ${vueltoCalculadoTotal.toFixed(2)}`
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo solicitar sencillo a la administración.");
      }

      setSencilloEnviado(true);
      setEstadoSencilloStatus("PENDIENTE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al solicitar sencillo.");
    } finally {
      setSolicitandoSencillo(false);
    }
  };

  const handleEjecutarSimulacion = async () => {
    setSimulando(true);
    setError(null);

    let montoTarjeta = 180;
    let montoYape = 0;
    let vueltoTotal = 0;
    let vueltoEfectivo = 0;
    let vueltoYape = 0;

    if (metodoSimulacion === "YAPE") {
      montoTarjeta = 0;
      montoYape = 180;
    } else if (metodoSimulacion === "MIXTO") {
      montoTarjeta = montoTarjetaVal;
      montoYape = montoYapeVal;

      if (totalEntregado < 179.99) {
        setError(`El monto total ingresado (S/ ${totalEntregado.toFixed(2)}) es menor a la tasa oficial de S/ 180.00.`);
        setSimulando(false);
        return;
      }

      vueltoTotal = vueltoCalculadoTotal;
      if (vueltoTotal > 0) {
        if (vueltoModo === "EFECTIVO") {
          vueltoEfectivo = vueltoTotal;
          vueltoYape = 0;
        } else if (vueltoModo === "YAPE") {
          vueltoYape = vueltoTotal;
          vueltoEfectivo = 0;
        } else {
          vueltoEfectivo = parseFloat(vueltoEfectivoCustom) || 0;
          vueltoYape = parseFloat(vueltoYapeCustom) || 0;
          if (Math.abs((vueltoEfectivo + vueltoYape) - vueltoTotal) > 0.01) {
            setError(`En vuelto mixto, la suma de Efectivo y Yape debe ser exactamente igual al vuelto total de S/ ${vueltoTotal.toFixed(2)}.`);
            setSimulando(false);
            return;
          }
        }
      }
    }

    try {
      const res = await fetch("/api/pagos/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tramiteId,
          metodo: metodoSimulacion,
          montoTarjeta,
          montoYape,
          vueltoTotal,
          vueltoEfectivo,
          vueltoYape
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No se pudo procesar la simulación de pago.");
      }

      setShowModalSimular(false);
      // Redirigir reemplazando la historia del navegador para no permitir presionar 'Atrás'
      router.replace(`/negocio/pago/resultado?tramiteId=${tramiteId}&estado=aprobado`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la simulación de pago.");
      setSimulando(false);
    }
  };

  if (!tramiteId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold text-amber-800">Trámite no especificado</p>
        <p className="mt-1">Accede a esta página desde el formulario de registro de trámite.</p>
      </div>
    );
  }

  if (error && !showModalSimular) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900 shadow-sm">
        <p className="font-semibold text-red-800">Error en el proceso de pago</p>
        <p className="mt-1">{error}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition"
          >
            Reintentar pasarela
          </button>
          <button
            onClick={() => setShowModalSimular(true)}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
          >
            Intentar pago simulado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-7 text-center sm:text-left">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--blue)]">Pasarela de Pago Municipal</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl font-sans">Pago de tu Trámite</h1>
        <p className="mt-2 text-sm text-slate-500">
          Selecciona tu método preferido para completar la tasa de tu Licencia de Funcionamiento.
        </p>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100 sm:p-8">
        {/* Decoración superior sutil */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600" />

        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Concepto de pago</p>
            <p className="mt-1 font-bold text-slate-800">Licencia de Funcionamiento</p>
            <p className="text-xs text-[var(--blue)] font-mono font-semibold mt-1">Trámite ID: {tramiteId.slice(0, 10).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
              Monto a Pagar
            </span>
            <p className="mt-1 text-3xl font-black text-slate-900">S/ 180.00</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-[var(--blue)]" />
            <p className="mt-4 text-sm font-semibold text-slate-700">Preparando pasarela de pago...</p>
            <p className="mt-1 text-xs text-slate-400">Espera un momento por favor.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <div className="flex gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-800">Métodos disponibles para pruebas</p>
                  <p className="mt-0.5">
                    Puedes realizar el pago real a través del sandbox de Mercado Pago o simular el éxito instantáneamente usando la herramienta local de desarrollo.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Botón 1: Pagar con Mercado Pago (Redirección Directa al Checkout de Mercado Pago) */}
              <a
                href={checkoutUrl ?? "#"}
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-[#009ee3] px-6 py-4 text-base font-bold text-white shadow-lg shadow-sky-100 transition-all hover:bg-[#008ed0] hover:shadow-xl active:scale-[0.98]"
              >
                Pagar con Mercado Pago
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>

              {/* Botón 2: Abrir modal de Simulación de Pago */}
              <button
                onClick={() => setShowModalSimular(true)}
                disabled={simulando}
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-50 transition-all hover:bg-emerald-800 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="h-5 w-5 fill-current" />
                Simular Pago (Sin Mercado Pago)
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> ¿Necesitas ayuda?
              </span>
              <span className="flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Términos y condiciones
              </span>
            </div>
          </div>
        )}
      </section>

      {/* MODAL PARA SELECCIONAR MÉTODO DE PAGO SIMULADO Y CALCULAR VUELTO */}
      {showModalSimular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Play className="h-5 w-5 text-emerald-600 fill-current" />
                  Selecciona Método de Pago Simulado
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige la modalidad para emitir el comprobante y calcular vuelto.
                </p>
              </div>
              <button
                onClick={() => setShowModalSimular(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="shrink-0 text-red-500" size={16} />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* Opciones de Método de Pago */}
            <div className="grid gap-3">
              {/* Opción 1: Tarjeta */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("TARJETA")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "TARJETA"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "TARJETA" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Tarjeta de Débito / Crédito</p>
                    <p className="text-xs text-slate-500">Pago exacto S/ 180.00 con tarjeta bancaria</p>
                  </div>
                </div>
                {metodoSimulacion === "TARJETA" && <Check className="text-emerald-600" size={20} />}
              </button>

              {/* Opción 2: Yape / BCP */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("YAPE")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "YAPE"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "YAPE" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <QrCode size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Yape / BCP QR</p>
                    <p className="text-xs text-slate-500">Pago exacto S/ 180.00 por transferencia móvil Yape</p>
                  </div>
                </div>
                {metodoSimulacion === "YAPE" && <Check className="text-emerald-600" size={20} />}
              </button>

              {/* Opción 3: Pago Mixto con Vuelto */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("MIXTO")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "MIXTO"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "MIXTO" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Split size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Pago Mixto con Vuelto (Tarjeta + Yape)</p>
                    <p className="text-xs text-slate-500">Permite montos mayores para calcular el vuelto en caja o Yape</p>
                  </div>
                </div>
                {metodoSimulacion === "MIXTO" && <Check className="text-emerald-600" size={20} />}
              </button>
            </div>

            {/* Inputs para Pago Mixto y Cálculo de Vuelto */}
            {metodoSimulacion === "MIXTO" && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4 animate-in fade-in">
                <div>
                  <p className="text-xs font-bold text-indigo-900">Ingreso de Montos Recibidos:</p>
                  <p className="text-[11px] text-slate-500">Tasa del trámite a cubrir: <strong>S/ 180.00</strong></p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tarjeta / Efectivo (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoTarjetaInput}
                      onChange={(e) => setMontoTarjetaInput(handleDecimalInput(e.target.value))}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Yape (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoYapeInput}
                      onChange={(e) => setMontoYapeInput(handleDecimalInput(e.target.value))}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>

                {/* Resumen en tiempo real */}
                <div className="flex items-center justify-between border-t border-indigo-100 pt-3 text-xs">
                  <span className="text-slate-600 font-medium">Total Recibido:</span>
                  <span className="font-bold text-slate-900">S/ {totalEntregado.toFixed(2)}</span>
                </div>

                {totalEntregado < 179.99 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-amber-600" />
                    El total entregado (S/ {totalEntregado.toFixed(2)}) debe ser al menos S/ 180.00.
                  </div>
                )}

                {/* Si hay vuelto a entregar */}
                {vueltoCalculadoTotal > 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Check size={16} className="text-emerald-600" />
                        Vuelto Total a Entregar:
                      </span>
                      <span className="text-base font-black text-emerald-700">
                        S/ {vueltoCalculadoTotal.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-emerald-900">Modalidad de Entrega del Vuelto:</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <button
                        type="button"
                        onClick={() => setVueltoModo("EFECTIVO")}
                        className={`rounded-xl border p-2 font-bold transition ${
                          vueltoModo === "EFECTIVO"
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        💵 Efectivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setVueltoModo("YAPE")}
                        className={`rounded-xl border p-2 font-bold transition ${
                          vueltoModo === "YAPE"
                            ? "border-purple-600 bg-purple-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        📱 Yape
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVueltoModo("MIXTO");
                          setVueltoEfectivoCustom((vueltoCalculadoTotal / 2).toFixed(2));
                          setVueltoYapeCustom((vueltoCalculadoTotal / 2).toFixed(2));
                        }}
                        className={`rounded-xl border p-2 font-bold transition ${
                          vueltoModo === "MIXTO"
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        🔀 Mixto
                      </button>
                    </div>

                    {vueltoModo === "MIXTO" && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Vuelto Efectivo (S/)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={vueltoEfectivoCustom}
                            onChange={(e) => {
                              const val = handleDecimalInput(e.target.value);
                              setVueltoEfectivoCustom(val);
                              const num = parseFloat(val) || 0;
                              if (num <= vueltoCalculadoTotal) {
                                setVueltoYapeCustom((vueltoCalculadoTotal - num).toFixed(2));
                              }
                            }}
                            className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Vuelto Yape (S/)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={vueltoYapeCustom}
                            onChange={(e) => {
                              const val = handleDecimalInput(e.target.value);
                              setVueltoYapeCustom(val);
                              const num = parseFloat(val) || 0;
                              if (num <= vueltoCalculadoTotal) {
                                setVueltoEfectivoCustom((vueltoCalculadoTotal - num).toFixed(2));
                              }
                            }}
                            className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>
                    )}

                    {/* VALIDACIÓN DE SALDO EN CAJA DE TRUJILLO & BOTÓN DE PEDIR SENCILLO */}
                    {vueltoEfectivoCalculado > saldoDisponibleEnCaja && (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3 animate-in fade-in">
                        <div className="flex items-start gap-2 text-amber-900">
                          <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-bold">Saldo Insuficiente en Caja de Trujillo</p>
                            <p className="mt-0.5">
                              El vuelto en efectivo a entregar (<strong>S/ {vueltoEfectivoCalculado.toFixed(2)}</strong>) supera el dinero actual disponible en caja (<strong>S/ {saldoDisponibleEnCaja.toFixed(2)}</strong>).
                            </p>
                          </div>
                        </div>

                        {sencilloEnviado ? (
                          <div className="rounded-xl bg-amber-100 p-3 text-center border border-amber-300 animate-pulse">
                            <p className="text-xs font-extrabold text-amber-900 flex items-center justify-center gap-1.5">
                              <LoaderCircle size={16} className="animate-spin text-amber-700" />
                              ⌛ Solicitud de Sencillo Enviada
                            </p>
                            <p className="text-[11px] text-amber-800 mt-1">
                              En espera de aprobación por el Administrador MPT para transferir dinero desde Tesorería.
                            </p>
                          </div>
                        ) : estadoSencilloStatus === "RECHAZADO" ? (
                          <div className="rounded-xl bg-red-100 p-2.5 text-xs font-bold text-red-800 text-center">
                            ❌ Solicitud de Sencillo Rechazada por el Administrador. Ajusta los montos.
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handlePedirSencillo}
                            disabled={solicitandoSencillo}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                          >
                            <Coins size={16} />
                            {solicitandoSencillo ? "Enviando Solicitud..." : "🙋‍♂️ Pedir Sencillo a la Municipalidad Provincial de Trujillo"}
                          </button>
                        )}
                      </div>
                    )}

                    {estadoSencilloStatus === "APROBADO" && (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
                        <Check size={18} className="text-emerald-700 shrink-0" />
                        ✅ ¡Solicitud de sencillo APROBADA por el Administrador MPT! La caja ha sido recargada.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModalSimular(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEjecutarSimulacion}
                disabled={simulando || (metodoSimulacion === "MIXTO" && (totalEntregado < 179.99 || vueltoEfectivoCalculado > saldoDisponibleEnCaja))}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
              >
                {simulando ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Procesando pago...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Confirmar y Simular Pago
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

export default function PagoPage() {
  return (
    <div className="py-6 sm:py-10">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
            <LoaderCircle className="h-6 w-6 animate-spin text-[var(--blue)]" />
            Cargando pasarela de pago…
          </div>
        }
      >
        <PagoContent />
      </Suspense>
    </div>
  );
}
