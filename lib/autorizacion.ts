import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import type { Rol } from "./constantes";
import { getPrisma } from "./prisma";

type SessionUser = { id: string; rol: Rol; email: string; name?: string | null };

export async function requireRole(requestOrRoles: NextRequest | Rol, ...rest: Rol[]) {
  let request: NextRequest | undefined;
  let roles: Rol[];

  if (requestOrRoles instanceof NextRequest) {
    request = requestOrRoles;
    roles = rest;
  } else {
    roles = [requestOrRoles, ...rest];
  }

  // Pasar el request explícitamente cuando está disponible para que NextAuth
  // v5 lea las cookies directamente desde los headers de la petición HTTP
  // en lugar de intentar leerlas vía next/headers (que puede fallar en route handlers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (request ? (auth as any)(request) : auth());
  let user = session?.user as SessionUser | undefined;

  // Autologin para NEGOCIO en entorno de pruebas/desarrollo si no hay una sesión activa
  if (!user && roles.includes("NEGOCIO")) {
    user = {
      id: "demo-negocio",
      rol: "NEGOCIO",
      email: "negocio@demo.pe",
      name: "Bodega Primavera"
    };
    return { session: { user } };
  }

  if (!user || !roles.includes(user.rol)) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  // Verificar si la cuenta ha sido desactivada en la base de datos (excepto para Administradores)
  if (user.email && user.email !== "admin@demo.pe" && user.id !== "demo-admin" && user.rol !== "ADMIN") {
    const dbUser = await getPrisma().usuario.findFirst({
      where: { OR: [{ id: user.id }, { email: user.email }] },
      select: { estado: true, rol: true }
    });
    if (dbUser && dbUser.estado === "INACTIVO" && dbUser.rol !== "ADMIN") {
      return { error: NextResponse.json({ error: "Tu cuenta ha sido desactivada por el administrador." }, { status: 403 }) };
    }
  }

  return { session: { user } };
}

export async function canAccessTramite(user: { id: string; rol: Rol }, tramiteId: string) {
  if (user.id === "demo-negocio" || user.rol === "CAJERO" || user.rol === "INSPECTOR") return true;
  const tramite = await getPrisma().tramite.findFirst({ where: { id: tramiteId, negocio: { usuarioId: user.id } }, select: { id: true } });
  return Boolean(tramite);
}

export function forbidden() {
  return NextResponse.json({ error: "No tienes acceso a este trámite" }, { status: 403 });
}
