import "server-only";
import { addDays, getDay, setHours, setMinutes, startOfDay, endOfDay } from "date-fns";
import { getPrisma } from "./prisma";
import { getSystemDate } from "./system-date";

/**
 * BLOQUES HORARIOS ÚTILES (7:00 a. m. - 7:50 p. m. / último bloque inicia a las 5:00 p. m.)
 * Cada inspección dura 2 horas. Los bloques pueden solaparse horariamente de forma independiente.
 */
export const BLOQUES_HORARIOS_UTILES = [
  { hora: 7, minuto: 0, label: "7:00 - 9:00 AM" },
  { hora: 8, minuto: 0, label: "8:00 - 10:00 AM" },
  { hora: 9, minuto: 0, label: "9:00 - 11:00 AM" },
  { hora: 10, minuto: 0, label: "10:00 AM - 12:00 PM" },
  { hora: 11, minuto: 0, label: "11:00 AM - 1:00 PM" },
  { hora: 12, minuto: 0, label: "12:00 - 2:00 PM" },
  { hora: 13, minuto: 0, label: "1:00 - 3:00 PM" },
  { hora: 14, minuto: 0, label: "2:00 - 4:00 PM" },
  { hora: 15, minuto: 0, label: "3:00 - 5:00 PM" },
  { hora: 16, minuto: 0, label: "4:00 - 6:00 PM" },
  { hora: 17, minuto: 0, label: "5:00 - 7:00 PM" },
];

export async function programarPrimeraInspeccion(tramiteId: string) {
  const prisma = getPrisma();
  
  // 1. Buscar o crear el inspector municipal predeterminado
  let inspector = await prisma.usuario.findFirst({
    where: { rol: "INSPECTOR" },
    orderBy: { creadoEn: "asc" }
  });

  if (!inspector) {
    inspector = await prisma.usuario.create({
      data: {
        nombre: "Carlos Mendoza",
        email: "inspector@licencias.pe",
        rol: "INSPECTOR",
        passwordHash: "demo-password-hash"
      }
    });
  }

  // 2. Determinar la fecha inicial de programación (Lunes a Sábado, Domingo es no hábil)
  const hoy = await getSystemDate();
  let diaEvaluado = new Date(hoy.getTime());

  // Verificar si la solicitud se procesa fuera del horario de oficina (7:00 AM - 7:50 PM)
  const horaActual = hoy.getHours();
  const minutoActual = hoy.getMinutes();
  const esFueraHorario = horaActual < 7 || horaActual > 19 || (horaActual === 19 && minutoActual > 50);

  if (esFueraHorario) {
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  // Si cae en Domingo (0), avanzar al Lunes hábil
  while (getDay(diaEvaluado) === 0) {
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  // 3. Buscar el primer bloque disponible dentro de la jornada laboral útil
  for (let intento = 0; intento < 60; intento += 1) {
    const diaSemana = getDay(diaEvaluado);

    // Solo excluir Domingo (0)
    if (diaSemana !== 0) {
      const inicio = startOfDay(diaEvaluado);
      const fin = endOfDay(diaEvaluado);

      // Buscar inspecciones ya programadas para ese inspector en el día evaluado
      const inspeccionesExistentes = await prisma.inspeccion.findMany({
        where: {
          inspectorId: inspector.id,
          fechaProgramada: { gte: inicio, lte: fin }
        }
      });

      // Si quedan bloques libres en el día (máximo 11 bloques útiles)
      if (inspeccionesExistentes.length < BLOQUES_HORARIOS_UTILES.length) {
        // Encontrar primer bloque que no esté ocupado
        const bloqueLibre = BLOQUES_HORARIOS_UTILES.find(bloque => {
          const horaBloque = setMinutes(setHours(diaEvaluado, bloque.hora), bloque.minuto);
          return !inspeccionesExistentes.some(ins => {
            const insTime = new Date(ins.fechaProgramada).getTime();
            return insTime === horaBloque.getTime();
          });
        });

        if (bloqueLibre) {
          const fechaProgramada = setMinutes(setHours(diaEvaluado, bloqueLibre.hora), bloqueLibre.minuto);

          return prisma.inspeccion.create({
            data: {
              tramiteId,
              inspectorId: inspector.id,
              numeroVisita: 1,
              fechaProgramada,
              bloqueHorario: bloqueLibre.label,
              resultado: "PENDIENTE"
            }
          });
        }
      }
    }

    // Si el día está lleno, avanzar al siguiente día
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  throw new Error("No hay bloques horarios disponibles en la agenda del inspector");
}
