import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const ruc = request.nextUrl.searchParams.get("ruc");
  let negocioId: string | null = null;

  if (ruc) {
    // Buscar negocio por RUC directamente para la consulta
    const negocio = await getPrisma().negocio.findUnique({
      where: { ruc },
      select: { id: true }
    });
    if (negocio) negocioId = negocio.id;
  } else {
    // Obtener negocio asociado al usuario logueado por sesión
    const access = await requireRole(request, "NEGOCIO");
    if (access.error) return access.error;

    const negocio = await getPrisma().negocio.findFirst({
      where: { usuarioId: access.session.user.id },
      select: { id: true }
    });
    if (negocio) negocioId = negocio.id;
  }

  if (!negocioId) {
    return NextResponse.json(null);
  }

  // Obtiene el último trámite del negocio logueado
  const tramite = await getPrisma().tramite.findFirst({
    where: { negocioId },
    orderBy: { creadoEn: "desc" },
    include: {
      negocio: true,
      licencia: true,
      inspecciones: {
        orderBy: { numeroVisita: "desc" }
      }
    }
  });

  if (!tramite) {
    return NextResponse.json(null);
  }

  // Si el trámite está APROBADO pero no tenía registro de Licencia creado, lo generamos automáticamente
  if (tramite.estado === "APROBADO" && !tramite.licencia) {
    const anoActual = new Date().getFullYear();
    const contadorLicencias = (await getPrisma().licencia.count()) + 1;
    const numeroLicencia = `LF-MPT-${anoActual}-${String(contadorLicencias).padStart(6, "0")}`;
    const emitidaEn = new Date();
    const venceEn = new Date(emitidaEn.getFullYear() + 1, emitidaEn.getMonth(), emitidaEn.getDate());

    const nuevaLicencia = await getPrisma().licencia.create({
      data: {
        tramiteId: tramite.id,
        numero: numeroLicencia,
        emitidaEn,
        venceEn,
      }
    });

    (tramite as any).licencia = nuevaLicencia;
  }

  return NextResponse.json(tramite, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}
