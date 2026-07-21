import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/autorizacion";
import { enviarComprobantePago } from "@/lib/notificaciones";

export async function POST(request: NextRequest) {
  try {
    const access = await requireRole(request, "NEGOCIO", "CAJERO");
    if (access.error) return access.error;

    const { tramiteId } = await request.json();
    if (!tramiteId) {
      return NextResponse.json({ error: "Parámetro tramiteId requerido" }, { status: 400 });
    }

    const prisma = getPrisma();

    // 1. Buscar el trámite en la base de datos
    const tramite = await prisma.tramite.findUnique({
      where: { id: tramiteId },
      include: {
        negocio: {
          include: { usuario: true }
        }
      }
    });

    if (!tramite) {
      return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
    }

    // 2. Buscar un inspector válido para programar la inspección
    const inspector = await prisma.usuario.findFirst({
      where: { rol: "INSPECTOR" },
      select: { id: true }
    });

    if (!inspector) {
      return NextResponse.json({ error: "No se encontró ningún inspector registrado." }, { status: 500 });
    }

    // 3. Procesar simulación de pago en una transacción
    await prisma.$transaction(async (tx) => {
      // Registrar el pago simulado
      await tx.pago.create({
        data: {
          tramiteId,
          monto: 180.00,
          metodo: "TARJETA",
          estado: "APPROVED",
          detalleEstado: "Pago simulado por el usuario en desarrollo",
          mercadoPagoId: `sim-${Date.now()}`
        }
      });

      // Actualizar estado del trámite
      await tx.tramite.update({
        where: { id: tramiteId },
        data: { estado: "INSPECCION_PROGRAMADA" }
      });

      // Crear la inspección programada para hoy (para que el inspector la pueda gestionar de inmediato)
      const hoy = new Date();
      // Asignar hora de inspección (ej. 14:00 del día de hoy)
      const fechaInspeccion = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 14, 0, 0);

      // Eliminar inspecciones anteriores si las hubiese para evitar colisión de visita única
      await tx.inspeccion.deleteMany({
        where: { tramiteId }
      });

      await tx.inspeccion.create({
        data: {
          tramiteId,
          inspectorId: inspector.id,
          numeroVisita: 1,
          fechaProgramada: fechaInspeccion,
          resultado: "PENDIENTE"
        }
      });
    });

    // Enviar la factura electrónica por correo en segundo plano al email del contribuyente
    const emailDestino = tramite.negocio.usuario?.email || "aleeexpsm2005@gmail.com";
    void enviarComprobantePago(tramiteId, emailDestino);

    // Notificar por Correo y SMS al Inspector y al Negocio sobre la inspección de hoy
    const { notificarInspeccionesHoy } = require("@/lib/notificaciones");
    void notificarInspeccionesHoy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al simular pago del trámite:", error);
    return NextResponse.json({ error: "No se pudo simular el pago del trámite." }, { status: 500 });
  }
}
