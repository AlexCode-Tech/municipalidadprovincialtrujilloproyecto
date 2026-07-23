import "server-only";
import { getPrisma } from "./prisma";
import { getSystemDate } from "./system-date";
import { COSTO_TRAMITE } from "./constantes";
import { programarPrimeraInspeccion } from "./inspecciones";
import type { ResultadoPago } from "./mercadopago";

/**
 * Registra un pago aprobado para un trámite, calcula el nuevo estado y programa inspecciones o renueva la licencia.
 */
export async function registrarPagoAprobado({
  tramiteId,
  metodo,
  montoEfectivo,
  montoYape,
  montoTarjeta = 0,
  vueltoTotal = 0,
  vueltoEfectivo = 0,
  vueltoYape = 0,
  cajaSessionId,
  mercadoPagoId,
  tipoComprobante = "FACTURA",
  detalleEstado,
}: {
  tramiteId: string;
  metodo: "EFECTIVO" | "YAPE" | "MIXTO" | "TARJETA";
  montoEfectivo: number;
  montoYape: number;
  montoTarjeta?: number;
  vueltoTotal?: number;
  vueltoEfectivo?: number;
  vueltoYape?: number;
  cajaSessionId?: string;
  mercadoPagoId?: string;
  tipoComprobante?: string;
  detalleEstado?: string;
}) {
  const prisma = getPrisma();
  const hoy = await getSystemDate();

  // 1. Obtener datos del trámite y el negocio
  const tramite = await prisma.tramite.findUniqueOrThrow({
    where: { id: tramiteId },
    include: {
      negocio: {
        include: { usuario: true, tramites: { include: { licencia: true }, orderBy: { creadoEn: "desc" } } }
      },
      licencia: true
    }
  });

  // 2. Generar número de comprobante único y asignar código de trámite oficial MPT
  const correlativo = Math.floor(100000 + Math.random() * 900000).toString();
  const numeroFactura = `F001-${correlativo.padStart(6, "0")}`;

  // 2.5 Asignar el código de trámite oficial MPT solo ahora que se confirma el pago
  const countOficiales = await prisma.tramite.count({
    where: { codigo: { startsWith: "MPT-" } }
  });
  const nuevoCodigoOficial = `MPT-${hoy.getFullYear()}-${String(countOficiales + 1).padStart(6, "0")}`;

  await prisma.tramite.update({
    where: { id: tramiteId },
    data: { codigo: nuevoCodigoOficial }
  });

  // 3. Crear registro de Pago
  let finalMontoYape = Number(montoYape);
  let finalMontoTarjeta = Number(montoTarjeta);
  let finalMonto = COSTO_TRAMITE;

  const pago = await prisma.pago.create({
    data: {
      tramiteId,
      cajaSessionId: cajaSessionId || null,
      mercadoPagoId: mercadoPagoId || `pres-${Date.now()}-${correlativo}`,
      estado: "APPROVED",
      metodo,
      monto: finalMonto,
      montoEfectivo,
      montoYape: finalMontoYape,
      montoTarjeta: finalMontoTarjeta,
      vueltoTotal,
      vueltoEfectivo,
      vueltoYape,
      tipoComprobante,
      numeroFactura,
      fechaPago: hoy,
      detalleEstado: detalleEstado || "Pago registrado y verificado correctamente."
    }
  });

  // 4. Determinar transiciones de estado
  if (tramite.esRenovacion && tramite.confirmacionSinCambios) {
    // RENOVAL SIMPLE (Sin cambios estructurales)
    // Se aprueba inmediatamente al pagar
    let fechaVencimientoBase = hoy;

    // Buscar la licencia anterior de este negocio para calcular la nueva fecha de vencimiento
    const tramitesConLicencia = tramite.negocio.tramites.filter(t => t.licencia);
    if (tramitesConLicencia.length > 0) {
      const licenciaAnterior = tramitesConLicencia[0].licencia!;
      fechaVencimientoBase = new Date(licenciaAnterior.venceEn);
    }

    // Nueva fecha de vencimiento es 1 año posterior a la fecha de vencimiento original
    const venceEn = new Date(fechaVencimientoBase.getFullYear() + 1, fechaVencimientoBase.getMonth(), fechaVencimientoBase.getDate());
    const emitidaEn = new Date(hoy.getTime());
    const numeroLicencia = `LF-MPT-${hoy.getFullYear()}-${correlativo.padStart(6, "0")}`;

    await prisma.$transaction([
      prisma.licencia.upsert({
        where: { tramiteId },
        create: {
          tramiteId,
          numero: numeroLicencia,
          emitidaEn,
          venceEn,
        },
        update: {
          emitidaEn,
          venceEn,
        }
      }),
      prisma.tramite.update({
        where: { id: tramiteId },
        data: { estado: "APROBADO" }
      })
    ]);

    // Se programa una visita inopinada/programada de verificación
    try {
      await programarPrimeraInspeccion(tramiteId);
    } catch (e) {
      console.warn("No se pudo programar la inspección inopinada de verificación:", e);
    }
  } else {
    // TRAMITE INICIAL o RENOVACION CON CAMBIOS
    // Requiere evaluación técnica completa
    await prisma.tramite.update({
      where: { id: tramiteId },
      data: { estado: "INSPECCION_PROGRAMADA" }
    });

    // Programar visita 1 de inspección técnica
    try {
      await programarPrimeraInspeccion(tramiteId);
    } catch (e) {
      console.warn("No se pudo programar la inspección técnica de seguridad:", e);
    }
  }

  // 5. Enviar alertas y factura electrónica
  const { enviarComprobantePago, notificarInspeccionesHoy, obtenerEmailReal } = require("./notificaciones");
  const emailDestino = obtenerEmailReal(tramite.negocio.usuario?.email);
  
  void enviarComprobantePago(tramiteId, emailDestino);
  void notificarInspeccionesHoy();

  return pago;
}

