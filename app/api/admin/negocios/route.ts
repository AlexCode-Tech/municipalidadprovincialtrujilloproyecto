import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;

  const negocios = await getPrisma().negocio.findMany({
    select: {
      id: true,
      ruc: true,
      razonSocial: true,
      domicilioFiscal: true,
      distrito: true,
      telefono: true,
      creadoEn: true,
      usuario: {
        select: {
          id: true,
          email: true,
          nombre: true,
          estado: true,
          creadoEn: true,
        },
      },
      tramites: {
        select: { id: true, estado: true },
        orderBy: { creadoEn: "desc" },
        take: 1,
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  return NextResponse.json(negocios);
}
