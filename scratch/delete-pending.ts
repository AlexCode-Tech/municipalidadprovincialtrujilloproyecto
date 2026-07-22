import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Eliminando solicitudes pendientes y SOL-2026-000001...");

  const tramitesAEliminar = await prisma.tramite.findMany({
    where: {
      OR: [
        { estado: "BORRADOR" },
        { estado: "PAGO_PENDIENTE" },
        { codigo: "SOL-2026-000001" }
      ],
      pagos: { none: { estado: "APPROVED" } }
    },
    select: { id: true, codigo: true }
  });

  console.log("Trámites encontrados:", tramitesAEliminar);

  if (tramitesAEliminar.length > 0) {
    const ids = tramitesAEliminar.map(t => t.id);
    await prisma.inspeccion.deleteMany({ where: { tramiteId: { in: ids } } });
    await prisma.pago.deleteMany({ where: { tramiteId: { in: ids } } });
    await prisma.licencia.deleteMany({ where: { tramiteId: { in: ids } } });
    const res = await prisma.tramite.deleteMany({ where: { id: { in: ids } } });
    console.log("Trámites eliminados con éxito:", res.count);
  } else {
    console.log("No se encontraron trámites pendientes.");
  }
}

main()
  .catch((e) => console.error("Error al eliminar trámites:", e))
  .finally(() => prisma.$disconnect());
