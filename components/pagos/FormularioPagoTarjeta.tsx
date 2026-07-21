"use client";

import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { useState } from "react";

const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
if (publicKey) initMercadoPago(publicKey, { locale: "es-PE" });

type CardSubmit = {
  token?: string;
  payment_method_id?: string;
  issuer_id?: string;
  installments?: number;
  payer?: { email?: string };
};

export function FormularioPagoTarjeta({ tramiteId }: { tramiteId: string }) {
  const [status, setStatus] = useState("");
  const [guardarTarjeta, setGuardarTarjeta] = useState(true);
  if (!publicKey) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Configura NEXT_PUBLIC_MP_PUBLIC_KEY para cargar el formulario seguro de tarjeta.</p>;
  return <div><label className="mb-5 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm"><input className="mt-1" type="checkbox" checked={guardarTarjeta} onChange={(e) => setGuardarTarjeta(e.target.checked)} /><span><strong>Facilitar mi renovación anual.</strong><br />Guardar la tarjeta tokenizada. Antes del próximo cobro deberás confirmar que el local no tuvo cambios.</span></label><CardPayment initialization={{ amount: 180 }} customization={{ paymentMethods: { maxInstallments: 1 } }} onSubmit={async (raw) => {
    const data = raw as CardSubmit;
    const response = await fetch("/api/pagos/tarjeta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tramiteId, token: data.token, paymentMethodId: data.payment_method_id, issuerId: data.issuer_id, installments: data.installments ?? 1, email: data.payer?.email, guardarTarjeta }) });
    const result = await response.json();
    setStatus(response.ok ? `Pago ${result.status === "approved" ? "aprobado" : "en proceso"}.` : result.error ?? "El pago fue rechazado. Puedes intentarlo nuevamente.");
  }} onError={(error) => setStatus(error.message)} />{status ? <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm" role="status">{status}</p> : null}</div>;
}
