import { PageHeading } from "@/components/layout/DashboardShell";
import { InspeccionesHoy } from "@/components/inspecciones/InspeccionesHoy";

export default function InspeccionesHoyPage() { return <div className="mx-auto max-w-7xl"><PageHeading title="Inspecciones de hoy" description="Solo se muestran las visitas pendientes del día actual. La lista se actualiza al registrar cada resultado." /><InspeccionesHoy /></div>; }
