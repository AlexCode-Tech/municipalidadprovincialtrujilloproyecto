import { NextResponse } from "next/server";
import { enviarCorreo } from "@/lib/email";
import { enviarPush } from "@/lib/push";
import { getPrisma } from "@/lib/prisma";
import { verifyQStash } from "@/lib/qstash-auth";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verifyQStash(request, raw))) return NextResponse.json({ error: "Firma QStash inválida" }, { status: 401 });
  const { inspeccionId } = JSON.parse(raw) as { inspeccionId: string };
  const inspection = await getPrisma().inspeccion.findUniqueOrThrow({ where: { id: inspeccionId }, include: { inspector: true, tramite: { include: { negocio: { include: { usuario: true } } } } } });
  const businessText = `Hoy tienes tu inspección municipal para ${inspection.tramite.negocio.razonSocial}.`;
  const inspectorText = `Hoy tienes que cumplir la inspección de ${inspection.tramite.negocio.razonSocial}.`;
  const subscriptions = await getPrisma().suscripcionPush.findMany({ where: { usuarioId: { in: [inspection.inspectorId, inspection.tramite.negocio.usuarioId] } } });
  await Promise.allSettled([
    enviarCorreo({ to: inspection.tramite.negocio.usuario.email, subject: "Hoy tienes tu inspección municipal", text: businessText }),
    enviarCorreo({ to: inspection.inspector.email, subject: "Inspección municipal programada para hoy", text: inspectorText }),
    ...subscriptions.map((subscription) => enviarPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, { title: "Inspección municipal", body: subscription.usuarioId === inspection.inspectorId ? inspectorText : businessText, url: subscription.usuarioId === inspection.inspectorId ? "/inspector/inspecciones-hoy" : "/negocio/estado" })),
  ]);
  return NextResponse.json({ notified: true });
}
