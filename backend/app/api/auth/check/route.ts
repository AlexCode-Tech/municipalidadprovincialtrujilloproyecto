import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  "Pragma": "no-cache",
  "Expires": "0"
};

export async function GET(request: NextRequest) {
  let session: any = null;
  try {
    session = await (auth as any)(request);
  } catch (e) {
    // Ignore error
  }

  if (!session) {
    try {
      session = await auth();
    } catch (e) {
      // Ignore
    }
  }

  const { searchParams } = new URL(request.url);
  const paramEmail = searchParams.get("email")?.trim().toLowerCase();
  const paramUserId = searchParams.get("userId")?.trim();

  const userEmail = session?.user?.email ? session.user.email.trim().toLowerCase() : paramEmail ?? "";
  const userId = session?.user?.id ? session.user.id.trim() : paramUserId ?? "";
  const userRol = session?.user?.rol;

  if (
    userRol === "ADMIN" ||
    userEmail === "alexpsm2005@gmail.com" ||
    userEmail === "admin@demo.pe" ||
    userId === "demo-admin"
  ) {
    return NextResponse.json({ active: true, user: session?.user }, { headers: noCacheHeaders });
  }

  if (!userEmail && !userId) {
    return NextResponse.json({ active: true, reason: "NO_IDENTIFIER" }, { headers: noCacheHeaders });
  }

  const prisma = getPrisma();

  let usuario = null;

  if (userId && !userId.startsWith("demo-")) {
    usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, estado: true, nombre: true, email: true, rol: true }
    });
  }

  if (!usuario && userEmail) {
    usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: { equals: userEmail, mode: "insensitive" } },
          { email: { equals: `${userEmail.split("@")[0]}@demo.pe`, mode: "insensitive" } }
        ]
      },
      select: { id: true, estado: true, nombre: true, email: true, rol: true }
    });
  }

  if (!usuario && userRol) {
    const demoEmail = userRol === "CAJERO" ? "cajero@demo.pe" : userRol === "INSPECTOR" ? "inspector@demo.pe" : userRol === "NEGOCIO" ? "negocio@demo.pe" : null;
    if (demoEmail) {
      usuario = await prisma.usuario.findFirst({
        where: { email: { equals: demoEmail, mode: "insensitive" } },
        select: { id: true, estado: true, nombre: true, email: true, rol: true }
      });
    }
  }

  if (!usuario) {
    return NextResponse.json({ active: true, reason: "NOT_IN_DB" }, { headers: noCacheHeaders });
  }

  if (usuario.rol === "ADMIN") {
    return NextResponse.json({ active: true, user: usuario }, { headers: noCacheHeaders });
  }

  if (usuario.estado === "INACTIVO") {
    return NextResponse.json({ active: false, reason: "ACCOUNT_INACTIVE", user: usuario }, { headers: noCacheHeaders });
  }

  return NextResponse.json({ active: true, user: usuario }, { headers: noCacheHeaders });
}

