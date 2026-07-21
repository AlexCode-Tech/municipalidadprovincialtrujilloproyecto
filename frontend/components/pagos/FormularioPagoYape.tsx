"use client";

import Script from "next/script";
import { useState } from "react";

declare global {
  interface Window {
    MercadoPago?: new (key: string) => { yape: (options: { otp: string; phoneNumber: string }) => { create: () => Promise<{ id: string }> } };
  }
}

export function FormularioPagoYape({ tramiteId }: { tramiteId: string }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey || !window.MercadoPago) return setStatus("Mercado Pago aún no está disponible.");
    setLoading(true);
    try {
      const token = await new window.MercadoPago(publicKey).yape({ otp, phoneNumber: phone }).create();
      const response = await fetch("/api/pagos/yape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tramiteId, token: token.id, otp, email }) });
      const result = await response.json();
      setStatus(response.ok ? `Pago ${result.status === "approved" ? "aprobado" : "en proceso"}.` : result.error ?? "No se pudo completar el pago.");
    } catch { setStatus("El código Yape fue rechazado o ya venció. Solicita uno nuevo e inténtalo otra vez."); }
    finally { setLoading(false); }
  };
  const input = "focus-ring mt-2 h-12 w-full rounded-xl border border-[var(--border)] px-3 outline-none";
  return <><Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" /><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Celular afiliado a Yape<input className={input} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" pattern="[0-9]{9}" maxLength={9} required /></label><label className="block text-sm font-medium">Código de aprobación de Yape<input className={input} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label><label className="block text-sm font-medium">Correo electrónico<input className={input} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label><button disabled={loading} className="focus-ring h-12 w-full rounded-xl bg-[#7a2ca6] font-semibold text-white disabled:opacity-60">{loading ? "Procesando…" : "Pagar S/180 con Yape"}</button>{status ? <p className="rounded-xl bg-slate-100 p-3 text-sm" role="status">{status}</p> : null}</form></>;
}
