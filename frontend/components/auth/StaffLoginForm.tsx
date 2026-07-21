"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CreditCard, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { RUTAS_POR_ROL, type Rol } from "@/lib/constantes";

type StaffRol = Extract<Rol, "CAJERO" | "INSPECTOR">;

const staffRoles: { id: StaffRol; label: string; icon: typeof CreditCard; email: string }[] = [
  { id: "CAJERO", label: "Cajero", icon: CreditCard, email: "cajero@demo.pe" },
  { id: "INSPECTOR", label: "Inspector", icon: ShieldCheck, email: "inspector@demo.pe" },
];

export function StaffLoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<StaffRol>("CAJERO");
  const [email, setEmail] = useState(staffRoles[0].email);
  const [password, setPassword] = useState("demo123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const selectRole = (nextRole: StaffRol) => {
    setRole(nextRole);
    setEmail(staffRoles.find((item) => item.id === nextRole)?.email ?? "");
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
      <fieldset className="mt-1">
        <legend className="mb-2 text-sm font-medium">Rol</legend>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--border)]">
          {staffRoles.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectRole(id)}
              aria-pressed={role === id}
              className={`focus-ring flex min-h-20 flex-col items-center justify-center gap-1.5 border-r border-[var(--border)] px-2 text-sm font-semibold transition last:border-r-0 sm:flex-row ${
                role === id
                  ? "bg-[#eef3ff] text-[var(--blue)] shadow-[inset_0_0_0_1px_var(--blue)]"
                  : "text-[#46516b] hover:bg-slate-50"
              }`}
            >
              <Icon size={20} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block text-sm font-medium" htmlFor="staff-email">
        Correo electrónico
      </label>
      <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
        <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]">
          <Mail size={18} />
        </span>
        <input
          id="staff-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          required
          className="min-w-0 flex-1 px-3 outline-none"
        />
      </div>

      <label className="mt-4 block text-sm font-medium" htmlFor="staff-password">
        Contraseña
      </label>
      <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-[var(--border)] focus-within:border-[var(--blue)] focus-within:ring-3 focus-within:ring-blue-100">
        <span className="grid w-12 place-items-center border-r border-[var(--border)] text-[#74809a]">
          <LockKeyhole size={18} />
        </span>
        <input
          id="staff-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className="min-w-0 flex-1 px-3 outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="focus-ring grid w-12 place-items-center rounded-lg text-[#65718a]"
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>

      <div className="mt-2 min-h-5 text-sm text-[var(--danger)]" role="alert">
        {error}
      </div>

      <button
        disabled={pending}
        className="focus-ring mt-2 h-12 w-full rounded-xl bg-[var(--blue)] px-5 font-semibold text-white shadow-sm transition hover:bg-[var(--blue-hover)] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Validando…" : "Ingresar"}
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
        <LockKeyhole size={14} /> Acceso seguro y confidencial
      </p>
    </form>
  );
}
