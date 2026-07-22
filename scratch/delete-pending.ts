import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Eliminando RUC 20141878477 y trámites pendientes sin pagar...");

  const tramites = await prisma.tramite.findMany({
    where: {
      OR: [
        { negocio: { ruc: "20141878477" } },
        { estado: "BORRADOR" },
        { estado: "PAGO_PENDIENTE" },
        { estado: "PAGO_RECHAZADO" },
        { codigo: "SOL-2026-000001" }
      ],
      pagos: { none: { estado: "APPROVED" } }
    },
    select: { id: true, codigo: true, negocioId: true }
  });

  console.log("Trámites a eliminar:", tramites);

  if (tramites.length > 0) {
    const ids = tramites.map(t => t.id);
    await prisma.inspeccion.deleteMany({ where: { tramiteId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { tramiteId: { in: ids } } });
    await prisma.licencia.deleteMany({ where: { tramiteId: { in: ids } } });
    await prisma.tramite.deleteMany({ where: { id: { in: ids } } });
  }

  // Eliminar negocio RUC 20141878477 si no tiene trámites pagados
  const negocio = await prisma.negocio.findUnique({
    where: { ruc: "20141878477" },
    include: { tramites: true }
  });

  if (negocio && negocio.tramites.length === 0) {
    await prisma.negocio.delete({ where: { id: negocio.id } });
    console.log("Negocio RUC 20141878477 eliminado.");
  }
}

main()
  .catch((e) => console.error("Error:", e))
  .finally(() => prisma.$disconnect());
