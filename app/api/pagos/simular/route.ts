import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/autorizacion";
import { enviarComprobantePago } from "@/lib/notificaciones";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const access = await requireRole(request, "NEGOCIO", "CAJERO");
    if (access.error) return access.error;

    const body = await request.json();
    const { tramiteId } = body;
    if (!tramiteId) {
      return NextResponse.json({ error: "Parámetro tramiteId requerido" }, { status: 400 });
    }

    const metodoInput: "TARJETA" | "YAPE" | "MIXTO" = body.metodo || "TARJETA";
    const montoTarjetaInput = parseFloat(body.montoTarjeta) || 0;
    const montoYapeInput = parseFloat(body.montoYape) || 0;
    const vueltoTotalInput = parseFloat(body.vueltoTotal) || 0;
    const vueltoEfectivoInput = parseFloat(body.vueltoEfectivo) || 0;
    const vueltoYapeInput = parseFloat(body.vueltoYape) || 0;

    const prisma = getPrisma();

    // 1. Buscar el trámite en la base de datos
    const tramite = await prisma.tramite.findUnique({
      where: { id: tramiteId },
      include: {
        negocio: {
          include: { usuario: true }
        },
        pagos: {
          where: { estado: "APPROVED" }
        }
      }
    });

    if (!tramite) {
      return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
    }

    // Verificar si ya fue pagado
    if (tramite.pagos.length > 0 || (tramite.estado !== "PAGO_PENDIENTE" && tramite.estado !== "BORRADOR" && tramite.estado !== "PENDIENTE_PAGO")) {
      return NextResponse.json(
        { error: "Este trámite ya cuenta con un pago registrado y aprobado previamente." },
        { status: 400 }
      );
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
      let montoEfectivo = 0;
      let montoYape = 0;
      let detalle = "";

      if (metodoInput === "MIXTO") {
        montoEfectivo = montoTarjetaInput || 100;
        montoYape = montoYapeInput || 80;
        if (vueltoTotalInput > 0) {
          detalle = `Pago Mixto (Recibido: Tarjeta/Efectivo S/ ${montoEfectivo.toFixed(2)}, Yape S/ ${montoYape.toFixed(2)} | Vuelto: S/ ${vueltoTotalInput.toFixed(2)} [Efectivo S/ ${vueltoEfectivoInput.toFixed(2)}, Yape S/ ${vueltoYapeInput.toFixed(2)}])`;
        } else {
          detalle = `Pago simulado Mixto (Tarjeta: S/ ${montoEfectivo.toFixed(2)} | Yape: S/ ${montoYape.toFixed(2)})`;
        }
      } else if (metodoInput === "YAPE") {
        montoYape = 180.00;
        montoEfectivo = 0;
        detalle = "Pago simulado con Yape / BCP QR";
      } else {
        montoEfectivo = 180.00;
        montoYape = 0;
        detalle = "Pago simulado con Tarjeta de Débito / Crédito";
      }

      // Generar correlativo autoincremental de 8 dígitos para la factura
      const { generarSiguienteCorrelativoFactura } = require("@/lib/registrar-pago");
      const numeroFactura = await generarSiguienteCorrelativoFactura(tx);

      // Registrar el pago simulado
      await tx.pago.create({
        data: {
          tramiteId,
          monto: 180.00,
          metodo: metodoInput,
          montoEfectivo,
          montoYape,
          vueltoTotal: vueltoTotalInput,
          vueltoEfectivo: vueltoEfectivoInput,
          vueltoYape: vueltoYapeInput,
          estado: "APPROVED",
          tipoComprobante: "FACTURA",
          numeroFactura,
          detalleEstado: detalle,
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
    const pagoFinal = await prisma.pago.findFirst({
      where: { tramiteId, estado: "APPROVED" },
      orderBy: { creadoEn: "desc" },
      select: { numeroFactura: true, id: true }
    });

    return NextResponse.json({ success: true, pagoId: pagoFinal?.id, numeroFactura: pagoFinal?.numeroFactura || "F001-00000001" });
  } catch (error) {
    console.error("Error al simular pago del trámite:", error);
    return NextResponse.json({ error: "No se pudo simular el pago del trámite." }, { status: 500 });
  }
}
