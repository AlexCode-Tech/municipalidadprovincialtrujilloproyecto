import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  
  if (!session || session.user.rol !== "ADMIN") {
    redirect("/");
  }

  return (
    <DashboardShell role="ADMIN" name={session.user.name ?? "Administrador"}>
      {children}
    </DashboardShell>
  );
}
