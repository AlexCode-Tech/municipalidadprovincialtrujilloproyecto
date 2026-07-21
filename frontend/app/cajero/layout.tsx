import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function CajeroLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.rol !== "CAJERO") redirect("/");
  return <DashboardShell role="CAJERO" name={session.user.name ?? "Cajero"}>{children}</DashboardShell>;
}
