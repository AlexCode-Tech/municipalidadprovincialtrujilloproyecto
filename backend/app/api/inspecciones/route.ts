import { endOfDay, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const access = await requireRole("INSPECTOR");
  if (access.error) return access.error;
  const date = new URL(request.url).searchParams.get("fecha");
  const day = date ? new Date(`${date}T12:00:00`) : new Date();
  const inspecciones = await getPrisma().inspeccion.findMany({
    where: {
      resultado: "PENDIENTE",
      fechaProgramada: { gte: startOfDay(day), lte: endOfDay(day) }
    },
    orderBy: { fechaProgramada: "asc" },
    include: { tramite: { include: { negocio: true } } },
  });
  return NextResponse.json(inspecciones, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}
