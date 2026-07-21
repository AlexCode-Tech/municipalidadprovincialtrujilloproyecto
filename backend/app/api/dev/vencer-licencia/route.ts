import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { notificarLicenciaVencida } from "@/lib/notificaciones";

export async function GET(request: NextRequest) {
  const ruc = request.nextUrl.searchParams.get("ruc");
  const numero = request.nextUrl.searchParams.get("numero");
  const prisma = getPrisma();

  let tramite: any = null;

  if (ruc) {
    const negocio = await prisma.negocio.findUnique({
      where: { ruc },
      include: {
        tramites: {
          orderBy: { creadoEn: "desc" },
          take: 1,
          include: { licencia: true, negocio: true }
        }
      }
    });

    if (!negocio || negocio.tramites.length === 0) {
      return NextResponse.json({ error: `No se encontró trámite para el RUC ${ruc}` }, { status: 404 });
    }
    tramite = negocio.tramites[0];
  } else if (numero) {
    const licencia = await prisma.licencia.findUnique({
      where: { numero },
      include: { tramite: { include: { negocio: true, licencia: true } } }
    });
    if (licencia) tramite = licencia.tramite;
  }

  if (!tramite) {
    // Buscar el último trámite registrado en la BD que tenga licencia o esté Aprobado
    tramite = await prisma.tramite.findFirst({
      orderBy: { creadoEn: "desc" },
      include: { negocio: true, licencia: true }
    });
  }

  if (!tramite) {
    return NextResponse.json({ error: "No hay trámites en la base de datos" }, { status: 404 });
  }

  // Si no tenía registro de licencia creado aún pero estaba APROBADO o en proceso, creamos el registro de licencia
  let licenciaId = tramite.licencia?.id;
  let numeroLicencia = tramite.licencia?.numero;

  if (!licenciaId) {
    const anoActual = new Date().getFullYear();
    const count = (await prisma.licencia.count()) + 1;
    numeroLicencia = `LF-MPT-${anoActual}-${String(count).padStart(6, "0")}`;
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const emitidaEn = new Date(ayer.getTime() - 365 * 24 * 60 * 60 * 1000);

    const nuevaLicencia = await prisma.licencia.create({
      data: {
        tramiteId: tramite.id,
        numero: numeroLicencia,
        emitidaEn,
        venceEn: ayer
      }
    });
    licenciaId = nuevaLicencia.id;
  }

  return vencer(licenciaId, tramite.id, numeroLicencia, tramite.negocio.ruc);
}

async function vencer(licenciaId: string, tramiteId: string, numero: string, ruc: string) {
  const prisma = getPrisma();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);

  // 1. Actualizar fecha de vencimiento en Licencia y estado VENCIDO en Trámite
  await prisma.licencia.update({
    where: { id: licenciaId },
    data: { venceEn: ayer }
  });

  await prisma.tramite.update({
    where: { id: tramiteId },
    data: { estado: "VENCIDO" }
  });

  // 2. Disparar notificaciones por correo y SMS
  const notificado = await notificarLicenciaVencida(licenciaId);

  const tramiteDb = await prisma.tramite.findUnique({
    where: { id: tramiteId },
    include: { negocio: { include: { usuario: true } } }
  });

  return NextResponse.json({
    success: true,
    ruc,
    licenciaId,
    numero,
    estado: "VENCIDO",
    venceEn: ayer.toISOString(),
    telefonoGuardado: tramiteDb?.negocio.telefono,
    emailGuardado: tramiteDb?.negocio.usuario?.email,
    notificado
  });
}

