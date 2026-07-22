import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { enviarCorreo } from "@/lib/email";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

// Almacén en memoria de tokens de recuperación (en producción usar Redis o tabla BD)
// Formato: { [email]: { code: string, expira: number } }
const resetTokens: Record<string, { code: string; expira: number }> = {};

// POST /api/auth/reset-password  { action: "solicitar", email }
// POST /api/auth/reset-password  { action: "verificar", email, code, nuevaPassword }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // ───────────────────────────────────────────
  // PASO 1: Solicitar código de recuperación
  // ───────────────────────────────────────────
  if (action === "solicitar") {
    const { email } = body as { email: string };
    if (!email) return NextResponse.json({ error: "Correo requerido." }, { status: 400 });

    const emailLower = email.trim().toLowerCase();
    const ADMIN_EMAIL = "alexpsm2005@gmail.com";

    // Solo se permite recuperar la contraseña del administrador
    if (emailLower !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { error: "Solo el correo del administrador puede solicitar recuperación de contraseña." },
        { status: 403 }
      );
    }

    const esAdmin = true;
    const userEmail = ADMIN_EMAIL;

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = Date.now() + 15 * 60 * 1000; // 15 minutos
    resetTokens[emailLower] = { code, expira };

    // Enviar correo
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #cbd5e1; padding: 30px; border-radius: 12px;">
        <h2 style="color: #1e3a8a; margin-top: 0;">Recuperación de Contraseña</h2>
        <p style="color: #334155;">Municipalidad Provincial de Trujillo — Sistema de Licencias</p>
        <p>Has solicitado recuperar tu contraseña. Usa el siguiente código de verificación:</p>
        <div style="background: #f1f5f9; border: 2px dashed #3b82f6; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #1e40af;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #64748b;">Este código es válido por <strong>15 minutos</strong>. Si no solicitaste esto, ignora este mensaje.</p>
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">Subgerencia de Licencias y Comercialización — MPT</p>
      </div>
    `;

    try {
      await enviarCorreo({
        to: userEmail,
        subject: "[MPT] Código de recuperación de contraseña",
        text: `Tu código de recuperación es: ${code}. Válido por 15 minutos.`,
        html,
      });
    } catch (e) {
      console.error("Error al enviar correo de recuperación:", e);
    }

    return NextResponse.json({ ok: true, message: "Si el correo existe, recibirás un código." });
  }

  // ───────────────────────────────────────────
  // PASO 2: Verificar código y cambiar contraseña
  // ───────────────────────────────────────────
  if (action === "verificar") {
    const { email, code, nuevaPassword } = body as { email: string; code: string; nuevaPassword: string };

    if (!email || !code || !nuevaPassword) {
      return NextResponse.json({ error: "Todos los campos son requeridos." }, { status: 400 });
    }
    if (nuevaPassword.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    const stored = resetTokens[emailLower];

    if (!stored) {
      return NextResponse.json({ error: "No hay un código activo para este correo. Solicita uno nuevo." }, { status: 400 });
    }
    if (Date.now() > stored.expira) {
      delete resetTokens[emailLower];
      return NextResponse.json({ error: "El código ha expirado. Solicita uno nuevo." }, { status: 400 });
    }
    if (stored.code !== code.trim()) {
      return NextResponse.json({ error: "Código incorrecto. Verifica e intenta nuevamente." }, { status: 400 });
    }

    // Código válido: actualizar contraseña
    const prisma = getPrisma();
    const ADMIN_EMAIL = "alexpsm2005@gmail.com";
    const nuevaHash = await hash(nuevaPassword, 12);

    if (emailLower === ADMIN_EMAIL.toLowerCase()) {
      // Actualizar hash del admin en la BD si existe, si no solo registrar en log
      const adminUser = await prisma.usuario.findFirst({
        where: { rol: "ADMIN" }
      });
      if (adminUser) {
        await prisma.usuario.update({
          where: { id: adminUser.id },
          data: { passwordHash: nuevaHash }
        });
      }
    } else {
      const usuario = await prisma.usuario.findFirst({
        where: { email: { equals: emailLower, mode: "insensitive" } }
      });
      if (!usuario) {
        return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
      }
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { passwordHash: nuevaHash }
      });
    }

    delete resetTokens[emailLower];
    return NextResponse.json({ ok: true, message: "Contraseña actualizada correctamente." });
  }

  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
