import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { programarJob } from "@/lib/qstash";

const schema = z.object({ sinCambios: z.literal(true) });
export async function POST(request: Request, { params }: { params: Promise<{ tramiteId: string }> }) {
  const access = await requireRole("NEGOCIO");
  if (access.error) return access.error;
  schema.parse(await request.json());
  const { tramiteId } = await params;
  if (!(await canAccessTramite(access.session.user, tramiteId))) return forbidden();
  const tramite = await getPrisma().tramite.update({ where: { id: tramiteId }, data: { confirmacionSinCambios: true } });
  await programarJob("/api/qstash/cobrar-renovacion", { tramiteId }, Math.floor(Date.now() / 1000) + 60);
  return NextResponse.json({ confirmed: true, tramiteId: tramite.id });
}
