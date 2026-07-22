import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Actualizando enum EstadoCaja y tabla CajaSession en Supabase...");
  
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "EstadoCaja" ADD VALUE IF NOT EXISTS 'SOLICITADO_SENCILLO';
    `);
  } catch (e) {
    console.log("Enum EstadoCaja ya contiene SOLICITADO_SENCILLO");
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CajaSession" 
    ADD COLUMN IF NOT EXISTS "montoSolicitadoSencillo" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "estadoSencillo" TEXT,
    ADD COLUMN IF NOT EXISTS "motivoSencillo" TEXT;
  `);

  console.log("Campos de Solicitud de Sencillo añadidos con éxito.");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error al actualizar tabla CajaSession:", err);
  process.exit(1);
});
