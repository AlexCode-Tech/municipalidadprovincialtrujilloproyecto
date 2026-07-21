import { NextRequest, NextResponse } from "next/server";
import { notificarInspeccionesHoy } from "@/lib/notificaciones";
import { apiError } from "@/lib/api";

export async function GET(_request: NextRequest) {
  try {
    const resultado = await notificarInspeccionesHoy();
    return NextResponse.json({
      success: true,
      mensaje: "Proceso de notificaciones del día ejecutado con éxito.",
      ...resultado,
    });
  } catch (error) {
    return apiError(error, "Error al procesar las notificaciones de hoy.");
  }
}

export async function POST(_request: NextRequest) {
  try {
    const resultado = await notificarInspeccionesHoy();
    return NextResponse.json({
      success: true,
      mensaje: "Proceso de notificaciones del día ejecutado con éxito.",
      ...resultado,
    });
  } catch (error) {
    return apiError(error, "Error al procesar las notificaciones de hoy.");
  }
}
