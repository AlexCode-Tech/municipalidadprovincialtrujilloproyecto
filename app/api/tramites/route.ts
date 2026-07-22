// ====================================================================================
// ARCHIVO: app/api/tramites/route.ts
// COMPONENTE: Route Handlers (GET y POST) para la gestión principal de Trámites y Negocios
// RELACIONES: Se conecta con Prisma ORM (modelos Tramite y Negocio), NextAuth para autorización (requireRole)
//              y sirve tanto al módulo del Contribuyente (NEGOCIO) como al del Cajero (CAJERO).
// ====================================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { forbidden, requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { scaleUpPago } from "@/lib/registrar-pago";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ESQUEMA DE VALIDACIÓN ZOD (CAJERO)
 */
const schemaCajero = z.object({
  negocioId: z.string().optional(),
  ruc: z.string().optional(),
  razonSocial: z.string().optional(),
  domicilioFiscal: z.string().optional(),
  distrito: z.string().optional(),
  provincia: z.string().optional(),
  departamento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  planoUrl: z.url().optional(),
  planoValidado: z.boolean(),
});

/**
 * FUNCIÓN AUXILIAR: resolverCajeroId
 */
async function resolverCajeroId(id: string): Promise<string | undefined> {
  const existe = await getPrisma().usuario.findUnique({ where: { id }, select: { id: true } });
  return existe?.id;
}

/**
 * ENDPOINT GET: /api/tramites
 */
