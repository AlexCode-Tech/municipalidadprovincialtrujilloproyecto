"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, LoaderCircle, ArrowRight, ClipboardList } from "lucide-react";

function ResultadoPagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const tramiteId = searchParams.get("tramiteId") ?? searchParams.get("external_reference") ?? "";
  const estadoParam = (searchParams.get("estado") || searchParams.get("status") || searchParams.get("collection_status") || "").toLowerCase();
  const paymentId = searchParams.get("payment_id") ?? searchParams.get("collection_id") ?? "";
  const esAprobado = estadoParam === "aprobado" || estadoParam === "approved";

  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!tramiteId) return;

    async function verificarEstado() {
      try {
        if (paymentId || esAprobado) {
          try {
            await fetch("/api/pagos/confirmar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tramiteId, paymentId: paymentId || `mp-${Date.now()}` }),
            });
          } catch (e) {
            console.error("Error al confirmar pago:", e);
          }
        }

        const res = await fetch(`/api/tramites/${tramiteId}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const tramite = (await res.json()) as { estado: string; negocio?: { usuario?: { email?: string } } };
          const userEmail = tramite.negocio?.usuario?.email || "alexpsm2005@gmail.com";
          const emailTexto = ` a tu correo (${userEmail})`;

          if (tramite.estado === "INSPECCION_PROGRAMADA" || tramite.estado === "APROBADO" || esAprobado) {
            setSuccess(true);
            setMessage(`¡Tu pago ha sido procesado con éxito! Se ha enviado la factura electrónica${emailTexto} con el archivo PDF adjunto y hemos actualizado tu trámite.`);
          } else if (estadoParam === "pendiente" || estadoParam === "pending") {
            setSuccess(false);
            setMessage("Tu pago está en proceso de verificación por Mercado Pago. Esto puede tomar unos minutos.");
          } else {
            setSuccess(false);
            setMessage("El pago no pudo ser completado. Por favor, verifica los fondos de tu tarjeta o intenta con otro método.");
          }
        } else {
          if (esAprobado) {
            setSuccess(true);
            setMessage("¡Tu pago ha sido procesado de manera exitosa! La factura electrónica ha sido enviada a tu correo electrónico.");
          } else {
            setSuccess(false);
            setMessage("Hubo un inconveniente al procesar tu transacción.");
          }
        }
      } catch {
        if (esAprobado) {
          setSuccess(true);
          setMessage("¡Tu pago ha sido procesado de manera exitosa! La factura electrónica ha sido enviada a tu correo electrónico.");
        } else {
          setSuccess(false);
          setMessage("Hubo un inconveniente al procesar tu transacción.");
        }
      } finally {
        setChecking(false);
      }
    }

    void verificarEstado();
  }, [tramiteId, estadoParam, paymentId]);

  if (!tramiteId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold text-amber-800">Trámite no especificado</p>
        <p className="mt-1">Accede a esta página desde el enlace de retorno oficial de Mercado Pago.</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LoaderCircle className="h-10 w-10 animate-spin text-[var(--blue)]" />
        <p className="mt-4 text-sm font-semibold text-slate-700">Verificando estado del pago...</p>
        <p className="mt-1 text-xs text-slate-400">Por favor, no cierres esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6 sm:py-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100 sm:p-8">
        <div className="flex flex-col items-center text-center">
          {estadoParam === "aprobado" || success ? (
            <>
              <div className="rounded-full bg-emerald-50 p-3 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">¡Pago Confirmado!</h1>
              <p className="mt-3 text-sm text-slate-500 max-w-md leading-relaxed">{message}</p>
            </>
          ) : estadoParam === "pendiente" ? (
            <>
              <div className="rounded-full bg-amber-50 p-3 ring-8 ring-amber-500/10">
                <AlertCircle className="h-12 w-12 text-amber-600" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">Pago Pendiente</h1>
              <p className="mt-3 text-sm text-slate-500 max-w-md leading-relaxed">{message}</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-rose-50 p-3 ring-8 ring-rose-500/10">
                <XCircle className="h-12 w-12 text-rose-600" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">Pago no completado</h1>
              <p className="mt-3 text-sm text-slate-500 max-w-md leading-relaxed">{message}</p>
            </>
          )}

          <div className="mt-6 w-full rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 space-y-2 text-left ring-1 ring-slate-100">
            <div className="flex justify-between">
              <span>Trámite ID:</span>
              <span className="font-bold text-slate-800">{tramiteId.toUpperCase()}</span>
            </div>
            {paymentId && (
              <div className="flex justify-between">
                <span>Operación ID:</span>
                <span className="font-mono font-semibold text-slate-700">{paymentId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Monto pagado:</span>
              <span className="font-bold text-slate-800">S/ 180.00</span>
            </div>
          </div>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            {estadoParam === "aprobado" || success || estadoParam === "pendiente" ? (
              <button
                onClick={() => router.push("/negocio/estado")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--blue)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-600 transition"
              >
                <ClipboardList className="h-4 w-4" /> Ir a Mi Trámite
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push(`/negocio/pago?tramiteId=${tramiteId}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--blue)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-600 transition"
                >
                  Intentar Nuevamente
                </button>
                <button
                  onClick={() => router.push("/negocio/estado")}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Ver Trámite
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultadoPagoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
          <LoaderCircle className="h-6 w-6 animate-spin text-[var(--blue)]" />
          Procesando respuesta de pago…
        </div>
      }
    >
      <ResultadoPagoContent />
    </Suspense>
  );
}
