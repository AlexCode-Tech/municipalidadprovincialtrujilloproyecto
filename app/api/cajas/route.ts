import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";
import { getSystemDate } from "@/lib/system-date";
import { enviarCorreo } from "@/lib/email";
import { hash } from "bcryptjs";
import { scaleUpPago } from "@/lib/registrar-pago";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  "Pragma": "no-cache",
  "Expires": "0"
};

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
    if (!dbUser) return NextResponse.json({ session: null }, { headers: noCacheHeaders });

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
      return NextResponse.json({ session: null }, { headers: noCacheHeaders });
    }

    // Si la sesión está ABIERTA o SOLICITADO_CIERRE, calcular los totales esperados de pagos
    let expectedEfectivo = 0;
    let expectedYape = 0;
    let totalCobros = 0;

    if (session.estado === "ABIERTA" || session.estado === "SOLICITADO_CIERRE") {
      session.pagos.forEach(p => {
        if (p.estado === "APPROVED") {
          expectedEfectivo += Number(p.montoEfectivo);
          expectedYape += Number(p.montoYape) * 60;
          totalCobros += p.metodo === "YAPE" ? 180.00 : (p.metodo === "MIXTO" ? Number(p.montoEfectivo) + (180.00 - Number(p.montoEfectivo)) : Number(p.monto));
        }
      });
    }

    const scaledSession = {
      ...session,
      montoCierreYape: session.montoCierreYape !== null && session.montoCierreYape !== undefined ? Number(session.montoCierreYape) * 60 : null,
      diferenciaArqueo: session.diferenciaArqueo !== null && session.diferenciaArqueo !== undefined ? Number(session.diferenciaArqueo) * 60 : null,
      pagos: (session.pagos || []).map(scaleUpPago)
    };

    return NextResponse.json({
      session: scaledSession,
      expected: {
        efectivo: Number(session.montoApertura) + expectedEfectivo,
        yape: expectedYape,
        total: Number(session.montoApertura) + expectedEfectivo + expectedYape,
        totalCobros
      }
    }, { headers: noCacheHeaders });
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

    const allDepositsAgg = await prisma.depositoMunicipal.aggregate({
      _sum: {
        monto: true
      }
    });
    const totalDepositosDirectos = Number(allDepositsAgg._sum.monto || 0);

    const totalAperturas = sessions.reduce((acc: number, s: any) => acc + Number(s.montoApertura || 0), 0);
    const totalCierresEfectivo = sessions.reduce((acc: number, s: any) => {
      if (s.estado === "CERRADA") {
        return acc + Number(s.montoCierreEfectivo || 0);
      }
      return acc;
    }, 0);

    const efectivoBoveda = totalDepositosDirectos - totalAperturas + totalCierresEfectivo;
    let efectivoCajerosActivos = 0;
    let yapeCajerosActivos = 0;

    sessions.forEach((s: any) => {
      if (s.estado === "SOLICITADO_CIERRE") {
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
      where: { estado: "APPROVED" },
      include: { cajaSession: true }
    });

    const totalYapePagosCerrados = todosLosPagosAprobados.reduce((acc, p) => {
      if (!p.cajaSessionId || p.cajaSession?.estado === "CERRADA") {
        return acc + Number(p.montoYape || 0);
      }
      return acc;
    }, 0);

    const totalTarjetaPagosCerrados = todosLosPagosAprobados.reduce((acc, p) => {
      if (!p.cajaSessionId || p.cajaSession?.estado === "CERRADA") {
        return acc + Number(p.montoTarjeta || 0);
      }
      return acc;
    }, 0);

    const totalDigitalesMPT_Frontend = totalYapePagosCerrados * 60 + totalTarjetaPagosCerrados;
    const totalMPT_Frontend = efectivoBoveda + totalDigitalesMPT_Frontend;

    const tesoreriaMPT = {
      efectivoBoveda: Math.round(efectivoBoveda * 100) / 100,
      digitales: Math.round(totalDigitalesMPT_Frontend * 100) / 100,
      depositosDirectos: Math.round(totalDepositosDirectos * 100) / 100,
      total: Math.round(totalMPT_Frontend * 100) / 100,
    };

    const dineroCajerosActivos = {
      efectivo: Math.round(efectivoCajerosActivos * 100) / 100,
      yape: Math.round(yapeCajerosActivos * 60 * 100) / 100,
      total: Math.round((efectivoCajerosActivos + yapeCajerosActivos * 60) * 100) / 100,
    };

    const cajerosList = await prisma.usuario.findMany({
      where: { rol: "CAJERO", estado: "ACTIVO" },
      select: { id: true, nombre: true, email: true }
    });

    const scaledSessions = sessions.map(s => ({
      ...s,
      montoCierreYape: s.montoCierreYape !== null && s.montoCierreYape !== undefined ? Number(s.montoCierreYape) * 60 : null,
      diferenciaArqueo: s.diferenciaArqueo !== null && s.diferenciaArqueo !== undefined ? Number(s.diferenciaArqueo) * 60 : null,
      pagos: (s.pagos || []).map(scaleUpPago)
    }));

    return NextResponse.json({
      sessions: scaledSessions,
      tesoreriaMPT,
      dineroCajerosActivos,
      depositos,
      cajerosList
    }, {
      headers: noCacheHeaders
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
        return NextResponse.json({ error: "Usuario no encontrado en la base de datos" }, { status: 400, headers: noCacheHeaders });
      }

      const { action } = body;

      if (action === "REQUEST_OPEN") {
        // Verificar si el cajero ya tiene una caja abierta, solicitado cierre o solicitado apertura
        const sesionExistente = await prisma.cajaSession.findFirst({
          where: {
            cajeroId: dbUser.id,
            estado: { in: ["ABIERTA", "SOLICITADO_CIERRE", "SOLICITADO_APERTURA"] }
          }
        });

        if (sesionExistente) {
          if (sesionExistente.estado === "SOLICITADO_APERTURA") {
            return NextResponse.json({ success: true, session: sesionExistente, message: "Solicitud de apertura en proceso." }, { headers: noCacheHeaders });
          }
          return NextResponse.json({ error: "Ya posees un turno de caja activo o en proceso de cierre." }, { status: 400, headers: noCacheHeaders });
        }

        // Crear una nueva sesión en estado SOLICITADO_APERTURA
        const nuevaSesion = await prisma.cajaSession.create({
          data: {
            cajeroId: dbUser.id,
            montoApertura: 0,
            estado: "SOLICITADO_APERTURA",
            fechaApertura: hoy
          }
        });

        // Notificar por correo al Administrador MPT
        try {
          const mensajeHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-top: 0;">🔔 Solicitud de Apertura de Caja</h2>
              <p>El cajero(a) <strong>${dbUser.nombre}</strong> (${dbUser.email}) ha solicitado iniciar su turno de caja.</p>
              
              <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>Cajero:</strong> ${dbUser.nombre}</p>
                <p style="margin: 4px 0;"><strong>Correo:</strong> ${dbUser.email}</p>
                <p style="margin: 4px 0;"><strong>Fecha de Solicitud:</strong> ${hoy.toLocaleString("es-PE")}</p>
              </div>

              <p style="font-size: 13px; color: #475569;">
                Ingrese al panel de Administración en <strong>/admin/cajas</strong> para asignarle su fondo de apertura e iniciar la sesión de caja.
              </p>
            </div>
          `;

          void enviarCorreo({
            to: "alexpsm2005@gmail.com",
            subject: `🔔 SOLICITUD DE APERTURA: El cajero ${dbUser.nombre} solicita abrir caja`,
            text: `El cajero ${dbUser.nombre} solicita apertura de caja. Ingrese a /admin/cajas para asignarle su fondo inicial.`,
            html: mensajeHtml
          });
        } catch (mailErr) {
          console.warn("No se pudo enviar correo de solicitud de apertura:", mailErr);
        }

        return NextResponse.json({ success: true, session: nuevaSesion }, { headers: noCacheHeaders });
      }

      if (action === "OPEN") {
        return NextResponse.json(
          { error: "El cajero no puede auto-aperturar su caja. El fondo de apertura es asignado exclusivamente por el Administrador MPT." },
          { status: 403, headers: noCacheHeaders }
        );
      }

      if (action === "CLOSE") {
        const { sessionId, montoCierreEfectivo, montoCierreYape, justificacionArqueo } = body;
        if (!sessionId || montoCierreEfectivo === undefined || montoCierreYape === undefined) {
          return NextResponse.json({ error: "Parámetros de cierre requeridos" }, { status: 400, headers: noCacheHeaders });
        }

        const session = await prisma.cajaSession.findUnique({
          where: { id: sessionId },
          include: { pagos: true }
        });

        if (!session || session.cajeroId !== dbUser.id || session.estado !== "ABIERTA") {
          return NextResponse.json({ error: "Sesión no encontrada o no está abierta" }, { status: 400, headers: noCacheHeaders });
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
        const physicalYape_Frontend = Number(montoCierreYape);
        const physicalYape_DB = physicalYape_Frontend / 60;

        const expectedYapeTotal_Frontend = expectedYapeTotal * 60;

        const diferencia_Frontend = (physicalEfectivo + physicalYape_Frontend) - (expectedEfectivoTotal + expectedYapeTotal_Frontend);
        const diferencia_DB = diferencia_Frontend / 60;

        if (diferencia_Frontend !== 0 && (!justificacionArqueo || !justificacionArqueo.trim())) {
          return NextResponse.json(
            { error: `Se ha detectado un descuadre en caja de S/ ${diferencia_Frontend.toFixed(2)}. Debes ingresar una justificación obligatoria para la administración.` },
            { status: 400, headers: noCacheHeaders }
          );
        }

        const updated = await prisma.cajaSession.update({
          where: { id: sessionId },
          data: {
            montoCierreEfectivo: physicalEfectivo,
            montoCierreYape: physicalYape_DB,
            diferenciaArqueo: diferencia_DB,
            justificacionArqueo: justificacionArqueo ? justificacionArqueo.trim() : null,
            estado: "SOLICITADO_CIERRE",
            fechaCierre: hoy
          }
        });

        try {
          const mensajeHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-top: 0;">💵 Solicitud de Cierre y Arqueo de Caja</h2>
              <p>El cajero(a) <strong>${dbUser.nombre}</strong> (${dbUser.email}) ha presentado la solicitud de cierre de caja para su validación.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 4px 0;"><strong>ID de Sesión:</strong> ${updated.id}</p>
                <p style="margin: 4px 0;"><strong>Fondo Inicial Apertura:</strong> S/ ${Number(session.montoApertura).toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Cobros en Efectivo:</strong> S/ ${expectedEfectivoAccum.toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Cobros en YAPE:</strong> S/ ${(expectedYapeAccum * 60).toFixed(2)}</p>
                <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 10px 0;" />
                <p style="margin: 4px 0;"><strong>Efectivo Declarado Físico:</strong> S/ ${physicalEfectivo.toFixed(2)}</p>
                <p style="margin: 4px 0;"><strong>Yape Declarado Físico:</strong> S/ ${physicalYape_Frontend.toFixed(2)}</p>
                <p style="margin: 6px 0; font-size: 16px; font-weight: bold; color: ${diferencia_Frontend < 0 ? '#dc2626' : diferencia_Frontend > 0 ? '#047857' : '#1e293b'};">
                  Diferencia de Arqueo (Descuadre): S/ ${diferencia_Frontend.toFixed(2)}
                </p>
                ${justificacionArqueo ? `<p style="margin: 6px 0; background-color: #fffbe6; border: 1px solid #fde68a; padding: 10px; border-radius: 6px; font-style: italic; color: #78350f;"><strong>Justificación del Descuadre:</strong> "${justificacionArqueo}"</p>` : ""}
              </div>

              <p style="font-size: 13px; color: #475569;">
                Por favor ingrese al panel de Administración en <strong>/admin/cajas</strong> para revisar el desglose completo de comprobantes y aprobar la solicitud.
              </p>
            </div>
          `;

          void enviarCorreo({
            to: "alexpsm2005@gmail.com",
            subject: `🚨 ALERTA DE ARQUEO: Solicitud de Cierre de Caja por ${dbUser.nombre} (${diferencia_Frontend < 0 ? 'DESCUADRE NEGATIVO' : diferencia_Frontend > 0 ? 'DESCUADRE POSITIVO' : 'CUADRE OK'})`,
            text: `El cajero ${dbUser.nombre} solicita cierre de caja. Diferencia: S/ ${diferencia_Frontend.toFixed(2)}. ${justificacionArqueo ? `Justificación: ${justificacionArqueo}` : ''}`,
            html: mensajeHtml
          });
        } catch (mailError) {
          console.warn("No se pudo enviar la alerta de correo al administrador:", mailError);
        }

        return NextResponse.json({ success: true, session: updated }, { headers: noCacheHeaders });
      }

      return NextResponse.json({ error: "Acción no válida" }, { status: 400, headers: noCacheHeaders });
    } else {
      // Si es ADMIN, aprueba el cierre de caja, ingresa efectivo directo a MPT, o abre caja para cajero
      const { action, sessionId, monto, concepto, referencia, cajeroId, montoApertura } = body;

      if (action === "OPEN_FOR_CAJERO") {
        if (!cajeroId || !cajeroId.trim()) {
          return NextResponse.json({ error: "ID de cajero requerido" }, { status: 400, headers: noCacheHeaders });
        }
        if (montoApertura === undefined || isNaN(Number(montoApertura)) || Number(montoApertura) < 0) {
          return NextResponse.json({ error: "Monto de apertura inválido" }, { status: 400, headers: noCacheHeaders });
        }

        const cajero = await prisma.usuario.findFirst({
          where: { id: cajeroId, rol: "CAJERO", estado: "ACTIVO" }
        });
        if (!cajero) {
          return NextResponse.json({ error: "Cajero no encontrado o inactivo" }, { status: 404, headers: noCacheHeaders });
        }

        // Verificar si ya tiene sesión activa en ABIERTA o SOLICITADO_CIERRE
        const sesionActiva = await prisma.cajaSession.findFirst({
          where: { cajeroId, estado: { in: ["ABIERTA", "SOLICITADO_CIERRE"] } }
        });
        if (sesionActiva) {
          return NextResponse.json({ error: `${cajero.nombre} ya tiene una caja activa o en proceso de cierre` }, { status: 400, headers: noCacheHeaders });
        }

        // Buscar si existe una solicitud de apertura pendiente (SOLICITADO_APERTURA)
        const sesionSolicitada = await prisma.cajaSession.findFirst({
          where: { cajeroId, estado: "SOLICITADO_APERTURA" }
        });

        // ── VALIDACIÓN: el fondo no puede superar la bóveda de efectivo de la MPT ──
        const montoSolicitado = Number(montoApertura);

        const allSessions = await prisma.cajaSession.findMany({
          select: { montoApertura: true, montoCierreEfectivo: true, estado: true }
        });
        const totalDepositosDB = await prisma.depositoMunicipal.aggregate({
          _sum: { monto: true }
        });
        const totalDepositos = Number(totalDepositosDB._sum.monto || 0);

        const totalAperturas = allSessions.reduce((acc: number, s: any) => acc + Number(s.montoApertura || 0), 0);
        const totalCierres = allSessions.reduce((acc: number, s: any) => {
          if (s.estado === "CERRADA") {
            return acc + Number(s.montoCierreEfectivo || 0);
          }
          return acc;
        }, 0);

        const efectivoBoveda = Math.round((totalDepositos - totalAperturas + totalCierres) * 100) / 100;

        if (montoSolicitado > efectivoBoveda) {
          return NextResponse.json({
            error: `El fondo de apertura (S/ ${montoSolicitado.toFixed(2)}) supera el saldo disponible en la Bóveda de Efectivo de la MPT (S/ ${efectivoBoveda.toFixed(2)}). Reduzca el monto o ingrese más efectivo a la Tesorería MPT.`
          }, { status: 400, headers: noCacheHeaders });
        }

        let sesionAperturada = null;
        if (sesionSolicitada) {
          // Actualizar la solicitud existente a ABIERTA con el monto asignado
          sesionAperturada = await prisma.cajaSession.update({
            where: { id: sesionSolicitada.id },
            data: {
              montoApertura: montoSolicitado,
              estado: "ABIERTA",
              fechaApertura: hoy
            }
          });
        } else {
          // Crear una nueva sesión directa
          sesionAperturada = await prisma.cajaSession.create({
            data: {
              cajeroId,
              montoApertura: montoSolicitado,
              estado: "ABIERTA",
              fechaApertura: hoy
            }
          });
        }

        return NextResponse.json({ success: true, session: sesionAperturada }, { headers: noCacheHeaders });
      }

      if (action === "DIRECT_DEPOSIT") {
        if (!monto || isNaN(Number(monto)) || Number(monto) <= 0 || !concepto || !concepto.trim()) {
          return NextResponse.json({ error: "Ingresa un monto válido mayor a 0 y el concepto del depósito" }, { status: 400, headers: noCacheHeaders });
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

        return NextResponse.json({ success: true, deposito }, { headers: noCacheHeaders });
      }

      if (action === "APPROVE") {
        if (!sessionId) return NextResponse.json({ error: "ID de sesión requerido" }, { status: 400, headers: noCacheHeaders });

        const session = await prisma.cajaSession.findUnique({
          where: { id: sessionId }
        });

        if (!session || session.estado !== "SOLICITADO_CIERRE") {
          return NextResponse.json({ error: "La sesión no se encuentra en estado SOLICITADO_CIERRE" }, { status: 400, headers: noCacheHeaders });
        }

        const updated = await prisma.cajaSession.update({
          where: { id: sessionId },
          data: {
            estado: "CERRADA"
          }
        });

        return NextResponse.json({ success: true, session: updated }, { headers: noCacheHeaders });
      }

      return NextResponse.json({ error: "Acción no válida para Administrador" }, { status: 400, headers: noCacheHeaders });
    }
  } catch (error) {
    console.error("Error en API de cajas:", error);
    return NextResponse.json({ error: "No se pudo procesar la solicitud de caja" }, { status: 500, headers: noCacheHeaders });
  }
}

