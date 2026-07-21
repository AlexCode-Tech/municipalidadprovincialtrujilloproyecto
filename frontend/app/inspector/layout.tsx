import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function InspectorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.rol !== "INSPECTOR") redirect("/");
  return <DashboardShell role="INSPECTOR" name={session.user.name ?? "Inspector"}>{children}</DashboardShell>;
}
