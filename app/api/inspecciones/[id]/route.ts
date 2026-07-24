import { addYears } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/autorizacion";
import { agregarDiasHabiles } from "@/lib/dias-habiles";
import { getPrisma } from "@/lib/prisma";

const schema = z.discriminatedUnion("resultado", [
  z.object({ resultado: z.literal("CONFORME") }),
  z.object({ resultado: z.literal("OBSERVADO"), observaciones: z.string().min(10) }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireRole("INSPECTOR");
  if (access.error) return access.error;
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const current = await getPrisma().inspeccion.findFirstOrThrow({ where: { id, inspectorId: access.session.user.id }, include: { tramite: true } });
    const result = await getPrisma().$transaction(async (tx) => {
      const inspection = await tx.inspeccion.update({ where: { id }, data: { resultado: input.resultado, observaciones: "observaciones" in input ? input.observaciones : null, completadaEn: new Date() } });
      if (input.resultado === "CONFORME") {
        const emitidaEn = new Date();
        await tx.tramite.update({ where: { id: current.tramiteId }, data: { estado: "APROBADO" } });
        await tx.licencia.upsert({ where: { tramiteId: current.tramiteId }, create: { tramiteId: current.tramiteId, numero: `LF-${current.tramite.codigo}`, venceEn: addYears(emitidaEn, 1) }, update: { emitidaEn, venceEn: addYears(emitidaEn, 1) } });
      } else if (current.numeroVisita === 1) {
        await tx.tramite.update({ where: { id: current.tramiteId }, data: { estado: "OBSERVADO" } });
        await tx.inspeccion.create({ data: { tramiteId: current.tramiteId, inspectorId: current.inspectorId, numeroVisita: 2, fechaProgramada: agregarDiasHabiles(new Date(), 30) } });
      } else {
        await tx.tramite.update({ where: { id: current.tramiteId }, data: { estado: "DENEGADO" } });
      }
      return inspection;
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
