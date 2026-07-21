import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;
  
  const prisma = getPrisma();

  try {
    const notificaciones = await prisma.notificacionEmail.findMany({
      orderBy: { fechaEnvio: "desc" }
    });
    return NextResponse.json(notificaciones);
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    return NextResponse.json({ error: "No se pudieron cargar las notificaciones." }, { status: 500 });
  }
}
