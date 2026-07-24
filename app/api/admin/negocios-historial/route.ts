import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const access = await requireRole(request, "ADMIN");
    if (access.error) return access.error;

    const prisma = getPrisma();

    // Obtener trámites con su historial de eventos
    const tramites = await prisma.tramite.findMany({
      include: {
        negocio: {
          select: {
            id: true,
            ruc: true,
            razonSocial: true,
            domicilioFiscal: true,
            usuario: {
              select: {
                nombre: true,
                email: true,
              },
            },
          },
        },
        licencia: true,
        pagos: {
          orderBy: { fechaPago: "desc" },
        },
        inspecciones: {
          orderBy: { creadoEn: "desc" },
        },
      },
      orderBy: { creadoEn: "desc" },
    });

    const historial: any[] = [];

    for (const t of tramites) {
      // 1. Registro inicial de la solicitud / sucursal
      historial.push({
        id: `reg-${t.id}`,
        fechaHora: t.creadoEn,
        negocioRuc: t.negocio.ruc,
        razonSocial: t.negocio.razonSocial,
        usuarioNombre: t.negocio.usuario?.nombre || "Contribuyente",
        usuarioEmail: t.negocio.usuario?.email || "—",
        codigoTramite: t.codigo,
        direccionSucursal: t.direccionTrujillo || t.negocio.domicilioFiscal,
        tipoModificacion: "Registro de Nueva Solicitud de Sucursal",
        descripcion: `Se registró la solicitud de licencia para la sucursal en ${t.direccionTrujillo || t.negocio.domicilioFiscal}`,
        planoUrl: t.planoUrl,
        estadoResultante: t.estado,
      });

      // 2. Si se modificó la fecha/hora o se emitió licencia
      if (t.licencia) {
        historial.push({
          id: `lic-${t.licencia.id}`,
          fechaHora: t.licencia.emitidaEn,
          negocioRuc: t.negocio.ruc,
          razonSocial: t.negocio.razonSocial,
          usuarioNombre: "Administrador / Sistema",
          usuarioEmail: "admin@trujillo.gob.pe",
          codigoTramite: t.codigo,
          direccionSucursal: t.direccionTrujillo || t.negocio.domicilioFiscal,
          tipoModificacion: "Emisión / Modificación de Fechas de Licencia",
          descripcion: `Licencia N° ${t.licencia.numero} configurada. Inicio: ${new Date(t.licencia.emitidaEn).toLocaleString("es-PE")} - Vence: ${new Date(t.licencia.venceEn).toLocaleString("es-PE")}`,
          planoUrl: t.planoUrl,
          estadoResultante: t.estado,
        });
      }

      // 3. Pagos registrados
      for (const p of t.pagos) {
        historial.push({
          id: `pago-${p.id}`,
          fechaHora: p.fechaPago,
          negocioRuc: t.negocio.ruc,
          razonSocial: t.negocio.razonSocial,
          usuarioNombre: t.negocio.usuario?.nombre || "Cajero MPT",
          usuarioEmail: t.negocio.usuario?.email || "caja@trujillo.gob.pe",
          codigoTramite: t.codigo,
          direccionSucursal: t.direccionTrujillo || t.negocio.domicilioFiscal,
          tipoModificacion: "Registro de Pago de Licencia",
          descripcion: `Cobro procesado por S/ ${p.monto.toFixed(2)} (${p.metodo}). Comprobante: ${p.numeroFactura || "Ticket de Caja"}`,
          planoUrl: t.planoUrl,
          estadoResultante: "APROBADO",
        });
      }

      // 4. Inspecciones registradas
      for (const insp of t.inspecciones) {
        historial.push({
          id: `insp-${insp.id}`,
          fechaHora: insp.creadoEn,
          negocioRuc: t.negocio.ruc,
          razonSocial: t.negocio.razonSocial,
          usuarioNombre: "Inspector Técnico MPT",
          usuarioEmail: "inspecciones@trujillo.gob.pe",
          codigoTramite: t.codigo,
          direccionSucursal: t.direccionTrujillo || t.negocio.domicilioFiscal,
          tipoModificacion: "Inspección Técnica de Seguridad",
          descripcion: `Inspección N° ${insp.numeroVisita} finalizada con resultado: ${insp.resultado}. ${insp.observaciones || ""}`,
          planoUrl: t.planoUrl,
          estadoResultante: insp.resultado,
        });
      }
    }

    // Ordenar historial completo de más reciente a más antiguo
    historial.sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime());

    return NextResponse.json(historial, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error al obtener historial de negocios:", error);
    return NextResponse.json(
      { error: "Error al obtener el historial de modificaciones." },
      { status: 500 }
    );
  }
}
