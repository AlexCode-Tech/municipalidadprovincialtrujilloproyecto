import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { negocioSchema } from "@/lib/validaciones";
import { getPrisma } from "@/lib/prisma";

const registroSchema = negocioSchema.extend({ nombreRepresentante: z.string().min(3), password: z.string().min(8) });

export async function POST(request: Request) {
  try {
    const input = registroSchema.parse(await request.json());
    const passwordHash = await hash(input.password, 12);
    const negocio = await getPrisma().negocio.create({
      data: {
        ruc: input.ruc,
        razonSocial: input.razonSocial,
        domicilioFiscal: input.domicilioFiscal,
        distrito: input.distrito,
        provincia: input.provincia,
        departamento: input.departamento,
        telefono: input.telefono,
        usuario: {
          create: {
            nombre: input.nombreRepresentante,
            email: input.email,
            passwordHash,
            rol: "NEGOCIO"
          }
        }
      }
    });
    return NextResponse.json({ id: negocio.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
