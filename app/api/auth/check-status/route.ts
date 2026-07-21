import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0"
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ status: "NOT_FOUND" }, { headers: noCacheHeaders });
  }

  try {
    const usuario = await getPrisma().usuario.findFirst({
      where: {
        OR: [
          { email },
          { email: `${email}@licencias.pe` }
        ]
      },
      select: { estado: true, rol: true }
    });

    if (!usuario) {
      return NextResponse.json({ status: "NOT_FOUND" }, { headers: noCacheHeaders });
    }

    if (usuario.rol === "ADMIN") {
      return NextResponse.json({ status: "ACTIVO", rol: usuario.rol }, { headers: noCacheHeaders });
    }

    return NextResponse.json({ status: usuario.estado, rol: usuario.rol }, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json({ status: "NOT_FOUND" }, { headers: noCacheHeaders });
  }
}
