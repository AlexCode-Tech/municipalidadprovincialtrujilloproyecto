import { NextResponse } from "next/server";

import { ConsultaRucError, consultarRuc } from "@/lib/consulta-ruc";
import { rucSchema } from "@/lib/validaciones";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/sunat/ruc/[ruc]">,
) {
  const { ruc } = await context.params;
  const validation = rucSchema.safeParse(ruc);
  if (!validation.success) {
    return NextResponse.json({ error: "Ingresa un RUC 20 válido de 11 dígitos." }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    
    // 1. Verificar si el RUC ya cuenta con un trámite APROBADO VIGENTE o activo en proceso en nuestra BD
    const negocioExistente = await prisma.negocio.findUnique({
      where: { ruc },
      select: {
        id: true,
        tramites: {
          orderBy: { creadoEn: "desc" },
          take: 1,
          select: { codigo: true, estado: true, licencia: true }
        }
      }
    });

    if (negocioExistente && negocioExistente.tramites.length > 0) {
      const ultimoTramite = negocioExistente.tramites[0];
      const estaVencida = ultimoTramite.licencia
        ? (new Date(ultimoTramite.licencia.venceEn) < new Date() || ultimoTramite.estado === "VENCIDO")
        : false;

      if (ultimoTramite.estado === "APROBADO" && !estaVencida) {
        return NextResponse.json(
          { error: `El RUC ${ruc} ya cuenta con una Licencia de Funcionamiento Aprobada y Vigente (${ultimoTramite.codigo}). No es posible iniciar un nuevo trámite.` },
          { status: 400 }
        );
      }

      if (["PAGO_PENDIENTE", "PAGO_RECHAZADO", "INSPECCION_PROGRAMADA", "OBSERVADO", "EN_INSPECCION", "SUBSANADO"].includes(ultimoTramite.estado)) {
        return NextResponse.json(
          { error: `El RUC ${ruc} ya cuenta con un trámite activo en proceso (${ultimoTramite.codigo}).` },
          { status: 400 }
        );
      }
    }

    // 2. Si no hay trámite activo, consultar los datos de la SUNAT
    const datosRuc = await consultarRuc(validation.data);
    return NextResponse.json(datosRuc);
  } catch (error) {
    if (error instanceof ConsultaRucError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Error inesperado al consultar RUC", error);
    return NextResponse.json(
      { error: "No se pudo consultar el RUC. Intenta nuevamente." },
      { status: 500 },
    );
  }
}
