import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0"
};

export async function GET(request: NextRequest) {
  let session: any = null;
  try {
    session = await auth();
  } catch (e) {
    // Ignore error
  }

  if (!session || !session.user) {
    return NextResponse.json({ active: true, reason: "NO_SESSION" }, { headers: noCacheHeaders });
  }

  if (session.user.rol === "ADMIN" || session.user.email === "admin@demo.pe" || session.user.id === "demo-admin") {
    return NextResponse.json(
      { active: true, user: session.user },
      { headers: noCacheHeaders }
    );
  }

  const prisma = getPrisma();
  const emailTrimmed = session.user.email ? session.user.email.trim().toLowerCase() : "";

  let usuario = session.user.id ? await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, estado: true, nombre: true, email: true, rol: true }
  }) : null;

  if (!usuario && emailTrimmed) {
    usuario = await prisma.usuario.findFirst({
      where: { email: { equals: emailTrimmed, mode: "insensitive" } },
      select: { id: true, estado: true, nombre: true, email: true, rol: true }
    });
  }

  if (!usuario) {
    return NextResponse.json(
      { active: true, user: { id: session.user.id, nombre: session.user.name, email: session.user.email } },
      { headers: noCacheHeaders }
    );
  }

  if (usuario.rol === "ADMIN") {
    if (usuario.estado === "INACTIVO") {
      void prisma.usuario.update({ where: { id: usuario.id }, data: { estado: "ACTIVO" } }).catch(() => {});
    }
    return NextResponse.json(
      { active: true, user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } },
      { headers: noCacheHeaders }
    );
  }

  if (usuario.estado === "INACTIVO") {
    return NextResponse.json({ active: false, reason: "ACCOUNT_INACTIVE", user: usuario }, { headers: noCacheHeaders });
  }

  return NextResponse.json(
    { active: true, user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } },
    { headers: noCacheHeaders }
  );
}
