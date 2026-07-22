"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoMunicipal } from "@/components/brand/LogoMunicipal";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";

type Paso = "email" | "codigo";

export default function OlvidePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paso, setPaso] = useState<Paso>("email");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [repetirPassword, setRepetirPassword] = useState("");
  const [showNueva, setShowNueva] = useState(false);
  const [showRepetir, setShowRepetir] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSolicitarCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      if (email.trim().toLowerCase() !== "alexpsm2005@gmail.com") {
        setError("Solo el correo del administrador puede recuperar la contraseña.");
        return;
      }
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "solicitar", email }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ocurrió un error. Intenta nuevamente.");
          return;
        }
        setSuccess("Código enviado. Revisa tu correo electrónico.");
        setPaso("codigo");
      } catch {
        setError("Error de conexión. Intenta nuevamente.");
      }
    });
  };


  const handleVerificarCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (nuevaPassword !== repetirPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (nuevaPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verificar", email, code, nuevaPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ocurrió un error. Intenta nuevamente.");
          return;
        }
        setSuccess("¡Contraseña actualizada correctamente! Redirigiendo...");
        setTimeout(() => router.push("/login"), 2500);
      } catch {
        setError("Error de conexión. Intenta nuevamente.");
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#f0f4fb] flex flex-col">
      <header className="border-b-2 border-[var(--blue)] bg-white">
        <div className="mx-auto flex max-w-[1320px] items-center gap-5 px-5 py-3 sm:px-8">
          <LogoMunicipal />
          <div className="hidden h-14 w-px bg-[var(--gold)] sm:block" />
          <p className="text-lg font-bold tracking-[-.02em] text-[var(--navy)] sm:text-2xl">
            Sistema de Licencias de Funcionamiento
          </p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--navy)] shadow-lg">
              <KeyRound size={32} strokeWidth={1.6} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-[-.03em] text-[var(--navy)]">
              {paso === "email" ? "Recuperar contraseña" : "Verificar código"}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {paso === "email"
                ? "Ingresa tu correo y te enviaremos un código de verificación."
                : `Ingresa el código enviado a ${email} y tu nueva contraseña.`}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[0_18px_55px_rgba(12,31,80,.09)] sm:p-8">
            {/* Indicador de pasos */}
            <div className="mb-6 flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${paso === "email" ? "bg-[var(--blue)] text-white" : "bg-emerald-500 text-white"}`}>
                {paso === "email" ? "1" : <CheckCircle2 size={14} />}
              </div>
              <span className={`text-xs font-semibold ${paso === "email" ? "text-[var(--blue)]" : "text-emerald-600"}`}>
                Verificar correo
              </span>
              <div className="h-px flex-1 bg-slate-200" />
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${paso === "codigo" ? "bg-[var(--blue)] text-white" : "bg-slate-200 text-slate-400"}`}>
                2
              </div>
              <span className={`text-xs font-semibold ${paso === "codigo" ? "text-[var(--blue)]" : "text-slate-400"}`}>
                Nueva contraseña
              </span>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700" role="alert">
                <AlertCircle className="shrink-0 text-red-600 mt-0.5" size={18} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700" role="status">
                <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={18} />
                <span>{success}</span>
              </div>
            )}

            {paso === "email" ? (
              <form onSubmit={handleSolicitarCodigo} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="reset-email">
                    Correo electrónico
                  </label>
                  <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
                    <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]">
                      <Mail size={18} />
                    </span>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ej. tucorreo@municipalidad.pe"
                      className="min-w-0 flex-1 px-3 outline-none text-sm"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">El código se enviará al correo ingresado.</p>
                </div>

                <button
                  disabled={pending}
                  className="h-12 w-full rounded-xl bg-[var(--blue)] px-5 font-semibold text-white shadow-sm transition hover:bg-[var(--blue-hover)] disabled:cursor-wait disabled:opacity-70"
                >
                  {pending ? "Enviando código..." : "Enviar código de verificación"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerificarCodigo} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="reset-code">
                    Código de verificación
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="mt-2 h-14 w-full rounded-xl border border-[var(--border)] px-4 text-center text-2xl font-bold tracking-[.3em] outline-none focus:border-[var(--blue)] focus:ring-3 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => { setError(""); setSuccess(""); setPaso("email"); }}
                    className="mt-1.5 flex items-center gap-1 text-xs text-[var(--blue)] hover:underline"
                  >
                    <ArrowLeft size={12} /> Cambiar correo
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="nueva-password">
                    Nueva contraseña
                  </label>
                  <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
                    <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]">
                      <Lock size={18} />
                    </span>
                    <input
                      id="nueva-password"
                      type={showNueva ? "text" : "password"}
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      className="min-w-0 flex-1 px-3 outline-none text-sm"
                    />
                    <button type="button" onClick={() => setShowNueva((v) => !v)} className="grid w-12 place-items-center text-[#65718a]">
                      {showNueva ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="repetir-password">
                    Repetir contraseña
                  </label>
                  <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
                    <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]">
                      <Lock size={18} />
                    </span>
                    <input
                      id="repetir-password"
                      type={showRepetir ? "text" : "password"}
                      value={repetirPassword}
                      onChange={(e) => setRepetirPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Repite la nueva contraseña"
                      className="min-w-0 flex-1 px-3 outline-none text-sm"
                    />
                    <button type="button" onClick={() => setShowRepetir((v) => !v)} className="grid w-12 place-items-center text-[#65718a]">
                      {showRepetir ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  disabled={pending}
                  className="h-12 w-full rounded-xl bg-emerald-600 px-5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
                >
                  {pending ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--blue)] hover:underline">
                <ShieldCheck size={15} />
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
