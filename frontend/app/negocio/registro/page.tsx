import { PageHeading } from "@/components/layout/DashboardShell";
import { RegistroTramiteForm } from "@/components/tramites/RegistroTramiteForm";

export default function RegistroNegocioPage() { return <div className="mx-auto max-w-4xl"><PageHeading title="Nuevo trámite" description="Completa los datos tal como figuran en SUNAT y adjunta el plano del local." /><RegistroTramiteForm /></div>; }
