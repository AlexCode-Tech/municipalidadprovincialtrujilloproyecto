import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { registrarPagoAprobado } from "@/lib/registrar-pago";
import { COSTO_TRAMITE } from "@/lib/constantes";

async function resolveUsuario(prisma: any, user: { id: string; email?: string | null; name?: string | null; rol: any }) {
  if (!user.email) return null;
  return prisma.usuario.findFirst({
    where: {
      OR: [
        { email: user.email },
        { id: user.id }
      ]
    }
  });
}

export async function POST(request: NextRequest) {
  const access = await requireRole(request, "CAJERO");
  if (access.error) return access.error;
  const user = access.session.user;
  const prisma = getPrisma();

  try {
    const { tramiteId, metodo, montoEfectivo, montoYape, vueltoTotal, vueltoEfectivo, vueltoYape } = await request.json();

    if (!tramiteId || !metodo) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    const eff = parseFloat(montoEfectivo || 0);
    const yap = parseFloat(montoYape || 0);
    const vTot = parseFloat(vueltoTotal || 0);
    const vEff = parseFloat(vueltoEfectivo || 0);
    const vYap = parseFloat(vueltoYape || 0);

    const totalRecibido = Math.round((eff + yap) * 100) / 100;
    if (totalRecibido < COSTO_TRAMITE) {
      return NextResponse.json({ error: `El dinero recibido (S/ ${totalRecibido.toFixed(2)}) debe ser al menos el costo del trámite (S/ ${COSTO_TRAMITE}.00)` }, { status: 400 });
    }

    const dbUser = await resolveUsuario(prisma, user);
    if (!dbUser) {
      return NextResponse.json({ error: "Usuario cajero no registrado en la base de datos." }, { status: 400 });
    }

    // 1. Validar que la caja del cajero esté ABIERTA
    const sessionActiva = await prisma.cajaSession.findFirst({
      where: { cajeroId: dbUser.id, estado: "ABIERTA" }
    });

    if (!sessionActiva) {
      return NextResponse.json({ error: "Debes iniciar tu turno de caja (Aperturar Caja) antes de registrar un cobro presencial." }, { status: 400 });
    }

    // 2. Registrar el pago aprobado y desencadenar flujos
    const pago = await registrarPagoAprobado({
      tramiteId,
      metodo,
      montoEfectivo: eff,
      montoYape: yap,
      vueltoTotal: vTot,
      vueltoEfectivo: vEff,
      vueltoYape: vYap,
      cajaSessionId: sessionActiva.id
    });

    return NextResponse.json({ success: true, pagoId: pago.id });
  } catch (error) {
    console.error("Error al procesar cobro en caja:", error);
    return NextResponse.json({ error: "No se pudo registrar el pago presencial." }, { status: 500 });
  }
}
