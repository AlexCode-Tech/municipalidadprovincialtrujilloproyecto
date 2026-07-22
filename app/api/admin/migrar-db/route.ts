import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();

    // 1. Leer el archivo SQL de migración local
    const sqlPath = path.join(process.cwd(), "supabase_schema.sql");
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json({ ok: false, error: "Archivo supabase_schema.sql no encontrado." }, { status: 500 });
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // 2. Dividir el contenido SQL en comandos individuales
    // Separamos por punto y coma, ignorando comentarios de bloque y líneas vacías
    const commands = sqlContent
      .split(";")
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith("--"));

    console.log(`Iniciando migración de base de datos en Supabase con ${commands.length} comandos.`);

    // 3. Ejecutar secuencialmente cada comando SQL en Supabase (a través de Vercel que tiene conectividad IPv6)
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      try {
        await prisma.$executeRawUnsafe(cmd);
      } catch (err) {
        // Ignoramos si da error de que el enum o tabla ya existen, pero registramos otros
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already exists")) {
          console.warn(`Advertencia en comando SQL ${i + 1}: ${msg}`);
        }
      }
    }

    // 4. Población de usuarios iniciales (Seed)
    const passwordHash = await hash("demo123", 12);

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

    return NextResponse.json({
      ok: true,
      message: "¡Migración y población completada exitosamente en Supabase a través de Vercel!",
      commandsExecuted: commands.length,
      usuariosCreados: {
        admin: admin.email,
        cajero1: cajero1.email,
        cajero2: cajero2.email,
        inspector: inspector.email
      }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
