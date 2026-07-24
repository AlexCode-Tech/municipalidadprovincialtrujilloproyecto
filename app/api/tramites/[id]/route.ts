import { NextRequest, NextResponse } from "next/server";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { scaleUpPago } from "@/lib/registrar-pago";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRole(request, "NEGOCIO", "CAJERO", "INSPECTOR");
  if (access.error) return access.error;
  const { id } = await params;
  if (!(await canAccessTramite(access.session.user, id))) return forbidden();
  const tramite = await getPrisma().tramite.findUnique({ where: { id }, include: { negocio: true, pagos: true, inspecciones: true, licencia: true } });
  
  if (tramite) {
    tramite.pagos = (tramite.pagos || []).map(scaleUpPago);
    return NextResponse.json(tramite);
  }
  return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
}
