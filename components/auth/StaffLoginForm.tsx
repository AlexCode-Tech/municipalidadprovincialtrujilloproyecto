"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { AlertCircle, CreditCard, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { RUTAS_POR_ROL, type Rol } from "@/lib/constantes";

type StaffRol = Extract<Rol, "ADMIN" | "CAJERO" | "INSPECTOR">;

const staffRoles: { id: StaffRol; label: string; icon: typeof CreditCard | typeof ShieldCheck; email: string }[] = [
  { id: "ADMIN", label: "Admin", icon: ShieldCheck, email: "alexpsm2005@gmail.com" },
  { id: "CAJERO", label: "Cajero", icon: CreditCard, email: "cajero@demo.pe" },
  { id: "INSPECTOR", label: "Inspector", icon: ShieldCheck, email: "inspector@demo.pe" },
];

export function StaffLoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<StaffRol>("ADMIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    async function checkAccountStatus() {
      if (!email) return;
      try {
        const resStatus = await fetch(`/api/auth/check-status?email=${encodeURIComponent(email)}&t=${Date.now()}`);
        if (resStatus.ok && active) {
          const data = await resStatus.json();
          if (data.status === "INACTIVO" && role !== "ADMIN" && data.rol !== "ADMIN") {
            const roleText = staffRoles.find((r) => r.id === role)?.label || role;
            setError(`La cuenta de ${roleText} (${email}) se encuentra inhabilitada por el administrador.`);
          } else {
            setError((prev) => (prev.includes("desactivada") || prev.includes("inhabilitada") ? "" : prev));
          }
        }
      } catch (e) {
        // ignore
      }
    }
    void checkAccountStatus();
    return () => {
      active = false;
    };
  }, [email, role]);

  const selectRole = (nextRole: StaffRol) => {
    setRole(nextRole);
    setEmail("");
    setPassword("");
    setError("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", { email, password, rol: role, redirect: false });
      if (result?.error) {
        try {
          const resStatus = await fetch(`/api/auth/check-status?email=${encodeURIComponent(email)}&t=${Date.now()}`);
          if (resStatus.ok) {
            const data = await resStatus.json();
            if (data.status === "INACTIVO" && role !== "ADMIN" && data.rol !== "ADMIN") {
              setError("Tu cuenta ha sido desactivada por el administrador. No tienes acceso al sistema.");
              return;
            }
            if (data.rol && data.rol !== role) {
              setError("El rol seleccionado no corresponde a esta cuenta.");
              return;
            }
          }
        } catch (e) {
          // Ignorar fallo de red del helper
        }
        setError("Correo o contraseña incorrectos. Revisa tus datos e intenta nuevamente.");
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
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--border)]">
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
          placeholder="ej. tucorreo@municipalidad.pe"
          className="min-w-0 flex-1 px-3 outline-none"
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="staff-password">
          Contraseña
        </label>
        {role === "ADMIN" && (
          <Link
            href={`/login/olvide-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            className="text-xs font-semibold text-[var(--blue)] hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        )}
      </div>
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
          placeholder="ej. M1Contraseña2026"
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

      {error && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700" role="alert">
          <AlertCircle className="shrink-0 text-red-600" size={20} />
          <span>{error}</span>
        </div>
      )}

      <button
        disabled={pending}
        className="focus-ring mt-6 h-12 w-full rounded-xl bg-[var(--blue)] px-5 font-semibold text-white shadow-sm transition hover:bg-[var(--blue-hover)] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Validando…" : "Ingresar"}
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
        <LockKeyhole size={14} /> Acceso seguro y confidencial
      </p>
    </form>
  );
}
