import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function CajeroLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.rol !== "CAJERO") redirect("/");

  if (session.user.email && session.user.email !== "alexpsm2005@gmail.com") {
    const usuario = await getPrisma().usuario.findFirst({
      where: { OR: [{ email: session.user.email }, { id: session.user.id }] },
      select: { estado: true }
    });
    if (usuario && usuario.estado === "INACTIVO") {
      redirect("/login");
    }
  }

  return (
    <DashboardShell
      role="CAJERO"
      name={session.user.name ?? "Cajero"}
      userEmail={session.user.email ?? undefined}
      userId={session.user.id ?? undefined}
    >
      {children}
    </DashboardShell>
  );
}
