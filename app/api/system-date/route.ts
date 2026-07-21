import { NextRequest, NextResponse } from "next/server";
import { getSystemDate } from "@/lib/system-date";

export async function GET() {
  const date = await getSystemDate();
  return NextResponse.json({
    date: date.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json();
    const response = NextResponse.json({ success: true });
    
    if (date) {
      // Registrar la fecha simulada base y el instante de tiempo real en que se configuró
      const val = `${new Date(date).toISOString()}|${Date.now()}`;
      response.cookies.set("x-system-date", val, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 año
        httpOnly: false, // Permitir acceso desde el cliente sincrónicamente
        sameSite: "lax",
      });
    } else {
      // Eliminar el override
      response.cookies.delete("x-system-date");
    }
    
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Error al configurar la fecha del sistema" }, { status: 500 });
  }
}
