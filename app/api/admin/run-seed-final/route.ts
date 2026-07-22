import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

async function runSeed() {
  const prisma = getPrisma();
  const passwordHash = await hash("demo123", 12);

  // 1. Administrador Único
  const admin = await prisma.usuario.upsert({
    where: { email: "alexpsm2005@gmail.com" },
    update: { estado: "ACTIVO", rol: "ADMIN" },
    create: {
      nombre: "Administrador Único",
      email: "alexpsm2005@gmail.com",
      passwordHash,
      rol: "ADMIN",
      estado: "ACTIVO"
    }
  });

  // 2. Cajero 1 (María Torres)
  const cajero1 = await prisma.usuario.upsert({
    where: { email: "cajero@demo.pe" },
    update: { estado: "ACTIVO", rol: "CAJERO" },
    create: {
      nombre: "María Torres",
      email: "cajero@demo.pe",
      passwordHash,
      rol: "CAJERO",
      estado: "ACTIVO"
    }
  });

  // 3. Cajero 2 (Juan Carlos)
  const cajero2 = await prisma.usuario.upsert({
    where: { email: "cajero2@demo.pe" },
    update: { estado: "ACTIVO", rol: "CAJERO" },
    create: {
      nombre: "Juan Carlos",
      email: "cajero2@demo.pe",
      passwordHash,
      rol: "CAJERO",
      estado: "ACTIVO"
    }
  });

  // 4. Inspector Técnico (Carlos Mendoza)
  const inspector = await prisma.usuario.upsert({
    where: { email: "inspector@demo.pe" },
    update: { estado: "ACTIVO", rol: "INSPECTOR" },
    create: {
      nombre: "Carlos Mendoza",
      email: "inspector@demo.pe",
      passwordHash,
      rol: "INSPECTOR",
      estado: "ACTIVO"
    }
  });

  return {
    admin: admin.email,
    cajero1: cajero1.email,
    cajero2: cajero2.email,
    inspector: inspector.email
  };
}

export async function GET() {
  try {
    const res = await runSeed();
    return NextResponse.json({
      ok: true,
      message: "Base de datos (Supabase) actualizada y poblada con los usuarios de semilla.",
      usuarios: res
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const res = await runSeed();
    return NextResponse.json({
      ok: true,
      message: "Base de datos (Supabase) actualizada y poblada con los usuarios de semilla.",
      usuarios: res
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
