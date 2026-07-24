import { NextRequest, NextResponse } from "next/server";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { generarFacturaPdf } from "@/lib/factura-pdf";
import { getSystemDate } from "@/lib/system-date";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ tramiteId: string }> }) {
  const { tramiteId } = await context.params;

  const access = await requireRole("NEGOCIO", "CAJERO", "INSPECTOR", "ADMIN");
  if (access.error) return access.error;

  const canAccess = await canAccessTramite(access.session.user, tramiteId);
  if (!canAccess && access.session.user.rol !== "ADMIN") return forbidden();

  const prisma = getPrisma();
  const tramite = await prisma.tramite.findUnique({
    where: { id: tramiteId },
    include: {
      negocio: true,
      pagos: {
        where: { estado: "APPROVED" },
        orderBy: { creadoEn: "desc" },
        take: 1
      }
    }
  });

  if (!tramite) {
    return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
  }

  const pago = tramite.pagos[0];
  let metodoPago = "Tarjeta de Débito / Crédito";
  if (pago) {
    if (pago.metodo === "YAPE") {
      metodoPago = "Yape / BCP QR";
    } else if (pago.metodo === "MIXTO") {
      const tarjeta = Number(pago.montoEfectivo || 0);
      const yape = Number(pago.montoYape || 0);
      metodoPago = `Pago Mixto (Tarjeta: S/ ${tarjeta.toFixed(2)} | Yape: S/ ${yape.toFixed(2)})`;
    } else {
      metodoPago = "Tarjeta de Débito / Crédito";
    }
  }

  const hoy = await getSystemDate();
  const fechaPago = pago ? new Date(pago.fechaPago || pago.creadoEn) : hoy;
  const fechaEmisionStr = `${String(fechaPago.getDate()).padStart(2, "0")}/${String(fechaPago.getMonth() + 1).padStart(2, "0")}/${fechaPago.getFullYear()}`;
  const fechaVenceObj = new Date(fechaPago.getFullYear() + 1, fechaPago.getMonth(), fechaPago.getDate());
  const fechaVencimientoStr = `${String(fechaVenceObj.getDate()).padStart(2, "0")}/${String(fechaVenceObj.getMonth() + 1).padStart(2, "0")}/${fechaVenceObj.getFullYear()}`;

  const numeroComprobante = pago?.numeroFactura || "F001-00000001";

  const pdfBuffer = await generarFacturaPdf({
    numeroComprobante,
    fechaEmision: fechaEmisionStr,
    fechaVencimiento: fechaVencimientoStr,
    metodoPago,
    razonSocial: tramite.negocio.razonSocial,
    ruc: tramite.negocio.ruc,
    domicilioFiscal: tramite.negocio.domicilioFiscal,
    direccionSucursal: tramite.direccionTrujillo || tramite.negocio.domicilioFiscal,
    codigoTramite: tramite.codigo,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=factura-${numeroComprobante}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
