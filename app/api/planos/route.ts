import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/autorizacion";
import { analizarPlanoImagen, tipoImagenPermitido } from "@/lib/validar-plano";

const allowed = new Set(["image/png", "image/jpeg"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await requireRole("NEGOCIO", "CAJERO");
  if (access.error) return access.error;

  const form = await request.formData();
  const file = form.get("plano");
  if (!(file instanceof File) || !allowed.has(file.type) || file.size < 1024 || file.size > maxBytes) {
    return NextResponse.json({ error: "Adjunta una imagen PNG o JPG válida de hasta 10 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (tipoImagenPermitido(bytes) !== file.type) {
    return NextResponse.json({ error: "El contenido no coincide con el tipo de archivo." }, { status: 400 });
  }
  const validation = await analizarPlanoImagen(bytes);
  if (!validation.esPlano) return NextResponse.json({ error: validation.motivo }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Vercel Blob aún no está configurado." }, { status: 503 });

  const blob = await put(`planos/${crypto.randomUUID()}-${file.name}`, Buffer.from(bytes), {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url, validado: true });
}
