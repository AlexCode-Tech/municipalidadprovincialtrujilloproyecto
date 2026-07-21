import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const ruc = request.nextUrl.searchParams.get("ruc");
  const factura = request.nextUrl.searchParams.get("factura");
  const prisma = getPrisma();
  
  let tramite: any = null;

  if (ruc) {
    // Buscar negocio por RUC directamente
    const negocio = await prisma.negocio.findUnique({
      where: { ruc },
      select: { id: true }
    });
    
    if (negocio) {
      tramite = await prisma.tramite.findFirst({
        where: { negocioId: negocio.id },
        orderBy: { creadoEn: "desc" },
        include: {
          negocio: true,
          licencia: true,
          inspecciones: {
            orderBy: { numeroVisita: "desc" }
          }
        }
      });
    }
  } else if (factura) {
    // Buscar tramite por número de factura (comprobante de pago)
    const pago = await prisma.pago.findFirst({
      where: {
        numeroFactura: {
          equals: factura,
          mode: "insensitive"
        }
      },
      include: {
        tramite: {
          include: {
            negocio: true,
            licencia: true,
            inspecciones: {
              orderBy: { numeroVisita: "desc" }
            }
          }
        }
      }
    });
    if (pago && pago.tramite) {
      tramite = pago.tramite;
    }
  } else {
    // Obtener negocio asociado al usuario logueado por sesión
    const access = await requireRole(request, "NEGOCIO");
    if (access.error) return access.error;

    const negocio = await prisma.negocio.findFirst({
      where: { usuarioId: access.session.user.id },
      select: { id: true }
    });
    
    if (negocio) {
      tramite = await prisma.tramite.findFirst({
        where: { negocioId: negocio.id },
        orderBy: { creadoEn: "desc" },
        include: {
          negocio: true,
          licencia: true,
          inspecciones: {
            orderBy: { numeroVisita: "desc" }
          }
        }
      });
    }
  }

  if (!tramite) {
    return NextResponse.json(null);
  }

  // Si el trámite está APROBADO pero no tenía registro de Licencia creado, lo generamos automáticamente
  if (tramite.estado === "APROBADO" && !tramite.licencia) {
    const anoActual = new Date().getFullYear();
    const contadorLicencias = (await prisma.licencia.count()) + 1;
    const numeroLicencia = `LF-MPT-${anoActual}-${String(contadorLicencias).padStart(6, "0")}`;
    const emitidaEn = new Date();
    const venceEn = new Date(emitidaEn.getFullYear() + 1, emitidaEn.getMonth(), emitidaEn.getDate());

    const nuevaLicencia = await prisma.licencia.create({
      data: {
        tramiteId: tramite.id,
        numero: numeroLicencia,
        emitidaEn,
        venceEn,
      }
    });

    tramite.licencia = nuevaLicencia;
  }

  return NextResponse.json(tramite, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}
