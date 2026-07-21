import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

const schema = z.object({ nombre: z.string().min(3), email: z.email(), password: z.string().min(8), rol: z.enum(["CAJERO", "INSPECTOR"]) });
export async function GET() {
  const access = await requireRole("CAJERO");
  if (access.error) return access.error;
  return NextResponse.json(await getPrisma().usuario.findMany({ where: { rol: { in: ["CAJERO", "INSPECTOR"] } }, select: { id: true, nombre: true, email: true, rol: true } }));
}
export async function POST(request: Request) {
  const access = await requireRole("CAJERO");
  if (access.error) return access.error;
  try { const input = schema.parse(await request.json()); const { password, ...profile } = input; const user = await getPrisma().usuario.create({ data: { ...profile, passwordHash: await hash(password, 12) } }); return NextResponse.json({ id: user.id }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
