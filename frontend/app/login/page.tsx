import { LogoMunicipal } from "@/components/brand/LogoMunicipal";
import { StaffLoginForm } from "@/components/auth/StaffLoginForm";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Acceso para Trabajadores | Sistema de Licencias de Funcionamiento",
  description: "Portal exclusivo para cajeros e inspectores municipales.",
};

export default function LoginPage() {
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
              <ShieldCheck size={32} strokeWidth={1.6} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-[-.03em] text-[var(--navy)]">
              Acceso municipal
            </h1>
            <p className="mt-2 text-sm text-[#4d5870]">
              Portal exclusivo para cajeros e inspectores municipales
            </p>
          </div>

          <StaffLoginForm />

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            ¿Necesitas tramitar una licencia?{" "}
            <Link href="/" className="font-semibold text-[var(--blue)] hover:underline">
              Ir a la página principal
            </Link>
          </p>
        </div>
      </div>

      <footer className="border-t border-[var(--border)] bg-white py-4 text-center text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} Municipalidad Provincial de Trujillo
      </footer>
    </main>
  );
}
