import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { scaleUpPago } from "@/lib/registrar-pago";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;
  const prisma = getPrisma();

  try {
    const pagos = await prisma.pago.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        tramite: {
          include: { negocio: true }
        }
      }
    });

    const scaledPagos = pagos.map(scaleUpPago);

    const inspecciones = await prisma.inspeccion.findMany({
      orderBy: { fechaProgramada: "desc" },
      include: {
        tramite: {
          include: { negocio: true }
        },
        inspector: {
          select: { nombre: true, email: true }
        }
      }
    });

    return NextResponse.json({ pagos: scaledPagos, inspecciones });
  } catch (error) {
    console.error("Error en supervisión general:", error);
    return NextResponse.json({ error: "No se pudieron obtener los registros de supervisión." }, { status: 500 });
  }
}
