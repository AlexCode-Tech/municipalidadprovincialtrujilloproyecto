import { NextRequest, NextResponse } from "next/server";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireRole(request, "NEGOCIO", "CAJERO", "INSPECTOR");
  if (access.error) return access.error;
  const { id } = await context.params;
  if (!(await canAccessTramite(access.session.user, id))) return forbidden();
  const tramite = await getPrisma().tramite.findUnique({ where: { id }, include: { negocio: true, pagos: true, inspecciones: true, licencia: true } });
  return tramite ? NextResponse.json(tramite) : NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
}
