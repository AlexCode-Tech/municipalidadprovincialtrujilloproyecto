import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireRole(request, "ADMIN");
    if (access.error) return access.error;

    const body = await request.json();
    const { negocioId, tramiteId, emitidaEn, venceEn } = body;

    if ((!negocioId && !tramiteId) || !emitidaEn || !venceEn) {
      return NextResponse.json(
        { error: "Parámetros negocioId o tramiteId, emitidaEn y venceEn son obligatorios." },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const fechaEmitida = new Date(emitidaEn);
    const fechaVence = new Date(venceEn);

    if (isNaN(fechaEmitida.getTime()) || isNaN(fechaVence.getTime())) {
      return NextResponse.json(
        { error: "Las fechas o horas ingresadas son inválidas." },
        { status: 400 }
      );
    }

    let tramite;

    if (tramiteId) {
      tramite = await prisma.tramite.findUnique({
        where: { id: tramiteId },
        include: { licencia: true, negocio: true }
      });
    }

    if (!tramite && negocioId) {
      const negocio = await prisma.negocio.findUnique({
        where: { id: negocioId },
        include: {
          tramites: {
            orderBy: { creadoEn: "desc" },
            take: 1,
            include: { licencia: true }
          }
        }
      });

      if (!negocio) {
        return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
      }

      tramite = negocio.tramites[0];

      if (!tramite) {
        const codigoNuevo = `SOL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        tramite = await prisma.tramite.create({
          data: {
            codigo: codigoNuevo,
            negocioId: negocio.id,
            estado: new Date() > fechaVence ? "VENCIDO" : "APROBADO",
            monto: 180.00,
            direccionTrujillo: negocio.domicilioFiscal,
          },
          include: { licencia: true, negocio: true }
        });
      }
    }

    if (!tramite) {
      return NextResponse.json({ error: "Trámite no encontrado." }, { status: 404 });
    }

    const esVencida = new Date() > fechaVence;
    const nuevoEstado = esVencida ? "VENCIDO" : "APROBADO";

    let licencia;
    if (tramite.licencia) {
      licencia = await prisma.licencia.update({
        where: { id: tramite.licencia.id },
        data: {
          emitidaEn: fechaEmitida,
          venceEn: fechaVence,
        }
      });
    } else {
      licencia = await prisma.licencia.create({
        data: {
          numero: `LF-${tramite.codigo}`,
          tramiteId: tramite.id,
          emitidaEn: fechaEmitida,
          venceEn: fechaVence,
        }
      });
    }

    // Actualizar también el estado del trámite
    if (tramite.estado === "APROBADO" || tramite.estado === "VENCIDO" || tramite.estado === "PAGO_PENDIENTE" || tramite.estado === "BORRADOR") {
      await prisma.tramite.update({
        where: { id: tramite.id },
        data: { estado: nuevoEstado }
      });
    }

    return NextResponse.json({
      success: true,
      licencia,
      estadoTramite: nuevoEstado
    });
  } catch (error) {
    console.error("Error al actualizar fechas de licencia:", error);
    return NextResponse.json(
      { error: "Error al actualizar las fechas de la licencia." },
      { status: 500 }
    );
  }
}
