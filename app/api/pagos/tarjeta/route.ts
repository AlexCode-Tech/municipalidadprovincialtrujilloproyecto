import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { crearPagoConTarjeta, guardarTarjetaCliente } from "@/lib/mercadopago";
import { pagoTarjetaSchema } from "@/lib/validaciones";
import { registrarResultadoPago } from "@/lib/registrar-pago";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const access = await requireRole(request, "NEGOCIO", "CAJERO");
  if (access.error) return access.error;
  try {
    const input = pagoTarjetaSchema.parse(await request.json());
    if (!(await canAccessTramite(access.session.user, input.tramiteId))) return forbidden();
    const resultado = await crearPagoConTarjeta(input);
    await registrarResultadoPago({ tramiteId: input.tramiteId, metodo: "TARJETA", resultado });
    if (resultado.estado === "approved" && input.guardarTarjeta) {
      const tramite = await getPrisma().tramite.findUniqueOrThrow({ where: { id: input.tramiteId }, include: { negocio: true } });
      const saved = await guardarTarjetaCliente({ email: input.email, token: input.token });
      await getPrisma().tarjetaGuardada.upsert({ where: { negocioId_cardId: { negocioId: tramite.negocioId, cardId: saved.cardId } }, create: { negocioId: tramite.negocioId, ...saved }, update: { activa: true, ultimosCuatro: saved.ultimosCuatro } });
    }
    return NextResponse.json({ paymentId: resultado.id, status: resultado.estado });
  } catch (error) { return apiError(error, "No se pudo procesar el pago con tarjeta"); }
}
