import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { getSystemDate } from "@/lib/system-date";
import { hash } from "bcryptjs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRole(request, "ADMIN");
  if (access.error) return access.error;

  const { id } = await params;
  const prisma = getPrisma();

  try {
    const body = await request.json();
    const { nombre, email, password, rol, estado, cerrarCaja } = body;

    // Buscar el usuario actual
    const current = await prisma.usuario.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Validar duplicidad de email si se intenta cambiar el correo
    if (email && email.toLowerCase() !== current.email.toLowerCase()) {
      const existeEmail = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existeEmail) {
        return NextResponse.json({ error: "El correo electrónico ya está registrado por otro usuario." }, { status: 400 });
      }
    }

    // No se puede desactivar la cuenta del Administrador
    if (current.rol === "ADMIN" && estado === "INACTIVO") {
      return NextResponse.json({ error: "No se puede desactivar la cuenta del administrador." }, { status: 400 });
    }

    // Si se intenta desactivar a un CAJERO y no se ha especificado la confirmación de cierre de caja
    if (estado === "INACTIVO" && current.rol === "CAJERO" && cerrarCaja !== true) {
      const cajaAbierta = await prisma.cajaSession.findFirst({
        where: {
          cajeroId: current.id,
          estado: { in: ["ABIERTA", "SOLICITADO_CIERRE"] }
        }
      });

      if (cajaAbierta) {
        return NextResponse.json({
          requiereConfirmacionCierreCaja: true,
          cajaSessionId: cajaAbierta.id,
          nombreCajero: current.nombre,
          mensaje: `El cajero ${current.nombre} tiene una caja abierta actualmente. ¿Desea cerrar la caja y desactivar su cuenta?`
        });
      }
    }

    // Si se confirmó cerrar la caja del cajero al desactivarlo
    if (estado === "INACTIVO" && current.rol === "CAJERO" && cerrarCaja === true) {
      const cajaAbierta = await prisma.cajaSession.findFirst({
        where: {
          cajeroId: current.id,
          estado: { in: ["ABIERTA", "SOLICITADO_CIERRE"] }
        },
        include: { pagos: true }
      });

      if (cajaAbierta) {
        let expectedEfectivo = 0;
        let expectedYape = 0;
        cajaAbierta.pagos.forEach((p) => {
          if (p.estado === "APPROVED") {
            expectedEfectivo += Number(p.montoEfectivo || 0);
            expectedYape += Number(p.montoYape || 0);
          }
        });

        await prisma.cajaSession.update({
          where: { id: cajaAbierta.id },
          data: {
            estado: "CERRADA",
            montoCierreEfectivo: cajaAbierta.montoCierreEfectivo ?? (Number(cajaAbierta.montoApertura) + expectedEfectivo),
            montoCierreYape: cajaAbierta.montoCierreYape ?? expectedYape,
            fechaCierre: await getSystemDate()
          }
        });
      }
    }

    const data: any = {};
    if (nombre !== undefined && nombre.trim()) data.nombre = nombre.trim();
    if (email !== undefined && email.trim()) data.email = email.trim().toLowerCase();
    if (rol !== undefined && ["CAJERO", "INSPECTOR", "NEGOCIO"].includes(rol)) data.rol = rol;
    if (estado !== undefined) data.estado = estado;

    if (password && typeof password === "string" && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
      }
      data.passwordHash = await hash(password.trim(), 12);
    }

    data.actualizadoEn = new Date();

    const updated = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, estado: true, actualizadoEn: true }
    });

    return NextResponse.json({ success: true, user: updated, cajaCerrada: cerrarCaja === true });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return NextResponse.json({ error: "No se pudo actualizar el usuario." }, { status: 500 });
  }
}
