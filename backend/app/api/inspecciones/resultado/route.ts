import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { EstadoTramite } from "@prisma/client";

function sumarDiasHabiles(fechaBase: Date, dias: number): Date {
  const fecha = new Date(fechaBase.getTime());
  let count = 0;
  while (count < dias) {
    fecha.setDate(fecha.getDate() + 1);
    const diaSemana = fecha.getDay();
    // 0 = Domingo, 6 = Sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      count++;
    }
  }
  return fecha;
}

export async function POST(request: NextRequest) {
  try {
    const { ruc, resultado, observaciones } = await request.json();
    if (!ruc || !resultado) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    const prisma = getPrisma();

    // 1. Buscar negocio por RUC
    const negocio = await prisma.negocio.findUnique({
      where: { ruc },
      include: {
        tramites: {
          orderBy: { creadoEn: "desc" },
          take: 1
        }
      }
    });

    if (!negocio || negocio.tramites.length === 0) {
      return NextResponse.json({ error: "No se encontró un trámite activo para este RUC." }, { status: 404 });
    }

    const tramite = negocio.tramites[0];

    // Buscar la última inspección realizada para determinar la visita
    const ultimaInspeccionPrev = await prisma.inspeccion.findFirst({
      where: { tramiteId: tramite.id },
      orderBy: { numeroVisita: "desc" }
    });

    // 2. Determinar el estado al que pasará el trámite
    let nuevoEstado: EstadoTramite = "OBSERVADO";
    if (resultado === "CONFORME") {
      nuevoEstado = "APROBADO";
    } else if (ultimaInspeccionPrev && ultimaInspeccionPrev.numeroVisita === 2) {
      nuevoEstado = "DENEGADO";
    }

    // 3. Buscar un inspector válido en la BD para evitar violaciones de clave foránea (FK)
    const inspector = await prisma.usuario.findFirst({
      where: { rol: "INSPECTOR" },
      select: { id: true }
    });

    if (!inspector) {
      return NextResponse.json({ error: "No se encontró ningún inspector registrado en el sistema." }, { status: 500 });
    }

    // 4. Ejecutar la actualización en una transacción
    await prisma.$transaction(async (tx) => {
      // Actualizar estado del trámite
      await tx.tramite.update({
        where: { id: tramite.id },
        data: { estado: nuevoEstado }
      });

      if (resultado === "CONFORME") {
        // Crear/Actualizar la Licencia de Funcionamiento oficial
        const anoActual = new Date().getFullYear();
        const contadorLicencias = (await tx.licencia.count()) + 1;
        const numeroLicencia = `LF-MPT-${anoActual}-${String(contadorLicencias).padStart(6, "0")}`;
        const emitidaEn = new Date();
        const venceEn = new Date(emitidaEn.getFullYear() + 1, emitidaEn.getMonth(), emitidaEn.getDate());

        await tx.licencia.upsert({
          where: { tramiteId: tramite.id },
          create: {
            tramiteId: tramite.id,
            numero: numeroLicencia,
            emitidaEn,
            venceEn,
          },
          update: {
            emitidaEn,
            venceEn,
          }
        });
      }

      if (ultimaInspeccionPrev) {
        // Actualizar la inspección existente a CONFORME u OBSERVADO
        await tx.inspeccion.update({
          where: { id: ultimaInspeccionPrev.id },
          data: {
            resultado: resultado === "CONFORME" ? "CONFORME" : "OBSERVADO",
            observaciones: observaciones || null,
            completadaEn: new Date()
          }
        });

        // Si es la visita 1 y se observa, programar obligatoriamente la visita 2 para dentro de 30 días hábiles
        if (resultado === "OBSERVADO" && ultimaInspeccionPrev.numeroVisita === 1) {
          const fechaSegunda = sumarDiasHabiles(ultimaInspeccionPrev.fechaProgramada, 30);
          // Mantener la misma hora original de la inspección
          fechaSegunda.setHours(new Date(ultimaInspeccionPrev.fechaProgramada).getHours());
          fechaSegunda.setMinutes(new Date(ultimaInspeccionPrev.fechaProgramada).getMinutes());

          await tx.inspeccion.create({
            data: {
              tramiteId: tramite.id,
              inspectorId: inspector.id,
              numeroVisita: 2,
              fechaProgramada: fechaSegunda,
              resultado: "PENDIENTE"
            }
          });

          // Notificar únicamente al negocio por Correo y SMS sobre las observaciones y la visita 2 reprogramada a 30 días hábiles
          const { notificarObservacionNegocio } = require("@/lib/notificaciones");
          void notificarObservacionNegocio(tramite.id, observaciones || "Sin detalle", fechaSegunda, 1);
        } else if (resultado === "OBSERVADO" && ultimaInspeccionPrev.numeroVisita === 2) {
          // Si es la visita 2 observada -> Trámite DENEGADO y concluido
          const { notificarObservacionNegocio } = require("@/lib/notificaciones");
          void notificarObservacionNegocio(tramite.id, observaciones || "Sin detalle", undefined, 2);
        }
      } else {
        // Crear la primera inspección si por alguna razón no existía
        const createdIns = await tx.inspeccion.create({
          data: {
            tramiteId: tramite.id,
            inspectorId: inspector.id,
            numeroVisita: 1,
            fechaProgramada: new Date(),
            resultado: resultado === "CONFORME" ? "CONFORME" : "OBSERVADO",
            observaciones: observaciones || null,
            completadaEn: new Date()
          }
        });

        if (resultado === "OBSERVADO") {
          const fechaSegunda = sumarDiasHabiles(createdIns.fechaProgramada, 30);
          await tx.inspeccion.create({
            data: {
              tramiteId: tramite.id,
              inspectorId: inspector.id,
              numeroVisita: 2,
              fechaProgramada: fechaSegunda,
              resultado: "PENDIENTE"
            }
          });

          const { notificarObservacionNegocio } = require("@/lib/notificaciones");
          void notificarObservacionNegocio(tramite.id, observaciones || "Sin detalle", fechaSegunda, 1);
        }
      }
    });

    return NextResponse.json({ success: true, nuevoEstado });
  } catch (error) {
    console.error("Error al registrar resultado de inspección:", error);
    return NextResponse.json({ error: "No se pudo procesar la acción del inspector." }, { status: 500 });
  }
}