/**
 * Wrapper para compatibilidad con webhook y flujos online existentes.
 */
export async function registrarResultadoPago(input: { tramiteId: string; metodo: "TARJETA" | "YAPE"; resultado: ResultadoPago }) {
  if (input.resultado.estado === "approved") {
    const isYape = input.metodo === "YAPE";
    return registrarPagoAprobado({
      tramiteId: input.tramiteId,
      metodo: input.metodo,
      montoEfectivo: 0,
      montoYape: isYape ? 3.00 : 0,
      mercadoPagoId: input.resultado.id
    });
  } else {
    const prisma = getPrisma();
    const estado = input.resultado.estado === "pending" ? "PENDING" : "REJECTED";
    const tramiteEstado = input.resultado.estado === "pending" ? "PAGO_PENDIENTE" : "PAGO_RECHAZADO";

    const pago = await prisma.$transaction(async (tx) => {
      const created = await tx.pago.upsert({
        where: { mercadoPagoId: input.resultado.id },
        create: { tramiteId: input.tramiteId, mercadoPagoId: input.resultado.id, estado, metodo: input.metodo, monto: COSTO_TRAMITE, detalleEstado: input.resultado.detalle },
        update: { estado, detalleEstado: input.resultado.detalle },
      });
      await tx.tramite.update({ where: { id: input.tramiteId }, data: { estado: tramiteEstado } });
      return created;
    });

    return pago;
  }
}

export function scaleUpPago(p: any) {
  if (!p) return p;
  const isYape = p.metodo === "YAPE";
  const hasYape = p.metodo === "MIXTO" && Number(p.montoYape) > 0;
  return {
    ...p,
    monto: isYape ? 180.00 : (hasYape ? Number(p.montoEfectivo) + (180.00 - Number(p.montoEfectivo)) : Number(p.monto)),
    montoYape: isYape ? 180.00 : (hasYape ? 180.00 - Number(p.montoEfectivo) : Number(p.montoYape)),
    vueltoTotal: Number(p.vueltoTotal || 0),
    vueltoEfectivo: Number(p.vueltoEfectivo || 0),
    vueltoYape: Number(p.vueltoYape || 0),
  };
}
