"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck, ArrowRight, ExternalLink, HelpCircle, AlertCircle, Play, CreditCard, QrCode, Split, X, Check } from "lucide-react";

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

  const handleDecimalInput = (val: string): string => {
    if (!val) return "";
    const sanitized = val.replace(",", ".");
    const parts = sanitized.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return sanitized;
  };

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
            // Ya está pagado -> Reemplazar ruta para no permitir volver atrás ni repagar
            router.replace(`/negocio/pago/resultado?tramiteId=${tramiteId}&estado=aprobado`);
            return;
          }
        }

        // 2. Obtener preferencia de Mercado Pago
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

  const handleEjecutarSimulacion = async () => {
    setSimulando(true);
    setError(null);

    let montoTarjeta = 180;
    let montoYape = 0;

    if (metodoSimulacion === "YAPE") {
      montoTarjeta = 0;
      montoYape = 180;
    } else if (metodoSimulacion === "MIXTO") {
      montoTarjeta = parseFloat(montoTarjetaInput) || 0;
      montoYape = parseFloat(montoYapeInput) || 0;

      if (Math.abs((montoTarjeta + montoYape) - 180) > 0.01) {
        setError("En pago mixto, la suma de Tarjeta y Yape debe ser exactamente S/ 180.00.");
        setSimulando(false);
        return;
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
          montoYape
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
              {/* Botón 1: Pagar con Mercado Pago */}
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

      {/* MODAL PARA SELECCIONAR MÉTODO DE PAGO SIMULADO */}
      {showModalSimular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Play className="h-5 w-5 text-emerald-600 fill-current" />
                  Selecciona Método de Pago Simulado
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige la modalidad para emitir el comprobante y factura electrónica.
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
                    <p className="text-xs text-slate-500">Pago completo S/ 180.00 con tarjeta bancaria</p>
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
                    <p className="text-xs text-slate-500">Pago completo S/ 180.00 por transferencia móvil Yape</p>
                  </div>
                </div>
                {metodoSimulacion === "YAPE" && <Check className="text-emerald-600" size={20} />}
              </button>

              {/* Opción 3: Pago Mixto */}
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
                    <p className="font-bold text-slate-900 text-sm">Pago Mixto (Tarjeta + Yape)</p>
                    <p className="text-xs text-slate-500">Divide el monto total de S/ 180.00 entre ambos métodos</p>
                  </div>
                </div>
                {metodoSimulacion === "MIXTO" && <Check className="text-emerald-600" size={20} />}
              </button>
            </div>

            {/* Inputs para Pago Mixto */}
            {metodoSimulacion === "MIXTO" && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3 animate-in fade-in">
                <p className="text-xs font-bold text-indigo-900">Distribución de Monto Mixto (Total: S/ 180.00):</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tarjeta (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="180"
                      value={montoTarjetaInput}
                      onChange={(e) => {
                        const val = handleDecimalInput(e.target.value);
                        setMontoTarjetaInput(val);
                        const num = parseFloat(val) || 0;
                        if (num <= 180) {
                          setMontoYapeInput((180 - num).toFixed(2));
                        }
                      }}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Yape (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="180"
                      value={montoYapeInput}
                      onChange={(e) => {
                        const val = handleDecimalInput(e.target.value);
                        setMontoYapeInput(val);
                        const num = parseFloat(val) || 0;
                        if (num <= 180) {
                          setMontoTarjetaInput((180 - num).toFixed(2));
                        }
                      }}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-3 pt-2">
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
                disabled={simulando}
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
