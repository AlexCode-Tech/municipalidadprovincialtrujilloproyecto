import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  nombre: z.string().min(3),
  email: z.email(),
  password: z.string().min(6),
  rol: z.enum(["CAJERO", "INSPECTOR"])
});

export async function GET(request: NextRequest) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;
  
  const usuarios = await getPrisma().usuario.findMany({
    where: { rol: { in: ["CAJERO", "INSPECTOR"] } },
    select: { id: true, nombre: true, email: true, rol: true, estado: true, creadoEn: true },
    orderBy: { creadoEn: "desc" }
  });
  
  return NextResponse.json(usuarios);
}

export async function POST(request: NextRequest) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;
  
  try {
    const input = schema.parse(await request.json());
    const prisma = getPrisma();

    // Validar límite total de cajeros (máximo 5)
    if (input.rol === "CAJERO") {
      const totalCajeros = await prisma.usuario.count({
        where: { rol: "CAJERO" }
      });
      if (totalCajeros >= 5) {
        return NextResponse.json({ error: "Límite superado. No se pueden registrar más de 5 cajeros en total." }, { status: 400 });
      }
    }

    // Verificar si el correo ya existe
    const existe = await prisma.usuario.findUnique({
      where: { email: input.email }
    });
    if (existe) {
      return NextResponse.json({ error: "El correo electrónico ya se encuentra registrado." }, { status: 400 });
    }

    const { password, ...profile } = input;
    const user = await prisma.usuario.create({
      data: {
        ...profile,
        passwordHash: await hash(password, 12),
        estado: "ACTIVO"
      }
    });

    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
