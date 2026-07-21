import { DashboardShell } from "@/components/layout/DashboardShell";

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="NEGOCIO" name="Negocio">{children}</DashboardShell>;
}
