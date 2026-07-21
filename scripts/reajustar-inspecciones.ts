import { getPrisma } from "../lib/prisma";
import { setHours, setMinutes, startOfDay, endOfDay } from "date-fns";

async function main() {
  const prisma = getPrisma();
  const hoy = new Date();
  const inicio = startOfDay(hoy);
  const fin = endOfDay(hoy);

  const inspecciones = await prisma.inspeccion.findMany({
    where: {
      resultado: "PENDIENTE",
      fechaProgramada: { gte: inicio, lte: fin }
    },
    orderBy: { creadoEn: "asc" }
  });

  const bloques = [
    { hora: 8, minuto: 30 },
    { hora: 10, minuto: 0 },
    { hora: 11, minuto: 30 },
    { hora: 13, minuto: 0 },
    { hora: 14, minuto: 30 },
  ];

  for (let i = 0; i < inspecciones.length; i++) {
    const insp = inspecciones[i];
    const bloque = bloques[i % bloques.length];
    const nuevaFecha = setMinutes(setHours(hoy, bloque.hora), bloque.minuto);
    await prisma.inspeccion.update({
      where: { id: insp.id },
      data: { fechaProgramada: nuevaFecha }
    });
    console.log(`Inspección ${insp.id} actualizada a las ${bloque.hora}:${bloque.minuto === 0 ? "00" : bloque.minuto}`);
  }
}

main().catch(console.error);
