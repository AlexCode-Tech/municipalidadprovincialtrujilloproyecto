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
    // Consultar directamente los datos de la SUNAT (un mismo RUC puede tener múltiples trámites/sucursales)
    const datosRuc = await consultarRuc(validation.data);

    // Obtener trámites/locales previos si ya existen en la base de datos
    const negocio = await getPrisma().negocio.findUnique({
      where: { ruc: validation.data },
      include: {
        tramites: {
          where: {
            estado: {
              notIn: ["BORRADOR", "PAGO_PENDIENTE", "PENDIENTE_PAGO"]
            }
          },
          select: {
            id: true,
            codigo: true,
            estado: true,
            direccionTrujillo: true,
            creadoEn: true,
            licencia: { select: { numero: true, venceEn: true } }
          },
          orderBy: { creadoEn: "desc" }
        }
      }
    });

    return NextResponse.json({
      ...datosRuc,
      localesPrevios: negocio?.tramites.map(t => ({
        id: t.id,
        codigo: t.codigo,
        estado: t.estado,
        direccion: t.direccionTrujillo || negocio.domicilioFiscal,
        licencia: t.licencia?.numero || null
      })) || []
    });
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
