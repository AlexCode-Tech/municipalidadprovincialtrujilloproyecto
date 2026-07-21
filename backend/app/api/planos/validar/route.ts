import { NextResponse } from "next/server";

import { analizarPlanoImagen, tipoImagenPermitido } from "@/lib/validar-plano";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("archivo");
  if (!(file instanceof File)) return NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Solo se admiten imágenes PNG o JPG." }, { status: 400 });
  if (file.size < 1024 || file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen debe pesar entre 1 KB y 10 MB." }, { status: 400 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (tipoImagenPermitido(bytes) !== file.type) {
      return NextResponse.json({ error: "El contenido no corresponde a una imagen PNG o JPG válida." }, { status: 400 });
    }
    const result = await analizarPlanoImagen(bytes);
    return NextResponse.json({ esPlano: result.esPlano, motivo: result.motivo });
  } catch (error) {
    console.error("No se pudo analizar la imagen del plano", error);
    return NextResponse.json({ error: "No se pudo leer la imagen. Verifica que no esté dañada." }, { status: 400 });
  }
}
