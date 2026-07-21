import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/autorizacion";
import { enviarCorreo } from "@/lib/email";
import { apiError } from "@/lib/api";

const schema = z.object({ to: z.email(), subject: z.string().min(3), text: z.string().min(3) });
export async function POST(request: Request) {
  const access = await requireRole("CAJERO", "INSPECTOR");
  if (access.error) return access.error;
  try { await enviarCorreo(schema.parse(await request.json())); return NextResponse.json({ sent: true }); }
  catch (error) { return apiError(error); }
}
