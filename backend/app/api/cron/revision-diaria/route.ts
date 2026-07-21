import { addDays, endOfDay, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { programarJob } from "@/lib/qstash";
import { enviarCorreo } from "@/lib/email";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const now = new Date();
  const prisma = getPrisma();
  const [today, expired, renewalWindow] = await Promise.all([
    prisma.inspeccion.findMany({ where: { resultado: "PENDIENTE", fechaProgramada: { gte: startOfDay(now), lte: endOfDay(now) } }, select: { id: true } }),
    prisma.licencia.findMany({ where: { venceEn: { lt: now }, tramite: { estado: "APROBADO" } }, select: { id: true } }),
    prisma.licencia.findMany({ where: { venceEn: { gte: startOfDay(addDays(now, 30)), lte: endOfDay(addDays(now, 30)) } }, include: { tramite: { include: { negocio: { include: { usuario: true } } } } } }),
  ]);
  const timestamp = Math.floor(Date.now() / 1000) + 2;
  await Promise.allSettled([
    ...today.map(({ id }) => programarJob("/api/qstash/notificar-inspeccion", { inspeccionId: id }, timestamp)),
    ...expired.map(({ id }) => programarJob("/api/qstash/vencer-licencia", { licenciaId: id }, timestamp)),
    ...renewalWindow.map((license) => enviarCorreo({ to: license.tramite.negocio.usuario.email, subject: "Confirma los datos para renovar tu licencia", text: `Tu licencia ${license.numero} vence en 30 días. Ingresa al sistema y confirma que el local y sus planos no tuvieron cambios antes de autorizar el pago de S/180.` })),
  ]);
  return NextResponse.json({ inspectionsQueued: today.length, expirationsQueued: expired.length, renewalCheckpoints: renewalWindow.length });
}
