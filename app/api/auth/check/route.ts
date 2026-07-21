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
    // Ignore error reading cookies
  }

  if (!session || !session.user) {
    // Si no hay una sesión activa, el usuario no debe ser marcado con pantalla de desactivado
    return NextResponse.json({ active: true, reason: "NO_SESSION" }, { headers: noCacheHeaders });
  }

  // Cuentas administradoras siempre permanecen activas
  if (session.user.rol === "ADMIN" || session.user.email === "admin@demo.pe" || session.user.id === "demo-admin") {
    return NextResponse.json(
      { active: true, user: session.user },
      { headers: noCacheHeaders }
    );
  }

  const prisma = getPrisma();
  const emailTrimmed = session.user.email ? session.user.email.trim().toLowerCase() : "";

  // Buscar primero por ID exacto si está disponible
  let usuario = session.user.id ? await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, estado: true, nombre: true, email: true, rol: true }
  }) : null;

  // Si no se encuentra por ID, buscar por correo electrónico
  if (!usuario && emailTrimmed) {
    usuario = await prisma.usuario.findFirst({
      where: { email: { equals: emailTrimmed, mode: "insensitive" } },
      select: { id: true, estado: true, nombre: true, email: true, rol: true }
    });
  }

  // Si la cuenta no existe en la BD o es demo, se considera activa por defecto
  if (!usuario) {
    return NextResponse.json(
      { active: true, user: { id: session.user.id, nombre: session.user.name, email: session.user.email } },
      { headers: noCacheHeaders }
    );
  }

  // Si es un administrador en BD, asegurar que permanezca activo
  if (usuario.rol === "ADMIN") {
    if (usuario.estado === "INACTIVO") {
      void prisma.usuario.update({ where: { id: usuario.id }, data: { estado: "ACTIVO" } }).catch(() => {});
    }
    return NextResponse.json(
      { active: true, user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } },
      { headers: noCacheHeaders }
    );
  }

  // La ÚNICA condición para bloquear la pantalla es que el Administrador haya marcado el estado como "INACTIVO" en la BD
  if (usuario.estado === "INACTIVO") {
    return NextResponse.json({ active: false, reason: "ACCOUNT_INACTIVE", user: usuario }, { headers: noCacheHeaders });
  }

  return NextResponse.json(
    { active: true, user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } },
    { headers: noCacheHeaders }
  );
}
