import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { crearPreferencia } from "@/lib/mercadopago";
import { z } from "zod";

const schema = z.object({ tramiteId: z.string().min(1) });

export async function POST(request: NextRequest) {
  console.log("Iniciando POST /api/pagos/preferencia");
  const access = await requireRole(request, "NEGOCIO", "CAJERO");
  if (access.error) {
    console.log("Error requireRole:", access.error);
    return access.error;
  }
  try {
    const body = await request.json();
    console.log("Body recibido:", body);
    const { tramiteId } = schema.parse(body);
    console.log("TramiteId parseado:", tramiteId);
    
    const canAccess = await canAccessTramite(access.session.user, tramiteId);
    console.log(`canAccessTramite para usuario ${access.session.user.id}:`, canAccess);
    
    if (!canAccess) {
      console.log("Acceso denegado a trámite");
      return forbidden();
    }
    
    console.log("Llamando a crearPreferencia con tramiteId:", tramiteId);
    const resultado = await crearPreferencia({
      tramiteId,
      titulo: "Licencia de Funcionamiento - Municipalidad Provincial de Trujillo",
      email: access.session.user.email ?? undefined,
    });
    console.log("Preferencia creada exitosamente:", resultado);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("ERROR DETALLADO EN PREFERENCIA:", error);
    return apiError(error, "No se pudo crear la preferencia de pago");
  }
}
