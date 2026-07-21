"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertCircle, ChevronRight, ClipboardList, FilePlus2, FileText, LogOut, Menu, Search, ShieldCheck, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoMunicipal } from "@/components/brand/LogoMunicipal";
import type { Rol } from "@/lib/constantes";

const navByRole = {
  ADMIN: [
    { href: "/admin/usuarios", label: "Usuarios", icon: ShieldCheck },
    { href: "/admin/cajas", label: "Cajas y Cierre", icon: ClipboardList },
    { href: "/admin/supervision", label: "Supervisión", icon: Search },
    { href: "/admin/notificaciones", label: "Notificaciones", icon: FileText },
    { href: "/admin/simulador", label: "Simulador MPT", icon: FilePlus2 },
  ],
  NEGOCIO: [
    { href: "/negocio/estado", label: "Mi trámite", icon: ClipboardList },
    { href: "/negocio/registro", label: "Nuevo trámite", icon: FilePlus2 },
    { href: "/negocio/licencia", label: "Mi licencia", icon: FileText },
  ],
  CAJERO: [
    { href: "/cajero/caja", label: "Mi Caja / Turno", icon: Store },
    { href: "/cajero/nuevo-tramite", label: "Nuevo trámite", icon: FilePlus2 },
    { href: "/cajero/solicitudes", label: "Solicitudes / Cobros", icon: ClipboardList },
  ],
  INSPECTOR: [
    { href: "/inspector/inspecciones-hoy", label: "Inspecciones de hoy", icon: ShieldCheck },
  ],
} satisfies Record<Rol, { href: string; label: string; icon: typeof Store }[]>;

const roleLabel: Record<Rol, string> = { ADMIN: "Administrador", NEGOCIO: "Negocio", CAJERO: "Cajero", INSPECTOR: "Inspector" };

export function DashboardShell({ role, name, children }: { role: Rol; name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pendingCajasCount, setPendingCajasCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [disabledEmail, setDisabledEmail] = useState("");

  const nav = navByRole[role];

  const handleGoToLogin = async () => {
    setIsRedirecting(true);
    try {
      await signOut({ redirect: false });
    } catch (e) {
      // ignore
    }
    window.location.href = "/login";
  };

  // Verificación en tiempo real de validez de cuenta y rol en la BD
  useEffect(() => {
    // Al administrador nunca se le desactiva la cuenta
    if (role === "ADMIN") {
      setIsBlocked(false);
      return;
    }

    let active = true;

    async function checkUserActive() {
      try {
        const res = await fetch(`/api/auth/check?t=${Date.now()}&r=${Math.random()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          }
        });
        if (res.ok && active) {
          const body = await res.json();
          if (body.active === false) {
            setIsBlocked(true);
            if (body.user?.email) {
              setDisabledEmail(body.user.email);
            }
          } else if (body.active === true) {
            setIsBlocked(false);
          }
        }
      } catch (e) {
        // Ignorar errores de red
      }
    }

    void checkUserActive();
    const interval = setInterval(checkUserActive, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [role]);

  // Consultar en tiempo real si hay cajas pendientes de cierre para la alerta del Administrador
  useEffect(() => {
    if (role !== "ADMIN") return;

    let active = true;

    async function checkPendingCajas() {
      try {
        const res = await fetch(`/api/cajas?t=${Date.now()}`);
        if (res.ok && active) {
          const sessions = await res.json();
          if (Array.isArray(sessions)) {
            const count = sessions.filter((s: any) => s.estado === "SOLICITADO_CIERRE").length;
            setPendingCajasCount(count);
          }
        }
      } catch (e) {
        // Ignorar errores de red temporales
      }
    }

    void checkPendingCajas();
    const interval = setInterval(checkPendingCajas, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [role]);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center gap-4 px-4 sm:px-7">
          <button className="focus-ring rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <LogoMunicipal compact />
          <div className="hidden h-9 w-px bg-[var(--border)] sm:block" />
          <p className="hidden font-semibold text-[var(--navy)] sm:block">Licencias de Funcionamiento</p>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              {role === "NEGOCIO" ? (
                <p className="text-sm font-semibold">Negocio</p>
              ) : (
                <><p className="text-sm font-semibold">{name}</p><p className="text-xs text-[var(--muted)]">{roleLabel[role]}</p></>
              )}
            </div>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="focus-ring rounded-xl p-2.5 text-[#526079] hover:bg-slate-100" aria-label="Cerrar sesión"><LogOut size={20} /></button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <aside className={`${open ? "fixed inset-0 z-40 flex" : "hidden"} w-full bg-black/20 lg:sticky lg:top-20 lg:flex lg:h-[calc(100vh-5rem)] lg:w-64 lg:bg-white`}>
          <nav className="h-full w-72 border-r border-[var(--border)] bg-white p-4 lg:w-full" aria-label="Navegación principal">
            <div className="mb-5 flex items-center justify-between lg:hidden"><span className="font-bold text-[var(--navy)]">Menú</span><button onClick={() => setOpen(false)} className="focus-ring rounded-lg p-2" aria-label="Cerrar menú"><X /></button></div>
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#8590a5]">{roleLabel[role]}</p>
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              const isCajasLink = href === "/admin/cajas";
              const showBlinkingAlert = isCajasLink && role === "ADMIN" && pendingCajasCount > 0 && pathname !== "/admin/cajas";

              return (
                <Link
                  onClick={() => setOpen(false)}
                  key={href}
                  href={href}
                  className={`focus-ring mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    showBlinkingAlert
                      ? "animate-pulse bg-red-50 text-red-600 border border-red-300 font-bold shadow-sm"
                      : active
                      ? "bg-[#edf2ff] text-[var(--blue)]"
                      : "text-[#4d5870] hover:bg-slate-50"
                  }`}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{label}</span>

                  {showBlinkingAlert && (
                    <span className="relative flex h-2.5 w-2.5 ml-auto mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                  )}

                  {!showBlinkingAlert && <ChevronRight className="ml-auto" size={16} />}
                </Link>
              );
            })}
            <div className="mt-8 border-t border-[var(--border)] pt-5"><p className="px-3 text-xs leading-5 text-[var(--muted)]">¿Necesitas ayuda? Acércate a la plataforma de atención de la Municipalidad Provincial de Trujillo.</p></div>
          </nav>
          <button className="flex-1 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>

      {isBlocked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 text-center backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-red-100">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600 shadow-inner">
              <AlertCircle size={36} />
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">Tu cuenta ha sido desactivada</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Un administrador ha desactivado tu acceso al sistema. Se han bloqueado todas las funciones de este panel y no podrás presionar ningún botón excepto volver a iniciar sesión.
            </p>
            <div className="mt-7">
              <button
                onClick={handleGoToLogin}
                disabled={isRedirecting}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-red-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-red-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-75"
              >
                <LogOut size={20} />
                {isRedirecting ? "Cerrando sesión..." : "Volver a iniciar sesión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold tracking-[-.035em] text-[var(--foreground)]">{title}</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p></div>{action}</div>;
}

export function SearchBox({ placeholder = "Buscar por RUC, razón social o código" }: { placeholder?: string }) {
  return <label className="flex h-11 min-w-64 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-[#74809a] focus-within:border-[var(--blue)]"><Search size={18} /><input className="w-full bg-transparent text-sm outline-none" placeholder={placeholder} /></label>;
}
