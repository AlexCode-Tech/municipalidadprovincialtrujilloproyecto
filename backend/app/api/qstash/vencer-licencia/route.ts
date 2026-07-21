import { NextResponse } from "next/server";
import { enviarCorreo } from "@/lib/email";
import { enviarPush } from "@/lib/push";
import { getPrisma } from "@/lib/prisma";
import { verifyQStash } from "@/lib/qstash-auth";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verifyQStash(request, raw))) return NextResponse.json({ error: "Firma QStash inválida" }, { status: 401 });
  const { licenciaId } = JSON.parse(raw) as { licenciaId: string };
  const licencia = await getPrisma().licencia.findUniqueOrThrow({ where: { id: licenciaId }, include: { tramite: { include: { negocio: { include: { usuario: true } } } } } });
  await getPrisma().tramite.update({ where: { id: licencia.tramiteId }, data: { estado: "VENCIDO" } });

  const { notificarLicenciaVencida } = require("@/lib/notificaciones");
  void notificarLicenciaVencida(licenciaId);

  const body = `Tu licencia ${licencia.numero} está vencida. El PDF mostrará la marca de agua VENCIDA hasta completar un nuevo trámite o renovación válida.`;
  const subscriptions = await getPrisma().suscripcionPush.findMany({ where: { usuarioId: licencia.tramite.negocio.usuarioId } });
  await Promise.allSettled([enviarCorreo({ to: licencia.tramite.negocio.usuario.email, subject: "Tu licencia municipal está vencida", text: body }), ...subscriptions.map((subscription) => enviarPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, { title: "Licencia vencida", body, url: "/negocio/licencia" }))]);
  return NextResponse.json({ expired: true });
}
