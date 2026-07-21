import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

// El cajero puede buscar un negocio por RUC para asociar el trámite
export async function GET(request: NextRequest) {
  const access = await requireRole(request, "CAJERO");
  if (access.error) return access.error;
  try {
    const ruc = request.nextUrl.searchParams.get("ruc");
    if (!ruc) return NextResponse.json({ error: "Parámetro ruc requerido" }, { status: 400 });
    const negocio = await getPrisma().negocio.findUnique({
      where: { ruc },
      select: { id: true, ruc: true, razonSocial: true, domicilioFiscal: true, distrito: true, provincia: true, departamento: true },
    });
    return NextResponse.json(negocio ?? null);
  } catch (error) {
    return apiError(error, "No se pudo buscar el negocio");
  }
}

const upsertSchema = z.object({
  ruc: z.string().regex(/^20\d{9}$/),
  razonSocial: z.string().min(3),
  domicilioFiscal: z.string().min(5),
  distrito: z.string().min(2),
  provincia: z.string().min(2),
  departamento: z.string().min(2),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
});

// El cajero puede crear o actualizar un negocio (upsert por RUC)
export async function POST(request: NextRequest) {
  const access = await requireRole(request, "CAJERO");
  if (access.error) return access.error;
  try {
    const input = upsertSchema.parse(await request.json());

    // Verificar si el RUC ya cuenta con una Licencia Aprobada VIGENTE
    const rucAprobado = await getPrisma().negocio.findUnique({
      where: { ruc: input.ruc },
      include: {
        tramites: {
          orderBy: { creadoEn: "desc" },
          take: 1,
          include: { licencia: true }
        }
      }
    });

    if (rucAprobado && rucAprobado.tramites.length > 0) {
      const ultimo = rucAprobado.tramites[0];
      const estaVencida = ultimo.licencia
        ? (new Date(ultimo.licencia.venceEn) < new Date() || ultimo.estado === "VENCIDO")
        : false;

      if (ultimo.estado === "APROBADO" && !estaVencida) {
        return NextResponse.json(
          { error: `El RUC ${input.ruc} ya cuenta con una Licencia de Funcionamiento Aprobada y Vigente (${ultimo.codigo}).` },
          { status: 400 }
        );
      }
    }

    // Verificar si el negocio ya existe
    const negocioExistente = await getPrisma().negocio.findUnique({
      where: { ruc: input.ruc },
      select: { id: true, ruc: true, razonSocial: true },
    });

    if (negocioExistente) {
      // Actualizar datos del negocio existente
      const negocio = await getPrisma().negocio.update({
        where: { ruc: input.ruc },
        data: {
          razonSocial: input.razonSocial,
          domicilioFiscal: input.domicilioFiscal,
          distrito: input.distrito,
          provincia: input.provincia,
          departamento: input.departamento,
          telefono: input.telefono ?? undefined,
        },
        select: { id: true, ruc: true, razonSocial: true },
      });
      return NextResponse.json(negocio, { status: 200 });
    }

    // Crear negocio nuevo asociando un usuario de forma única
    const PLACEHOLDER_HASH = "$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const emailFinal = input.email && input.email.trim()
      ? input.email.trim().toLowerCase()
      : `negocio-${input.ruc}@licencias.pe`;

    let usuarioTargetId: string;

    // Verificar si el correo ya está en uso por otro usuario
    const usuarioExistente = await getPrisma().usuario.findUnique({
      where: { email: emailFinal },
      include: { negocio: true },
    });

    if (usuarioExistente) {
      if (usuarioExistente.negocio) {
        // Liberar el correo del usuario anterior para reasignarlo
        await getPrisma().usuario.update({
          where: { id: usuarioExistente.id },
          data: { email: `liberado-${usuarioExistente.id}@licencias.pe` }
        });

        // Crear nuevo usuario para el nuevo negocio
        const nuevo = await getPrisma().usuario.create({
          data: {
            nombre: input.razonSocial,
            email: emailFinal,
            passwordHash: PLACEHOLDER_HASH,
            rol: "NEGOCIO",
          }
        });
        usuarioTargetId = nuevo.id;
      } else {
        usuarioTargetId = usuarioExistente.id;
      }
    } else {
      const nuevo = await getPrisma().usuario.create({
        data: {
          nombre: input.razonSocial,
          email: emailFinal,
          passwordHash: PLACEHOLDER_HASH,
          rol: "NEGOCIO",
        }
      });
      usuarioTargetId = nuevo.id;
    }

    const negocio = await getPrisma().negocio.create({
      data: {
        ruc: input.ruc,
        razonSocial: input.razonSocial,
        domicilioFiscal: input.domicilioFiscal,
        distrito: input.distrito,
        provincia: input.provincia,
        departamento: input.departamento,
        telefono: input.telefono ?? undefined,
        usuarioId: usuarioTargetId,
      },
      select: { id: true, ruc: true, razonSocial: true },
    });

    return NextResponse.json(negocio, { status: 201 });
  } catch (error) {
    return apiError(error, "No se pudo registrar el negocio");
  }
}
