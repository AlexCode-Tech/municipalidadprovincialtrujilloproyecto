import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Añadiendo columnas de vuelto a la tabla Pago en Supabase...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Pago" 
    ADD COLUMN IF NOT EXISTS "vueltoTotal" DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "vueltoEfectivo" DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "vueltoYape" DECIMAL(10,2) DEFAULT 0;
  `);
  console.log("Columnas 'vueltoTotal', 'vueltoEfectivo' y 'vueltoYape' creadas con éxito.");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error al actualizar tabla Pago:", err);
  process.exit(1);
});
