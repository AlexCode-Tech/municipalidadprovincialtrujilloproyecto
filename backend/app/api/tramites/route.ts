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

  const tramites = await getPrisma().tramite.findMany({
    take: 100,
    where: {
      estado: {
        notIn: ["BORRADOR", "PAGO_PENDIENTE", "PAGO_RECHAZADO"]
      }
    },
    orderBy: { actualizadoEn: "desc" },
    include: { negocio: true, pagos: true, inspecciones: true }
  });

  return NextResponse.json(tramites, {
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
      try {
        const usuarioExistente = await getPrisma().usuario.findUnique({
          where: { email: emailFormulario },
          include: { negocio: true }
        });

        if (usuarioExistente && usuarioExistente.id !== dbUsuarioId && !usuarioExistente.negocio) {
          await getPrisma().usuario.update({
            where: { id: usuarioExistente.id },
            data: { email: `liberado-${usuarioExistente.id}@licencias.pe` }
          });
        }

        await getPrisma().usuario.update({
          where: { id: dbUsuarioId },
          data: { email: emailFormulario }
        });
      } catch (e) {
        console.warn("No se pudo actualizar el correo del usuario:", e);
      }
    }

    // 3. Procesamiento por RUC (admite múltiples sucursales y trámites para un mismo RUC)
    if (ruc) {
      const negocioExistenteRuc = await getPrisma().negocio.findUnique({
        where: { ruc }
      });

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

    // 4. Generar código de trámite
    const count = await getPrisma().tramite.count();
    const codigo = `MPT-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;

    // 5. Crear el trámite en la BD (estado PAGO_PENDIENTE)
    const tramite = await getPrisma().tramite.create({
      data: {
        negocioId,
        planoUrl: typeof body.planoUrl === "string" ? body.planoUrl : undefined,
        planoValidado: true,
        codigo,
        cajeroId,
        estado: "PAGO_PENDIENTE",
      },
    });

    return NextResponse.json(tramite, { status: 201 });
  } catch (error) {
    console.error("ERROR EN CREACIÓN DE TRÁMITE:", error);
    return apiError(error);
  }
}