export async function GET(request: NextRequest) {
  const access = await requireRole(request, "CAJERO");
  if (access.error) return access.error;

  const prisma = getPrisma();

  // Eliminar automáticamente trámites no pagados (BORRADOR o PAGO_PENDIENTE sin pagos aprobados)
  const sinPago = await prisma.tramite.findMany({
    where: {
      OR: [
        { estado: "BORRADOR" },
        { estado: "PAGO_PENDIENTE" },
        { codigo: "SOL-2026-000001" }
      ],
      pagos: { none: { estado: "APPROVED" } }
    },
    select: { id: true }
  }).catch(() => []);

  if (sinPago.length > 0) {
    const ids = sinPago.map(t => t.id);
    await prisma.inspeccion.deleteMany({ where: { tramiteId: { in: ids } } }).catch(() => {});
    await prisma.pago.deleteMany({ where: { tramiteId: { in: ids } } }).catch(() => {});
    await prisma.licencia.deleteMany({ where: { tramiteId: { in: ids } } }).catch(() => {});
    await prisma.tramite.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  }

  const tramites = await prisma.tramite.findMany({
    take: 100,
    orderBy: { actualizadoEn: "desc" },
    include: { negocio: true, pagos: true, inspecciones: true }
  });

  const scaledTramites = tramites.map(t => ({
    ...t,
    pagos: (t.pagos || []).map(scaleUpPago)
  }));

  return NextResponse.json(scaledTramites, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}

/**
 * ENDPOINT POST: /api/tramites
 */
export async function POST(request: NextRequest) {
  const access = await requireRole(request, "NEGOCIO", "CAJERO");
  if (access.error) return access.error;

  try {
    const body = await request.json() as Record<string, unknown>;
    const user = access.session.user;
    let dbUsuarioId = user.id;

    // 1. Asegurar la existencia del usuario en la tabla Usuario
    const usuarioExiste = await getPrisma().usuario.findFirst({
      where: {
        OR: [
          { id: user.id },
          { email: user.email || "nunca_hacer_match_a_esto" }
        ]
      }
    });

    if (!usuarioExiste) {
      const nuevoUsuario = await getPrisma().usuario.create({
        data: {
          id: user.id,
          email: user.email || `${user.rol.toLowerCase()}-auto@licencias.pe`,
          nombre: user.name || "Usuario de Pruebas",
          rol: user.rol,
          passwordHash: "demo-password-hash"
        }
      });
      dbUsuarioId = nuevoUsuario.id;
    } else {
      dbUsuarioId = usuarioExiste.id;
    }

    let negocioId: string | undefined = body.negocioId as string | undefined;
    let cajeroId: string | undefined;

    if (user.rol === "CAJERO") {
      cajeroId = await resolverCajeroId(user.id);
    }

    const ruc = body.ruc as string | undefined;
    const emailFormulario = body.email as string | undefined;

    // 2. Actualizar email del usuario si se incluyó en el formulario
    if (emailFormulario) {
      const emailLower = emailFormulario.trim().toLowerCase();
      const usuarioExistente = await getPrisma().usuario.findFirst({
        where: {
          OR: [
            { email: { equals: emailLower, mode: "insensitive" } },
            { email: { equals: `${emailLower}@licencias.pe`, mode: "insensitive" } }
          ]
        }
      });

      if (usuarioExistente) {
        if (usuarioExistente.rol === "ADMIN" || usuarioExistente.rol === "CAJERO" || usuarioExistente.rol === "INSPECTOR") {
          return NextResponse.json(
            { error: `El correo electrónico ${emailFormulario} está reservado para el personal de la municipalidad y no puede usarse para registrar un trámite.` },
            { status: 400 }
          );
        }

        if (usuarioExistente.id !== dbUsuarioId) {
          await getPrisma().usuario.update({
            where: { id: usuarioExistente.id },
            data: { email: `liberado-${usuarioExistente.id}@licencias.pe` }
          });
        }
      }

      try {
        await getPrisma().usuario.update({
          where: { id: dbUsuarioId },
          data: { email: emailFormulario }
        });
      } catch (e) {
        console.warn("No se pudo actualizar el correo del usuario:", e);
      }
    }

    // 3. Procesamiento por RUC
    if (ruc) {
      // 3.1 Validar que este RUC específico no posea una licencia aprobada vigente o un trámite activo
      const negocioExistenteRuc = await getPrisma().negocio.findUnique({
        where: { ruc },
        include: {
          tramites: {
            orderBy: { creadoEn: "desc" },
            take: 1,
            include: { licencia: true }
          }
        }
      });

      if (negocioExistenteRuc && negocioExistenteRuc.tramites.length > 0) {
        const ultimo = negocioExistenteRuc.tramites[0];
        const estaVencida = ultimo.licencia
          ? (new Date(ultimo.licencia.venceEn) < new Date() || ultimo.estado === "VENCIDO")
          : false;

        if (ultimo.estado === "APROBADO" && !estaVencida) {
          return NextResponse.json(
            { error: `El RUC ${ruc} ya cuenta con una Licencia de Funcionamiento Aprobada y Vigente (${ultimo.codigo}).` },
            { status: 400 }
          );
        }

        if (["INSPECCION_PROGRAMADA", "EN_INSPECCION", "OBSERVADO", "SUBSANADO"].includes(ultimo.estado)) {
          return NextResponse.json(
            { error: `El RUC ${ruc} ya cuenta con un trámite activo en proceso (${ultimo.codigo}).` },
            { status: 400 }
          );
        }

        // Si el trámite anterior de este RUC está BORRADOR, VENCIDO o DENEGADO, limpiar registros antiguos de este RUC únicamente
        await getPrisma().inspeccion.deleteMany({ where: { tramite: { negocioId: negocioExistenteRuc.id } } });
        await getPrisma().pago.deleteMany({ where: { tramite: { negocioId: negocioExistenteRuc.id } } });
        await getPrisma().licencia.deleteMany({ where: { tramite: { negocioId: negocioExistenteRuc.id } } });
        await getPrisma().tramite.deleteMany({ where: { negocioId: negocioExistenteRuc.id } });
      }

      // 3.2 Liberar usuarioId si ya estaba asignado a otro Negocio previo (para evitar violación de restricción @unique)
      const negocioPrevio = await getPrisma().negocio.findFirst({
        where: { usuarioId: dbUsuarioId }
      });

      if (negocioPrevio && negocioPrevio.ruc !== ruc) {
        const tempUserId = `user-previo-${negocioPrevio.id}`;
        await getPrisma().usuario.upsert({
          where: { id: tempUserId },
          create: {
            id: tempUserId,
            email: `negocio-${negocioPrevio.ruc}@licencias.pe`,
            nombre: negocioPrevio.razonSocial,
            rol: "NEGOCIO",
            passwordHash: "demo-password-hash"
          },
          update: {}
        });

        await getPrisma().negocio.update({
          where: { id: negocioPrevio.id },
          data: { usuarioId: tempUserId }
        });
      }

      // 3.3 Mapear los datos exactos del negocio traídos de SUNAT
      const datosNegocio = {
        usuarioId: dbUsuarioId,
        razonSocial: (body.razonSocial as string) || `Negocio RUC ${ruc}`,
        domicilioFiscal: (body.domicilioFiscal as string) || "Trujillo",
        distrito: (body.distrito as string) || "Trujillo",
        provincia: (body.provincia as string) || "Trujillo",
        departamento: (body.departamento as string) || "La Libertad",
        telefono: (body.telefono as string) || undefined,
      };

      if (negocioExistenteRuc) {
        const negocioActualizado = await getPrisma().negocio.update({
          where: { ruc },
          data: datosNegocio
        });
        negocioId = negocioActualizado.id;
      } else {
        const nuevoNegocio = await getPrisma().negocio.create({
          data: {
            ruc,
            ...datosNegocio
          }
        });
        negocioId = nuevoNegocio.id;
      }
    } else if (negocioId) {
      const negocio = await getPrisma().negocio.findFirst({ where: { id: negocioId }, select: { id: true } });
      if (!negocio) return forbidden();
    } else {
      const negocio = await getPrisma().negocio.findFirst({
        where: { usuarioId: dbUsuarioId },
        select: { id: true }
      });

      if (negocio) {
        negocioId = negocio.id;
      } else {
        return NextResponse.json(
          { error: "Ingresa un RUC válido para procesar el trámite." },
          { status: 400 }
        );
      }
    }

    // 4. Generar código provisional de solicitud
    const count = await getPrisma().tramite.count();
    const codigo = `SOL-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;

    // 5. Crear el trámite en la BD (siempre en estado PAGO_PENDIENTE, nunca BORRADOR)
    const isRenovacion = body.tipoTramite === "RENOVACION";
    const poseeCambiosEstructura = body.poseeCambiosEstructura === true;
    const confirmacionSinCambios = body.confirmacionSinCambios === true;

    const tramite = await getPrisma().tramite.create({
      data: {
        negocioId,
        planoUrl: typeof body.planoUrl === "string" ? body.planoUrl : undefined,
        planoValidado: isRenovacion && confirmacionSinCambios ? true : (body.planoValidado === true),
        codigo,
        cajeroId,
        estado: "PAGO_PENDIENTE",
        tipoTramite: (body.tipoTramite as string) || "INICIAL",
        esRenovacion: isRenovacion,
        poseeCambiosEstructura,
        confirmacionSinCambios,
      },
    });

    return NextResponse.json(tramite, { status: 201 });
  } catch (error) {
    console.error("ERROR EN CREACIÓN DE TRÁMITE:", error);
    return apiError(error);
  }
}
