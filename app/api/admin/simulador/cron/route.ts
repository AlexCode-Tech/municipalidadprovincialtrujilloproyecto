import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { getSystemDate } from "@/lib/system-date";
import { enviarCorreo } from "@/lib/email";
import { obtenerEmailReal } from "@/lib/notificaciones";

export async function POST(request: NextRequest) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;
  const prisma = getPrisma();
  const hoy = await getSystemDate();

  try {
    // Buscar licencias cuya fecha de vencimiento sea menor a la fecha simulada hoy
    // y cuyo trámite no esté registrado aún como VENCIDO
    const licenciasPorVencer = await prisma.licencia.findMany({
      where: {
        venceEn: { lt: hoy },
        tramite: {
          estado: { not: "VENCIDO" }
        }
      },
      include: {
        tramite: {
          include: {
            negocio: {
              include: { usuario: true }
            }
          }
        }
      }
    });

    let expiradosCount = 0;

    for (const lic of licenciasPorVencer) {
      // 1. Cambiar estado del trámite a VENCIDO
      await prisma.tramite.update({
        where: { id: lic.tramiteId },
        data: { estado: "VENCIDO" }
      });

      // 2. Notificar por correo electrónico al contribuyente
      const email = obtenerEmailReal(lic.tramite.negocio.usuario?.email);
      await enviarCorreo({
        to: email,
        subject: `⚠️ NOTIFICACIÓN DE VENCIMIENTO: Licencia Municipal N° ${lic.numero} ha Expirado`,
        text: `Estimado representante de ${lic.tramite.negocio.razonSocial},\n\nLe comunicamos que su Licencia de Funcionamiento N° ${lic.numero} ha vencido el ${new Date(lic.venceEn).toLocaleDateString("es-PE")}.\n\nPor favor, tramite su renovación a la brevedad.\n\nAtentamente,\nSubgerencia de Comercialización\nMunicipalidad Provincial de Trujillo`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #dc2626; margin-top: 0;">⚠️ Licencia de Funcionamiento Expirada</h2>
            <p>Estimado(a) representante de <strong>${lic.tramite.negocio.razonSocial}</strong>,</p>
            <p>Le notificamos que su <strong>Licencia de Funcionamiento N° ${lic.numero}</strong> ha expirado el <strong>${new Date(lic.venceEn).toLocaleDateString("es-PE")}</strong>.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 15px 0; color: #991b1b; font-weight: bold;">
              Su trámite ha sido marcado como VENCIDO. Debe realizar el proceso de renovación comercial para regularizar su situación.
            </div>
            <p>Para renovar, ingrese al portal MPT y solicite la renovación de su licencia (con o sin planos estructurales según corresponda).</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #64748b; text-align: center;">
              Subgerencia de Licencias y Comercialización<br/>Municipalidad Provincial de Trujillo
            </p>
          </div>
        `
      });

      expiradosCount++;
    }

    return NextResponse.json({ success: true, expiradosCount });
  } catch (error) {
    console.error("Error al ejecutar cron de vencimientos:", error);
    return NextResponse.json({ error: "Ocurrió un error al procesar el cron job" }, { status: 500 });
  }
}
