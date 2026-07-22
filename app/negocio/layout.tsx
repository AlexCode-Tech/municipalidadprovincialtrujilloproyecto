import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function NegocioLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null);
  return (
    <DashboardShell
      role="NEGOCIO"
      name={session?.user?.name ?? "Negocio"}
      userEmail={session?.user?.email ?? undefined}
      userId={session?.user?.id ?? undefined}
    >
      {children}
    </DashboardShell>
  );
}
