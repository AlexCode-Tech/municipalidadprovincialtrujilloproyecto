import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const passwordHash = await hash("demo123", 12);
  
  // 1. Administrador Único
  await prisma.usuario.upsert({
    where: { email: "admin@demo.pe" },
    update: { estado: "ACTIVO" },
    create: {
      nombre: "Administrador Único",
      email: "admin@demo.pe",
      passwordHash,
      rol: "ADMIN",
      estado: "ACTIVO"
    }
  });

  // 2. Cajero 1 (María Torres)
  await prisma.usuario.upsert({
    where: { email: "cajero@demo.pe" },
    update: { estado: "ACTIVO" },
    create: {
      nombre: "María Torres",
      email: "cajero@demo.pe",
      passwordHash,
      rol: "CAJERO",
      estado: "ACTIVO"
    }
  });

  // 3. Cajero 2 (Juan Carlos)
  await prisma.usuario.upsert({
    where: { email: "cajero2@demo.pe" },
    update: { estado: "ACTIVO" },
    create: {
      nombre: "Juan Carlos",
      email: "cajero2@demo.pe",
      passwordHash,
      rol: "CAJERO",
      estado: "ACTIVO"
    }
  });

  // 4. Inspector Técnico (Carlos Mendoza)
  await prisma.usuario.upsert({
    where: { email: "inspector@demo.pe" },
    update: { estado: "ACTIVO" },
    create: {
      nombre: "Carlos Mendoza",
      email: "inspector@demo.pe",
      passwordHash,
      rol: "INSPECTOR",
      estado: "ACTIVO"
    }
  });

  console.log("Semilla ejecutada con éxito. Usuarios predeterminados creados.");
}
main().finally(() => prisma.$disconnect());
