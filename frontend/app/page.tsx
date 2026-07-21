import {
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileText,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { LogoMunicipal } from "@/components/brand/LogoMunicipal";
import Link from "next/link";

export const metadata = {
  title: "Licencias de Funcionamiento | Municipalidad Provincial de Trujillo",
  description:
    "Inicia tu trámite de licencia de funcionamiento de forma rápida y sin complicaciones desde la Municipalidad Provincial de Trujillo.",
};

const steps = [
  { label: "Datos del negocio", icon: MapPinned },
  { label: "Pago S/180", icon: CreditCard },
  { label: "Inspección", icon: ClipboardCheck },
  { label: "Licencia PDF", icon: FileText },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-[var(--blue)] bg-white">
        <div className="mx-auto flex max-w-[1320px] items-center gap-5 px-5 py-3 sm:px-8">
          <LogoMunicipal />
          <div className="hidden h-14 w-px bg-[var(--gold)] sm:block" />
          <p className="text-lg font-bold tracking-[-.02em] text-[var(--navy)] sm:text-2xl">
            Sistema de Licencias de Funcionamiento
          </p>
        </div>
      </header>

      {/* Hero */}
      <section className="municipal-pattern relative overflow-hidden border-b border-[var(--border)]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.62),white_72%)]" />
        <div className="relative mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:py-24">
          {/* Left: headline */}
          <div className="max-w-2xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--gold)] bg-[#fffbf0] px-4 py-1.5 text-sm font-semibold text-[var(--navy)]">
              🏢 Para negocios de Trujillo
            </span>
            <h1 className="text-5xl font-bold leading-[.98] tracking-[-.055em] text-[var(--foreground)] sm:text-6xl">
              Licencias de funcionamiento,
              <br />
              sin vueltas
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-[#3f4a63]">
              Realiza el trámite de tu licencia de funcionamiento de manera rápida, sencilla y completamente en línea desde la Municipalidad Provincial de Trujillo.
            </p>

            {/* Steps */}
            <ol className="mt-10 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4">
              {steps.map(({ label, icon: Icon }, index) => (
                <li key={label} className="relative">
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-[var(--blue)] bg-white text-[var(--blue)] shadow-sm">
                    <Icon size={27} strokeWidth={1.7} />
                  </div>
                  <div className="mt-3 flex items-start gap-2 text-sm font-medium">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--blue)] text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span>{label}</span>
                  </div>
                </li>
              ))}
            </ol>

            {/* CTA */}
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/negocio/registro"
                id="cta-iniciar-tramite"
                className="focus-ring inline-flex items-center gap-2.5 rounded-xl bg-[var(--blue)] px-7 py-4 text-base font-bold text-white shadow-md transition hover:bg-[var(--blue-hover)] hover:shadow-lg active:scale-[.98]"
              >
                Iniciar trámite
                <ArrowRight size={20} strokeWidth={2.2} />
              </Link>
            </div>
          </div>

          {/* Right: info card */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-7 shadow-[0_18px_55px_rgba(12,31,80,.09)]">
            <h2 className="text-xl font-bold tracking-[-.02em] text-[var(--navy)]">
              ¿Qué necesitas saber?
            </h2>
            <ul className="mt-5 space-y-4">
              {[
                { title: "Costo del trámite", desc: "Pago único de S/ 180.00 soles." },
                { title: "Tiempo estimado", desc: "Resolución en un máximo de 15 días hábiles." },
                { title: "Inspección municipal", desc: "Un inspector verificará el local presencialmente." },
                { title: "Descarga tu licencia", desc: "Obtén tu licencia en PDF una vez aprobada." },
              ].map(({ title, desc }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--blue)] text-[11px] font-bold text-white">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
                    <p className="text-sm text-[#4d5870]">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-[#f5f8ff] p-4 text-sm text-[#3f4a63]">
              💡 <strong>Consejo:</strong> Ten a la mano el RUC de tu negocio y el plano del local antes de comenzar.
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f5f8ff] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-[1120px]">
          <div className="flex items-center gap-6">
            <span className="h-px flex-1 bg-[var(--gold)]" />
            <h2 className="text-center text-2xl font-bold text-[var(--navy)]">
              Un trámite claro de principio a fin
            </h2>
            <span className="h-px flex-1 bg-[var(--gold)]" />
          </div>
          <div className="mt-9 grid gap-8 md:grid-cols-3">
            {[
              { t: "Solicitud", d: "Completa los datos de tu negocio y presenta el plano del local.", i: FileCheck2 },
              { t: "Inspección", d: "El inspector municipal verifica el local en la fecha programada.", i: ShieldCheck },
              { t: "Licencia", d: "Si todo está conforme, descarga e imprime tu licencia en PDF.", i: FileText },
            ].map(({ t, d, i: Icon }) => (
              <div key={t} className="flex gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-blue-300 bg-white text-[var(--blue)]">
                  <Icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--blue)]">{t}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#4d5870]">{d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/negocio/registro"
              className="focus-ring inline-flex items-center gap-2.5 rounded-xl bg-[var(--blue)] px-8 py-4 text-base font-bold text-white shadow-md transition hover:bg-[var(--blue-hover)]"
            >
              Iniciar trámite ahora
              <ArrowRight size={20} strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--navy)] px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="rounded-xl bg-white p-2.5 shadow-md shrink-0 border border-slate-200">
              <LogoMunicipal compact />
            </div>
            <div>
              <p className="font-semibold text-base">Municipalidad Provincial de Trujillo</p>
              <p className="mt-0.5 text-xs text-blue-200">Sistema de Licencias de Funcionamiento</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/MPTrujilloPeru"
              target="_blank"
              rel="noopener noreferrer"
              title="Facebook - Municipalidad Provincial de Trujillo"
              aria-label="Facebook Municipalidad Provincial de Trujillo"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-[#1877f2] hover:scale-110 shadow-sm"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a
              href="https://x.com/muni_trujillo"
              target="_blank"
              rel="noopener noreferrer"
              title="X (Twitter) - Municipalidad Provincial de Trujillo"
              aria-label="X (Twitter) Municipalidad Provincial de Trujillo"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-black hover:scale-110 shadow-sm"
            >
              <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>

          <p className="text-xs text-blue-200">© {new Date().getFullYear()} Municipalidad Provincial de Trujillo</p>
        </div>
      </footer>
    </main>
  );
}
