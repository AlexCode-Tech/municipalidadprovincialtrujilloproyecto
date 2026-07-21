import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSystemDate } from "@/lib/system-date";

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma();
    const hoy = await getSystemDate();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
    const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

    // Buscar inspecciones pendientes programadas para hoy
    const inspecciones = await prisma.inspeccion.findMany({
      where: {
        fechaProgramada: {
          gte: inicioDia,
          lte: finDia
        },
        resultado: "PENDIENTE"
      },
      include: {
        tramite: {
          include: {
            negocio: true
          }
        }
      },
      orderBy: { fechaProgramada: "asc" }
    });

    // Contar inspecciones completadas de hoy (CONFORME o OBSERVADO)
    const completadasCount = await prisma.inspeccion.count({
      where: {
        fechaProgramada: {
          gte: inicioDia,
          lte: finDia
        },
        resultado: {
          in: ["CONFORME", "OBSERVADO"]
        }
      }
    });

    // Mapear al formato que consume la interfaz de InspeccionesHoy
    const formateadas = inspecciones.map(ins => ({
      id: ins.id,
      hora: new Date(ins.fechaProgramada).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      negocio: ins.tramite.negocio.razonSocial,
      ruc: ins.tramite.negocio.ruc,
      direccion: ins.tramite.negocio.domicilioFiscal,
      telefono: ins.tramite.negocio.telefono || "987 654 321",
      visita: ins.numeroVisita,
      codigoTramite: ins.tramite.codigo
    }));

    return NextResponse.json({
      inspecciones: formateadas,
      completadasCount
    });
  } catch (error) {
    console.error("Error al obtener inspecciones de hoy:", error);
    return NextResponse.json({ error: "No se pudieron cargar las inspecciones." }, { status: 500 });
  }
}
