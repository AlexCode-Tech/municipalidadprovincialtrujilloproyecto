import { PageHeading } from "@/components/layout/DashboardShell";
import { RegistroTramiteForm } from "@/components/tramites/RegistroTramiteForm";

export default function NuevoTramitePage() { return <div className="mx-auto max-w-4xl"><PageHeading title="Registrar solicitud presencial" description="Ingresa los datos entregados por el negocio. El trámite se activa cuando se confirma el pago de S/180." /><RegistroTramiteForm presencial /></div>; }
