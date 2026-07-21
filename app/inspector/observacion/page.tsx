import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { PageHeading } from "@/components/layout/DashboardShell";

export default function ObservacionPage() {
  return <div className="mx-auto max-w-3xl"><PageHeading title="Registrar observación" description="Las observaciones se registran desde la inspección pendiente del día para conservar el contexto de la visita." /><div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center"><MessageSquareWarning className="mx-auto text-orange-700" size={42} /><h2 className="mt-4 text-xl font-bold">Selecciona primero una inspección</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">Solo puedes observar solicitudes programadas para hoy. En la primera observación se agenda una segunda visita a 30 días hábiles; una segunda observación deniega el trámite.</p><Link href="/inspector/inspecciones-hoy" className="focus-ring mt-6 inline-flex rounded-xl bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-white">Ver inspecciones de hoy</Link></div></div>;
}
