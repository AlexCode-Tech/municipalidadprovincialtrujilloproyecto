import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { getSystemDate } from "@/lib/system-date";
import { enviarCorreo } from "@/lib/email";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

async function resolveUsuario(prisma: any, user: { id: string; email?: string | null; name?: string | null; rol: any }) {
  if (!user.email) return null;
  let usuario = await prisma.usuario.findFirst({
    where: {
      OR: [
        { email: user.email },
        { id: user.id }
      ]
    }
  });

  if (!usuario) {
    const passwordHash = await hash("demo123", 12);
    usuario = await prisma.usuario.create({
      data: {
        nombre: user.name || "Cajero Municipal",
        email: user.email,
        passwordHash,
        rol: user.rol,
        estado: "ACTIVO"
      }
    });
  }

  return usuario;
}

export async function GET(request: NextRequest) {
  const access = await requireRole(request, "CAJERO", "ADMIN");
  if (access.error) return access.error;
  const user = access.session.user;
  const prisma = getPrisma();

  if (user.rol === "CAJERO") {
    const dbUser = await resolveUsuario(prisma, user);
    if (!dbUser) return NextResponse.json({ session: null });

    // Buscar la última sesión de caja de este cajero
    const session = await prisma.cajaSession.findFirst({
      where: { cajeroId: dbUser.id },
      orderBy: { creadoEn: "desc" },
      include: {
        pagos: {
          include: {
            tramite: {
              include: { negocio: true }
            }
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json({ session: null });
    }

    // Si la sesión está ABIERTA o SOLICITADO_CIERRE, calcular los totales esperados de pagos
    let expectedEfectivo = 0;
    let expectedYape = 0;
    let totalCobros = 0;

    if (session.estado === "ABIERTA" || session.estado === "SOLICITADO_CIERRE") {
      session.pagos.forEach(p => {
        if (p.estado === "APPROVED") {
          expectedEfectivo += Number(p.montoEfectivo);
          expectedYape += Number(p.montoYape);
          totalCobros += Number(p.monto);
        }
      });
    }

    return NextResponse.json({
      session,
      expected: {
        efectivo: Number(session.montoApertura) + expectedEfectivo,
        yape: expectedYape,
        total: Number(session.montoApertura) + expectedEfectivo + expectedYape,
        totalCobros
      }
    });
  } else {
    // Si es ADMIN, listar todas las sesiones con el desglose completo de comprobantes y métricas de tesorería
    const sessions = await prisma.cajaSession.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        cajero: { select: { id: true, nombre: true, email: true } },
        pagos: {
          include: {
            tramite: {
              include: { negocio: true }
            }
          }
        }
      }
    });

    let depositos: any[] = [];
    try {
      depositos = await prisma.depositoMunicipal.findMany({
        orderBy: { creadoEn: "desc" },
        take: 30
      });
    } catch (e) {
      depositos = [];
    }

    const totalDepositosDirectos = depositos.reduce((acc: number, d: any) => acc + Number(d.monto || 0), 0);

    let efectivoBoveda = totalDepositosDirectos;
    let efectivoCajerosActivos = 0;
    let yapeCajerosActivos = 0;

    sessions.forEach((s: any) => {
      if (s.estado === "CERRADA") {
        efectivoBoveda += Number(s.montoCierreEfectivo || 0);
      } else if (s.estado === "SOLICITADO_CIERRE") {
        efectivoCajerosActivos += Number(s.montoCierreEfectivo || 0);
        yapeCajerosActivos += Number(s.montoCierreYape || 0);
      } else if (s.estado === "ABIERTA") {
        let cobrosEff = 0;
        let cobrosYap = 0;
        (s.pagos || []).forEach((p: any) => {
          if (p.estado === "APPROVED") {
            cobrosEff += Number(p.montoEfectivo || 0);
            cobrosYap += Number(p.montoYape || 0);
          }
        });
        efectivoCajerosActivos += Number(s.montoApertura || 0) + cobrosEff;
        yapeCajerosActivos += cobrosYap;
      }
    });

    const todosLosPagosAprobados = await prisma.pago.findMany({
      where: { estado: "APPROVED" }
    });
    const totalYapePagos = todosLosPagosAprobados.reduce((acc, p) => acc + Number(p.montoYape || 0), 0);
    const totalTarjetaPagos = todosLosPagosAprobados.reduce((acc, p) => acc + Number(p.montoTarjeta || 0), 0);
    const totalDigitalesMPT = totalYapePagos + totalTarjetaPagos;

    const tesoreriaMPT = {
      efectivoBoveda: Math.round(efectivoBoveda * 100) / 100,
      digitales: Math.round(totalDigitalesMPT * 100) / 100,
      depositosDirectos: Math.round(totalDepositosDirectos * 100) / 100,
      total: Math.round((efectivoBoveda + totalDigitalesMPT) * 100) / 100,
    };

    const dineroCajerosActivos = {
      efectivo: Math.round(efectivoCajerosActivos * 100) / 100,
      yape: Math.round(yapeCajerosActivos * 100) / 100,
      total: Math.round((efectivoCajerosActivos + yapeCajerosActivos) * 100) / 100,
    };

    const cajerosList = await prisma.usuario.findMany({
      where: { rol: "CAJERO", estado: "ACTIVO" },
      select: { id: true, nombre: true, email: true }
    });

    return NextResponse.json({
      sessions,
      tesoreriaMPT,
      dineroCajerosActivos,
      depositos,
      cajerosList
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireRole(request, "CAJERO", "ADMIN");
  if (access.error) return access.error;
  const user = access.session.user;
  const prisma = getPrisma();
  const hoy = await getSystemDate();

  try {
    const body = await request.json();

    if (user.rol === "CAJERO") {
      const dbUser = await resolveUsuario(prisma, user);
      if (!dbUser) {
        return NextResponse.json({ error: "Usuario no encontrado en la base de datos" }, { status: 400 });
      }

      const { action } = body;

      if (action === "OPEN") {
        return NextResponse.json(
          { error: "El cajero no puede auto-aperturar su caja. El fondo de apertura es asignado exclusivamente por el Administrador MPT." },
          { status: 403 }
        );
      }

      if (action === "CLOSE") {
        const { sessionId, montoCierreEfectivo, montoCierreYape, justificacionArqueo } = body;
        if (!sessionId || montoCierreEfectivo === undefined || montoCierreYape === undefined) {
          return NextResponse.json({ error: "Parámetros de cierre requeridos" }, { status: 400 });
        }

        const session = await prisma.cajaSession.findUnique({
          where: { id: sessionId },
          include: { pagos: true }
        });

        if (!session || session.cajeroId !== dbUser.id || session.estado !== "ABIERTA") {
          return NextResponse.json({ error: "Sesión no encontrada o no está abierta" }, { status: 400 });
        }

        // Calcular montos esperados
        let expectedEfectivoAccum = 0;
        let expectedYapeAccum = 0;

        session.pagos.forEach(p => {
          if (p.estado === "APPROVED") {
            expectedEfectivoAccum += Number(p.montoEfectivo);
            expectedYapeAccum += Number(p.montoYape);
          }
        });

        const expectedEfectivoTotal = Number(session.montoApertura) + expectedEfectivoAccum;
        const expectedYapeTotal = expectedYapeAccum;

        const physicalEfectivo = Number(montoCierreEfectivo);
        const physicalYape = Number(montoCierreYape);

        // Descuadre = físico - esperado
        const diferencia = (physicalEfectivo + physicalYape) - (expectedEfectivoTotal + expectedYapeTotal);

        // Exigir justificación si hay descuadre positivo o negativo
        if (diferencia !== 0 && (!justificacionArqueo || !justificacionArqueo.trim())) {
          return NextResponse.json(
            { error: `Se ha detectado un descuadre en caja de S/ ${diferencia.toFixed(2)}. Debes ingresar una justificación obligatoria para la administración.` },
            { status: 400 }
          );
        }

        const updated = await prisma.cajaSession.update({
          where: { id: sessionId },
          data: {
            montoCierreEfectivo: physicalEfectivo,
            montoCierreYape: physicalYape,
            diferenciaArqueo: diferencia,
            justificacionArqueo: justificacionArqueo ? justificacionArqueo.trim() : null,
            estado: "SOLICITADO_CIERRE",
            fechaCierre: hoy
          }
        });

        // Enviar notificación por correo al Administrador Único
        try {
          const mensajeHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-top: 0;">💵 Solicitud de Cierre y Arqueo de Caja</h2>
              <p>El cajero(a) <strong>${dbUser.nombre}</strong> (${dbUser.email}) ha presentado la solicitud de cierre de caja para su validación.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>ID de Sesión:</strong> ${updated.id}</p>
                <p style="margin: 4px 0;"><strong>Fondo Inicial Apertura:</strong> S/ ${Number(session.montoApertura).toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Cobros en Efectivo:</strong> S/ ${expectedEfectivoAccum.toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Cobros en YAPE:</strong> S/ ${expectedYapeAccum.toFixed(2)}</p>
                <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 10px 0;" />
                <p style="margin: 4px 0;"><strong>Efectivo Declarado Físico:</strong> S/ ${physicalEfectivo.toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Yape Declarado Físico:</strong> S/ ${physicalYape.toFixed(2)}</p>
                <p style="margin: 6px 0; font-size: 16px; font-weight: bold; color: ${diferencia < 0 ? '#dc2626' : diferencia > 0 ? '#047857' : '#1e293b'};">
                  Diferencia de Arqueo (Descuadre): S/ ${diferencia.toFixed(2)}
                </p>
                ${justificacionArqueo ? `<p style="margin: 6px 0; background-color: #fffbe6; border: 1px solid #fde68a; padding: 10px; border-radius: 6px; font-style: italic; color: #78350f;"><strong>Justificación del Descuadre:</strong> "${justificacionArqueo}"</p>` : ""}
              </div>

              <p style="font-size: 13px; color: #475569;">
                Por favor ingrese al panel de Administración en <strong>/admin/cajas</strong> para revisar el desglose completo de comprobantes y aprobar la solicitud.
              </p>
            </div>
          `;

          void enviarCorreo({
            to: "admin@demo.pe",
            subject: `🚨 ALERTA DE ARQUEO: Solicitud de Cierre de Caja por ${dbUser.nombre} (${diferencia < 0 ? 'DESCUADRE NEGATIVO' : diferencia > 0 ? 'DESCUADRE POSITIVO' : 'CUADRE OK'})`,
            text: `El cajero ${dbUser.nombre} solicita cierre de caja. Diferencia: S/ ${diferencia.toFixed(2)}. ${justificacionArqueo ? `Justificación: ${justificacionArqueo}` : ''}`,
            html: mensajeHtml
          });
        } catch (mailError) {
          console.warn("No se pudo enviar la alerta de correo al administrador:", mailError);
        }

        return NextResponse.json({ success: true, session: updated });
      }

      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    } else {
      // Si es ADMIN, aprueba el cierre de caja, ingresa efectivo directo a MPT, o abre caja para cajero
      const { action, sessionId, monto, concepto, referencia, cajeroId, montoApertura } = body;

      if (action === "OPEN_FOR_CAJERO") {
        if (!cajeroId || !cajeroId.trim()) {
          return NextResponse.json({ error: "ID de cajero requerido" }, { status: 400 });
        }
        if (montoApertura === undefined || isNaN(Number(montoApertura)) || Number(montoApertura) < 0) {
          return NextResponse.json({ error: "Monto de apertura inválido" }, { status: 400 });
        }

        const cajero = await prisma.usuario.findFirst({
          where: { id: cajeroId, rol: "CAJERO", estado: "ACTIVO" }
        });
        if (!cajero) {
          return NextResponse.json({ error: "Cajero no encontrado o inactivo" }, { status: 404 });
        }

        // Verificar si ya tiene sesión abierta
        const sesionActiva = await prisma.cajaSession.findFirst({
          where: { cajeroId, estado: { in: ["ABIERTA", "SOLICITADO_CIERRE"] } }
        });
        if (sesionActiva) {
          return NextResponse.json({ error: `${cajero.nombre} ya tiene una caja activa o en proceso de cierre` }, { status: 400 });
        }

        // ── VALIDACIÓN: el fondo no puede superar la bóveda de efectivo de la MPT ──
        const montoSolicitado = Number(montoApertura);

        // Calcular saldo actual de tesorería MPT (igual que en el GET)
        const allSessions = await prisma.cajaSession.findMany({
          where: { estado: "CERRADA" },
          select: { montoCierreEfectivo: true }
        });
        const depositos = await prisma.depositoMunicipal.findMany({
          select: { monto: true }
        });
        const totalDepositos = depositos.reduce((acc: number, d: any) => acc + Number(d.monto || 0), 0);
        const totalCierres = allSessions.reduce((acc: number, s: any) => acc + Number(s.montoCierreEfectivo || 0), 0);
        const efectivoBoveda = Math.round((totalDepositos + totalCierres) * 100) / 100;

        if (montoSolicitado > efectivoBoveda) {
          return NextResponse.json({
            error: `El fondo de apertura (S/ ${montoSolicitado.toFixed(2)}) supera el saldo disponible en la Bóveda de Efectivo de la MPT (S/ ${efectivoBoveda.toFixed(2)}). Reduzca el monto o ingrese más efectivo a la Tesorería MPT.`
          }, { status: 400 });
        }
        // ─────────────────────────────────────────────────────────────────────────

        const nuevaSesion = await prisma.cajaSession.create({
          data: {
            cajeroId,
            montoApertura: montoSolicitado,
            estado: "ABIERTA",
            fechaApertura: hoy
          }
        });

        return NextResponse.json({ success: true, session: nuevaSesion });
      }

      if (action === "DIRECT_DEPOSIT") {
        if (!monto || isNaN(Number(monto)) || Number(monto) <= 0 || !concepto || !concepto.trim()) {
          return NextResponse.json({ error: "Ingresa un monto válido mayor a 0 y el concepto del depósito" }, { status: 400 });
        }

        const deposito = await prisma.depositoMunicipal.create({
          data: {
            monto: Number(monto),
            concepto: concepto.trim(),
            referencia: referencia ? referencia.trim() : null,
            registradoPor: user.name || user.email || "Administrador",
            creadoEn: hoy
          }
        });

        return NextResponse.json({ success: true, deposito });
      }

      if (action === "APPROVE") {
        if (!sessionId) return NextResponse.json({ error: "ID de sesión requerido" }, { status: 400 });

        const session = await prisma.cajaSession.findUnique({
          where: { id: sessionId }
        });

        if (!session || session.estado !== "SOLICITADO_CIERRE") {
          return NextResponse.json({ error: "La sesión no se encuentra en estado SOLICITADO_CIERRE" }, { status: 400 });
        }

        const updated = await prisma.cajaSession.update({
          where: { id: sessionId },
          data: {
            estado: "CERRADA"
          }
        });

        return NextResponse.json({ success: true, session: updated });
      }

      return NextResponse.json({ error: "Acción no válida para Administrador" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error en API de cajas:", error);
    return NextResponse.json({ error: "No se pudo procesar la solicitud de caja" }, { status: 500 });
  }
}
