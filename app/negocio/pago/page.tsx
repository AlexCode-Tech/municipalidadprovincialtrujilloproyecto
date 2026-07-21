"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck, ArrowRight, ExternalLink, HelpCircle, AlertCircle, Play } from "lucide-react";

function PagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tramiteId = searchParams.get("tramiteId") ?? "";
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tramiteId) return;

    async function obtenerPreferencia() {
      try {
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

    void obtenerPreferencia();
  }, [tramiteId]);

  const handleSimularPago = async () => {
    setSimulando(true);
    setError(null);
    try {
      const res = await fetch("/api/pagos/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tramiteId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No se pudo procesar la simulación de pago.");
      }

      // Redirigir a resultado aprobado
      router.push(`/negocio/pago/resultado?tramiteId=${tramiteId}&estado=aprobado`);
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

  if (error) {
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
            onClick={handleSimularPago}
            disabled={simulando}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
          >
            {simulando ? "Simulando..." : "Intentar pago simulado"}
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

              {/* Botón 2: Pago Simulado Local */}
              <button
                onClick={handleSimularPago}
                disabled={simulando}
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-50 transition-all hover:bg-emerald-800 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {simulando ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Simulando pago...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-current" />
                    Simular Pago (Sin Mercado Pago)
                  </>
                )}
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
