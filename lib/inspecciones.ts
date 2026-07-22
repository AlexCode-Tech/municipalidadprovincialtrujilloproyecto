import "server-only";
import { addDays, getDay, startOfDay, endOfDay } from "date-fns";
import { getPrisma } from "./prisma";
import { getSystemDate } from "./system-date";

/**
 * BLOQUES HORARIOS ÚTILES (Jornada de 9:00 AM a 6:00 PM)
 * El inspector realiza hasta 4 inspecciones por día de 2 horas cada una.
 * Se define 1 hora libre de almuerzo entre la 1:00 PM y 2:00 PM.
 */
export const BLOQUES_HORARIOS_UTILES = [
  { hora: 9, minuto: 0, label: "9:00 - 11:00 AM" },
  { hora: 11, minuto: 0, label: "11:00 AM - 1:00 PM" },
  { hora: 14, minuto: 0, label: "2:00 - 4:00 PM" },
  { hora: 16, minuto: 0, label: "4:00 - 6:00 PM" },
];

function esFeriadoPeru(fecha: Date): boolean {
  const mes = fecha.getMonth() + 1; // 1-indexed
  const dia = fecha.getDate();
  const anio = fecha.getFullYear();

  // Feriados fijos de Perú
  if (mes === 1 && dia === 1) return true; // Año Nuevo
  if (mes === 5 && dia === 1) return true; // Día del Trabajo
  if (mes === 6 && dia === 7) return true; // Día de la Bandera
  if (mes === 6 && dia === 29) return true; // San Pedro y San Pablo
  if (mes === 7 && dia === 23) return true; // Día de la Fuerza Aérea
  if (mes === 7 && (dia === 28 || dia === 29)) return true; // Fiestas Patrias
  if (mes === 8 && dia === 6) return true; // Batalla de Junín
  if (mes === 8 && dia === 30) return true; // Santa Rosa de Lima
  if (mes === 10 && dia === 8) return true; // Combate de Angamos
  if (mes === 11 && dia === 1) return true; // Todos los Santos
  if (mes === 12 && dia === 8) return true; // Inmaculada Concepción
  if (mes === 12 && dia === 9) return true; // Batalla de Ayacucho
  if (mes === 12 && dia === 25) return true; // Navidad

  // Feriados movibles (Semana Santa: Jueves y Viernes Santo)
  if (anio === 2026) {
    if (mes === 4 && (dia === 2 || dia === 3)) return true;
  } else if (anio === 2027) {
    if (mes === 3 && (dia === 25 || dia === 26)) return true;
  } else if (anio === 2028) {
    if (mes === 4 && (dia === 13 || dia === 14)) return true;
  }

  return false;
}

export async function programarPrimeraInspeccion(tramiteId: string) {
  const prisma = getPrisma();

  // 1. Buscar o crear el inspector municipal predeterminado
  let inspector = await prisma.usuario.findFirst({
    where: { rol: "INSPECTOR" },
    orderBy: { creadoEn: "asc" },
  });

  if (!inspector) {
    inspector = await prisma.usuario.create({
      data: {
        nombre: "Carlos Mendoza",
        email: "inspector@licencias.pe",
        rol: "INSPECTOR",
        passwordHash: "demo-password-hash",
      },
    });
  }

  // 2. Determinar la fecha inicial de programación (hora simulada)
  const hoy = await getSystemDate();
  let diaEvaluado = new Date(hoy.getTime());

  // Si cae en Sábado, Domingo o Feriado, avanzar al siguiente día hábil
  while (
    getDay(diaEvaluado) === 0 ||
    getDay(diaEvaluado) === 6 ||
    esFeriadoPeru(diaEvaluado)
  ) {
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  // 3. Recorrer días hasta encontrar un bloque disponible (máximo 60 días)
  for (let intento = 0; intento < 60; intento += 1) {
    const diaSemana = getDay(diaEvaluado);

    // Solo evaluar días hábiles (Lunes=1 a Viernes=5)
    if (diaSemana !== 0 && diaSemana !== 6 && !esFeriadoPeru(diaEvaluado)) {
      const inicio = startOfDay(diaEvaluado);
      const fin = endOfDay(diaEvaluado);

      // Buscar inspecciones ya programadas para este inspector en el día evaluado
      const inspeccionesExistentes = await prisma.inspeccion.findMany({
        where: {
          inspectorId: inspector.id,
          fechaProgramada: { gte: inicio, lte: fin },
        },
        orderBy: { fechaProgramada: "asc" },
      });

      // Clave del slot ocupado: "hora:minuto"
      const horasOcupadas = new Set(
        inspeccionesExistentes.map((ins) => {
          const d = new Date(ins.fechaProgramada);
          return `${d.getHours()}:${d.getMinutes()}`;
        })
      );

      // Máximo 4 inspecciones por día
      if (inspeccionesExistentes.length < 4) {
        // Buscar el primer bloque que: (A) no esté ocupado y (B) sea futuro
        const bloqueLibre = BLOQUES_HORARIOS_UTILES.find((bloque) => {
          const clave = `${bloque.hora}:${bloque.minuto}`;
          if (horasOcupadas.has(clave)) return false; // Slot ya ocupado

          const horaBloque = new Date(diaEvaluado.getTime());
          horaBloque.setHours(bloque.hora, bloque.minuto, 0, 0);

          // Solo bloques estrictamente en el futuro
          return horaBloque.getTime() > hoy.getTime();
        });

        if (bloqueLibre) {
          const fechaProgramada = new Date(diaEvaluado.getTime());
          fechaProgramada.setHours(bloqueLibre.hora, bloqueLibre.minuto, 0, 0);

          return prisma.inspeccion.create({
            data: {
              tramiteId,
              inspectorId: inspector.id,
              numeroVisita: 1,
              fechaProgramada,
              bloqueHorario: bloqueLibre.label,
              resultado: "PENDIENTE",
            },
          });
        }
      }
    }

    // Día lleno o sin bloques futuros → avanzar al siguiente día
    diaEvaluado = addDays(diaEvaluado, 1);
  }

  throw new Error("No hay bloques horarios disponibles en la agenda del inspector");
}
