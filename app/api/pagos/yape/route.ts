import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { crearPagoConYape } from "@/lib/mercadopago";
import { pagoYapeSchema } from "@/lib/validaciones";
import { registrarResultadoPago } from "@/lib/registrar-pago";

export async function POST(request: NextRequest) {
  const access = await requireRole(request, "NEGOCIO", "CAJERO");
  if (access.error) return access.error;
  try {
    const input = pagoYapeSchema.parse(await request.json());
    if (!(await canAccessTramite(access.session.user, input.tramiteId))) return forbidden();
    const resultado = await crearPagoConYape(input);
    await registrarResultadoPago({ tramiteId: input.tramiteId, metodo: "YAPE", resultado });
    return NextResponse.json({ paymentId: resultado.id, status: resultado.estado });
  } catch (error) { return apiError(error, "No se pudo procesar el pago con Yape"); }
}
