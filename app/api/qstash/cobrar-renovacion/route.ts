import { addYears } from "date-fns";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { cobrarRenovacion } from "@/lib/mercadopago";
import { getPrisma } from "@/lib/prisma";
import { verifyQStash } from "@/lib/qstash-auth";
import { registrarResultadoPago } from "@/lib/registrar-pago";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verifyQStash(request, raw))) return NextResponse.json({ error: "Firma QStash inválida" }, { status: 401 });
  try {
    const { tramiteId } = JSON.parse(raw) as { tramiteId: string };
    const tramite = await getPrisma().tramite.findUniqueOrThrow({ where: { id: tramiteId }, include: { negocio: { include: { usuario: true, tarjetas: { where: { activa: true }, orderBy: { creadoEn: "desc" }, take: 1 } } }, licencia: true } });
    if (!tramite.confirmacionSinCambios) return NextResponse.json({ error: "Falta la confirmación del negocio de que no hubo cambios" }, { status: 409 });
    const tarjeta = tramite.negocio.tarjetas[0];
    if (!tarjeta) return NextResponse.json({ error: "No hay una tarjeta guardada; la renovación debe pagarse manualmente" }, { status: 409 });
    const resultado = await cobrarRenovacion({ tramiteId, email: tramite.negocio.usuario.email, customerId: tarjeta.customerId, cardToken: tarjeta.cardId });
    await registrarResultadoPago({ tramiteId, metodo: "TARJETA", resultado });
    if (resultado.estado === "approved" && tramite.licencia) await getPrisma().licencia.update({ where: { id: tramite.licencia.id }, data: { emitidaEn: new Date(), venceEn: addYears(tramite.licencia.venceEn, 1) } });
    return NextResponse.json({ status: resultado.estado });
  } catch (error) { return apiError(error); }
}
