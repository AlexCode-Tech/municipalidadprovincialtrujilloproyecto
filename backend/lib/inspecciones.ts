// ====================================================================================
// ARCHIVO: lib/inspecciones.ts
// COMPONENTE: Algoritmo de programación automática de Inspecciones Técnicas de Seguridad (ITSE)
// JORNADA LABORAL: Lunes a Viernes de 7:00 a. m. a 3:00 p. m.
// BLOQUES ÚTILES EN TERRENO: 8:30 a. m. a 2:30 p. m. (Intervalos de 1h30m para desplazamientos por Trujillo)
// ====================================================================================

import "server-only";
import { addDays, endOfDay, getDay, setHours, setMinutes, startOfDay } from "date-fns";
import { getPrisma } from "./prisma";

/**
 * BLOQUES HORARIOS ÚTILES (8:30 a. m. - 2:30 p. m.)
 * Otorga al inspector 1.5 hrs al inicio de jornada (7:00-8:30 am) para revisión de expedientes,
 * y 30 mins al final (2:30-3:00 pm) para retorno a sede y cierre de actas.
 */
const BLOQUES_HORARIOS_UTILES = [
  { hora: 8, minuto: 30 },  // Bloque 1: 08:30 a. m.
  { hora: 10, minuto: 0 },  // Bloque 2: 10:00 a. m.
  { hora: 11, minuto: 30 }, // Bloque 3: 11:30 a. m.
  { hora: 13, minuto: 0 },  // Bloque 4: 01:00 p. m.
  { hora: 14, minuto: 30 }, // Bloque 5: 02:30 p. m.
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

  // 2. Determinar la fecha inicial de programación (Lunes a Viernes)
  let diaEvaluado = new Date();

  // Si cae en Sábado (6) o Domingo (0), avanzar al Lunes hábil
  while (getDay(diaEvaluado) === 0 || getDay(diaEvaluado) === 6) {
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  // 3. Buscar el primer bloque disponible dentro de la jornada laboral útil
  for (let intento = 0; intento < 60; intento += 1) {
    const diaSemana = getDay(diaEvaluado);

    // Excluir fines de semana (Lunes a Viernes únicamente)
    if (diaSemana !== 0 && diaSemana !== 6) {
      const inicio = startOfDay(diaEvaluado);
      const fin = endOfDay(diaEvaluado);

      const inspeccionesExistentes = await prisma.inspeccion.count({
        where: {
          fechaProgramada: { gte: inicio, lte: fin }
        }
      });

      // Si quedan bloques libres en el día (máximo 5 visitas por día)
      if (inspeccionesExistentes < BLOQUES_HORARIOS_UTILES.length) {
        const bloque = BLOQUES_HORARIOS_UTILES[inspeccionesExistentes];
        const fechaProgramada = setMinutes(setHours(diaEvaluado, bloque.hora), bloque.minuto);

        return prisma.inspeccion.create({
          data: {
            tramiteId,
            inspectorId: inspector.id,
            numeroVisita: 1,
            fechaProgramada,
            resultado: "PENDIENTE"
          }
        });
      }
    }

    // Si el día está lleno, avanzar al siguiente día laboral
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  throw new Error("No hay bloques horarios disponibles en la agenda del inspector");
}
