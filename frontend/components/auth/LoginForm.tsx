"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, CreditCard, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Store } from "lucide-react";
import { RUTAS_POR_ROL, type Rol } from "@/lib/constantes";

const roleConfig: { id: Rol; label: string; icon: typeof Store; email: string }[] = [
  { id: "NEGOCIO", label: "Negocio", icon: Store, email: "negocio@demo.pe" },
  { id: "CAJERO", label: "Cajero", icon: CreditCard, email: "cajero@demo.pe" },
  { id: "INSPECTOR", label: "Inspector", icon: ShieldCheck, email: "inspector@demo.pe" },
];

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<Rol>("NEGOCIO");
  const [email, setEmail] = useState(roleConfig[0].email);
  const [password, setPassword] = useState("demo123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const selectRole = (nextRole: Rol) => {
    setRole(nextRole);
    setEmail(roleConfig.find((item) => item.id === nextRole)?.email ?? "");
    setPassword("demo123");
    setError("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", { email, password, rol: role, redirect: false });
      if (result?.error) {
        setError("No pudimos validar tus datos. Revisa el correo, la contraseña y el rol.");
        return;
      }
      router.push(RUTAS_POR_ROL[role]);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[0_18px_55px_rgba(12,31,80,.09)] sm:p-8">
      <h2 className="text-2xl font-bold tracking-[-.02em] text-[var(--navy)]">Ingresa al sistema</h2>
      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium">Rol</legend>
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--border)]">
          {roleConfig.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => selectRole(id)} aria-pressed={role === id} className={`focus-ring flex min-h-20 flex-col items-center justify-center gap-1.5 border-r border-[var(--border)] px-2 text-sm font-semibold transition last:border-r-0 sm:flex-row ${role === id ? "bg-[#eef3ff] text-[var(--blue)] shadow-[inset_0_0_0_1px_var(--blue)]" : "text-[#46516b] hover:bg-slate-50"}`}>
              <Icon size={20} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 block text-sm font-medium" htmlFor="email">Correo electrónico</label>
      <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
        <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]"><Mail size={18} /></span>
        <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required className="min-w-0 flex-1 px-3 outline-none" />
      </div>
      <label className="mt-4 block text-sm font-medium" htmlFor="password">Contraseña</label>
      <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
        <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]"><LockKeyhole size={18} /></span>
        <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" required className="min-w-0 flex-1 px-3 outline-none" />
        <button type="button" onClick={() => setShowPassword((value) => !value)} className="focus-ring grid w-12 place-items-center rounded-lg text-[#65718a]" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
      </div>
      <div className="mt-2 min-h-5 text-sm text-[var(--danger)]" role="alert">{error}</div>
      <button disabled={pending} className="focus-ring mt-2 h-12 w-full rounded-xl bg-[var(--blue)] px-5 font-semibold text-white shadow-sm transition hover:bg-[var(--blue-hover)] disabled:cursor-wait disabled:opacity-70">{pending ? "Validando…" : "Ingresar"}</button>
      <button type="button" onClick={() => router.push("/negocio/registro")} className="focus-ring mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--blue)] px-5 font-semibold text-[var(--blue)] transition hover:bg-blue-50"><Building2 size={19} /> Registrar mi negocio</button>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--muted)]"><LockKeyhole size={14} /> Acceso seguro y confidencial</p>
    </form>
  );
}
