import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const access = await requireRole("NEGOCIO");
  if (access.error) return access.error;
  try {
    const negocio = await getPrisma().negocio.findFirst({
      where: { usuarioId: access.session.user.id },
      select: { id: true, ruc: true, razonSocial: true },
    });
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    return NextResponse.json(negocio);
  } catch (error) {
    return apiError(error, "No se pudo obtener el negocio");
  }
}
