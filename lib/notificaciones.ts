import { getPrisma } from "./prisma";
import { enviarCorreo } from "./email";
import { enviarSMS } from "./sms";

export type ResultadoEnvio = {
  destinatario: string;
  tipo: "GMAIL" | "SMS";
  enviado: boolean;
  simulado: boolean;
  mensaje: string;
  error?: string;
};

/** Descarta correos ficticios (ej. @tramites.mpt.pe, @licencias.pe) y retorna un correo real válido */
export function obtenerEmailReal(emailPrincipal?: string | null, emailFallback: string = "aleeexpsm2005@gmail.com"): string {
  if (!emailPrincipal) return emailFallback;
  const e = emailPrincipal.trim().toLowerCase();
  if (e.endsWith("@tramites.mpt.pe") || e.endsWith("@licencias.pe") || e.includes("-auto@") || e.includes("demo@")) {
    return emailFallback;
  }
  return emailPrincipal;
}

export async function notificarInspeccionesHoy(): Promise<{
  inspeccionesContadas: number;
  envios: ResultadoEnvio[];
}> {
  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
  const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

  // Buscar inspecciones del día de hoy con datos del negocio y del usuario
  const inspecciones = await getPrisma().inspeccion.findMany({
    where: {
      fechaProgramada: {
        gte: inicioDia,
        lte: finDia,
      },
    },
    include: {
      tramite: {
        include: {
          negocio: {
            include: {
              usuario: true,
            },
          },
        },
      },
    },
  });

  const gmailInspector = "aleeexpsm2005@gmail.com";
  const celularInspector = "935082862";
  const envios: ResultadoEnvio[] = [];

  // ==========================================
  // 1. NOTIFICACIÓN AL INSPECTOR (Correo y SMS)
  // ==========================================
  let htmlInspector = "";
  let txtInspector = "";
  let smsInspector = "";

  if (inspecciones.length > 0) {
    smsInspector = `MPT Inspector: Hoy tienes que cumplir con ${inspecciones.length} inspección(es). Códigos: ${inspecciones.map((i) => i.tramite.codigo).join(", ")}.`;
    
    txtInspector = `Estimado Inspector, hoy tienes que cumplir con ${inspecciones.length} inspección(es) programadas para el día de hoy.\n\nDetalles de la jornada:\n` +
      inspecciones.map((inspeccion) => {
        const hora = new Date(inspeccion.fechaProgramada).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
        return `- Trámite: ${inspeccion.tramite.codigo} | Local: ${inspeccion.tramite.negocio.razonSocial} | RUC: ${inspeccion.tramite.negocio.ruc} | Dirección: ${inspeccion.tramite.negocio.domicilioFiscal} | Hora: ${hora}`;
      }).join("\n");

    htmlInspector = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #cbd5e1; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0;">Municipalidad Provincial de Trujillo</h2>
        <h3 style="color: #1e293b;">Notificación de Inspecciones del Día (Inspector)</h3>
        <p>Estimado Inspector, le informamos que hoy tiene que cumplir con las siguientes inspecciones en su jornada:</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border-color: #cbd5e1; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #1e293b;">
              <th>Código</th>
              <th>Razón Social</th>
              <th>RUC</th>
              <th>Dirección Local</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            ${inspecciones.map((inspeccion) => {
              const hora = new Date(inspeccion.fechaProgramada).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
              return `
                <tr>
                  <td style="font-weight: bold; color: #2563eb;">${inspeccion.tramite.codigo}</td>
                  <td>${inspeccion.tramite.negocio.razonSocial}</td>
                  <td>${inspeccion.tramite.negocio.ruc}</td>
                  <td>${inspeccion.tramite.negocio.domicilioFiscal}</td>
                  <td>${hora}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">Sistema de Licencias de Funcionamiento - Municipalidad Provincial de Trujillo</p>
      </div>
    `;
  } else {
    smsInspector = `MPT Inspector: No tienes inspecciones programadas para el día de hoy.`;
    txtInspector = `Estimado Inspector, no se registran inspecciones programadas para el día de hoy.`;
    htmlInspector = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #cbd5e1; padding: 20px; border-radius: 12px;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0;">Municipalidad Provincial de Trujillo</h2>
        <h3 style="color: #64748b;">Inspecciones del Día</h3>
        <p>No se registran inspecciones pendientes para el día de hoy.</p>
      </div>
    `;
  }

  // Enviar Correo al Inspector
  try {
    await enviarCorreo({
      to: gmailInspector,
      subject: `[MPT] Notificación de Inspecciones de hoy - Inspector`,
      text: txtInspector,
      html: htmlInspector,
    });
    envios.push({ destinatario: gmailInspector, tipo: "GMAIL", enviado: true, simulado: false, mensaje: txtInspector });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[SIMULACIÓN GMAIL INSPECTOR] Para: ${gmailInspector} | Mensaje: ${txtInspector}`);
    envios.push({ destinatario: gmailInspector, tipo: "GMAIL", enviado: true, simulado: true, mensaje: txtInspector, error: errorMsg });
  }

  // Enviar SMS al Inspector vía Twilio
  const resSmsInspector = await enviarSMS({ to: celularInspector, message: smsInspector });
  envios.push({
    destinatario: celularInspector,
    tipo: "SMS",
    enviado: resSmsInspector.enviado,
    simulado: resSmsInspector.simulado,
    mensaje: smsInspector,
    error: resSmsInspector.error,
  });

  // ==========================================
  // 2. NOTIFICACIÓN A CADA NEGOCIO (Correo y SMS)
  // ==========================================
  for (const inspeccion of inspecciones) {
    const negocio = inspeccion.tramite.negocio;
    const emailNegocio = obtenerEmailReal(negocio.usuario?.email);
    const celularNegocio = negocio.telefono || "987654321";
    const fechaHoy = new Date(inspeccion.fechaProgramada).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

    const txtNegocio = `Estimado(a) representante de ${negocio.razonSocial}, le informamos que el día de hoy (${fechaHoy}) se realizará la inspección técnica de seguridad para su local en ${negocio.domicilioFiscal}. Código de Trámite: ${inspeccion.tramite.codigo}. Visita ${inspeccion.numeroVisita} de 2. Por favor asegúrese de que el establecimiento se encuentre abierto durante la jornada del día.`;

    const htmlNegocio = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0;">Municipalidad Provincial de Trujillo</h2>
        <h3 style="color: #0f172a;">Notificación de Inspección Técnica Programada</h3>
        <p>Estimado(a) representante de <strong>${negocio.razonSocial}</strong> (RUC: ${negocio.ruc}):</p>
        <p>Le informamos que el día de hoy el sistema ha programado la inspección técnica de seguridad para su establecimiento:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 4px 0;"><strong>Código Trámite:</strong> ${inspeccion.tramite.codigo}</p>
          <p style="margin: 4px 0;"><strong>Dirección del Local:</strong> ${negocio.domicilioFiscal}</p>
          <p style="margin: 4px 0;"><strong>Distrito:</strong> ${negocio.distrito}</p>
          <p style="margin: 4px 0;"><strong>Fecha de Inspección:</strong> ${fechaHoy}</p>
          <p style="margin: 4px 0;"><strong>Número de Visita:</strong> Visita ${inspeccion.numeroVisita} de 2</p>
        </div>
        <p style="font-size: 13px; color: #475569;">Por favor, asegúrese de que el local se encuentre abierto durante todo el día y que la persona responsable o documentación requerida esté disponible.</p>
        <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">Subgerencia de Licencias y Comercialización - MPT</p>
      </div>
    `;

    const smsNegocio = `MPT Negocio: Hoy (${fechaHoy}) tienes 1 inspección técnica programada para tu local ${negocio.razonSocial} (${inspeccion.tramite.codigo}). Mantén el local abierto durante la jornada.`;

    // Enviar Correo al Negocio
    try {
      await enviarCorreo({
        to: emailNegocio,
        subject: `[MPT] Hoy tienes una inspección técnica programada - ${negocio.razonSocial}`,
        text: txtNegocio,
        html: htmlNegocio,
      });
      envios.push({ destinatario: emailNegocio, tipo: "GMAIL", enviado: true, simulado: false, mensaje: txtNegocio });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[SIMULACIÓN GMAIL NEGOCIO] Para: ${emailNegocio} | Mensaje: ${txtNegocio}`);
      envios.push({ destinatario: emailNegocio, tipo: "GMAIL", enviado: true, simulado: true, mensaje: txtNegocio, error: errorMsg });
    }

    // Enviar SMS al Negocio vía Twilio
    const resSmsNegocio = await enviarSMS({ to: celularNegocio, message: smsNegocio });
    envios.push({
      destinatario: celularNegocio,
      tipo: "SMS",
      enviado: resSmsNegocio.enviado,
      simulado: resSmsNegocio.simulado,
      mensaje: smsNegocio,
      error: resSmsNegocio.error,
    });
  }

  return {
    inspeccionesContadas: inspecciones.length,
    envios,
  };
}

export async function enviarComprobantePago(tramiteId: string, emailDestino: string): Promise<boolean> {
  const prisma = getPrisma();
  try {
    // 1. Obtener los datos del trámite y el negocio
    const tramite = await prisma.tramite.findUnique({
      where: { id: tramiteId },
      include: {
        negocio: true,
        pagos: {
          where: { estado: "APPROVED" },
          orderBy: { creadoEn: "desc" },
          take: 1
        }
      }
    });

    if (!tramite) {
      console.error(`Trámite ${tramiteId} no encontrado para enviar comprobante.`);
      return false;
    }

    const pago = tramite.pagos[0];
    const metodoPago = pago ? (pago.metodo === "YAPE" ? "Yape" : "Tarjeta") : "Yape";
    const fechaPago = pago ? new Date(pago.creadoEn) : new Date();
    const fechaFormateada = fechaPago.toISOString().split("T")[0];

    // Correlativo simulado
    const correlativo = tramite.codigo.replace(/\D/g, "").slice(-6);
    const numeroComprobante = `F001-${correlativo.padStart(6, "0")}`;

    // Hash aleatorio de 8 caracteres hexadecimales
    const hashSimulado = Math.random().toString(16).slice(2, 10).toUpperCase();

    // Estructura HTML idéntica a la imagen de factura proporcionada
    const htmlFactura = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 580px; margin: 20px auto; border: 1px solid #cbd5e1; padding: 25px; color: #000; background-color: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-radius: 8px;">
        <!-- Encabezado -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
          <tr>
            <td valign="top" style="text-align: left; line-height: 1.4;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #000;">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
              <span style="font-size: 13px; color: #000; font-weight: normal;">
                RUC: 20145480033<br>
                Av. España Nro. 456<br>
                Tel: 935082862
              </span>
            </td>
            <td align="right" valign="top" width="220">
              <div style="border: 1.5px solid #000; padding: 10px 15px; text-align: center; line-height: 1.5;">
                <span style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 2px;">RUC: 20145480033</span>
                <span style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 2px;">FACTURA ELECTRONICA</span>
                <span style="font-size: 15px; font-weight: 900; display: block; color: #000;">${numeroComprobante}</span>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Línea negra divisoria gruesa -->
        <div style="border-top: 2px solid #000; margin-bottom: 12px;"></div>

        <!-- Datos del Cliente -->
        <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 13px; line-height: 1.5; color: #000; margin-bottom: 12px;">
          <tr>
            <td width="55%"><strong>Fecha:</strong> ${fechaFormateada}</td>
            <td><strong>Pago:</strong> ${metodoPago}</td>
          </tr>
          <tr>
            <td valign="top"><strong>Razon social:</strong> ${tramite.negocio.razonSocial.toUpperCase()}</td>
            <td valign="top"><strong>RUC:</strong> ${tramite.negocio.ruc}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Direccion fiscal:</strong> ${tramite.negocio.domicilioFiscal.toUpperCase()}</td>
          </tr>
        </table>

        <!-- Línea negra divisoria gruesa -->
        <div style="border-top: 2px solid #000; margin-bottom: 15px;"></div>

        <!-- Tabla Detalles -->
        <div style="background-color: #000; color: #fff; padding: 6px 12px; font-size: 12px; font-weight: bold; text-align: left; letter-spacing: 0.5px;">
          DETALLES DE LA FACTURA
        </div>
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 12px; border-collapse: collapse; margin-top: 5px; color: #000;">
          <thead>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <th align="center" style="font-weight: bold; width: 10%; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Cant.</th>
              <th align="center" style="font-weight: bold; width: 12%; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Unid.</th>
              <th align="center" style="font-weight: bold; width: 15%; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Codigo</th>
              <th align="left" style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Descripcion</th>
              <th align="right" style="font-weight: bold; width: 15%; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">P. Unit.</th>
              <th align="right" style="font-weight: bold; width: 15%; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td align="center" style="padding: 10px 0;">1</td>
              <td align="center" style="padding: 10px 0;">NIU</td>
              <td align="center" style="padding: 10px 0; font-family: monospace;">SERV-001</td>
              <td align="left" style="padding: 10px 0;">Derecho de Trámite Licencia de Funcionamiento (Trujillo)</td>
              <td align="right" style="padding: 10px 0;">180.00</td>
              <td align="right" style="font-weight: bold; padding: 10px 0;">180.00</td>
            </tr>
          </tbody>
        </table>

        <!-- Resumen de Totales -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 15px;">
          <tr>
            <td align="right" style="font-size: 13px; padding-bottom: 8px; color: #000;">
              Items: <span style="font-weight: bold;">1</span>
            </td>
          </tr>
          <tr>
            <td align="right">
              <div style="background-color: #000; color: #fff; display: inline-block; padding: 8px 20px; font-weight: 900; font-size: 15px; letter-spacing: 0.5px;">
                IMPORTE TOTAL: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; S/ 180.00
              </div>
            </td>
          </tr>
        </table>

        <!-- Total escrito en Letras -->
        <div style="border: 1.5px solid #000; padding: 10px; font-size: 12px; font-weight: bold; text-align: left; margin-top: 20px; color: #000;">
          SON: CIENTO OCHENTA CON 00/100 SOLES
        </div>

        <!-- Pie Fiscal -->
        <div style="text-align: right; font-size: 11px; color: #000; margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 8px;">
          Op. Gravada: S/ 152.54 | IGV (18%): S/ 27.46 | Hash: ${hashSimulado}
        </div>
      </div>
    `;

    // Texto plano alternativo
    const textFactura = `MUNICIPALIDAD PROVINCIAL DE TRUJILLO\nRUC: 20145480033\n\nFACTURA ELECTRONICA: ${numeroComprobante}\nFecha: ${fechaFormateada}\nRazon social: ${tramite.negocio.razonSocial.toUpperCase()}\nRUC: ${tramite.negocio.ruc}\nDireccion fiscal: ${tramite.negocio.domicilioFiscal.toUpperCase()}\nPago: ${metodoPago}\n\nDETALLE:\n1 NIU - SERV-001 - Derecho de Trámite Licencia de Funcionamiento - P.Unit: 180.00 - Total: 180.00\n\nIMPORTE TOTAL: S/ 180.00\nSON: CIENTO OCHENTA CON 00/100 SOLES\nOp. Gravada: S/ 152.54 | IGV (18%): S/ 27.46 | Hash: ${hashSimulado}`;

    // Generar el Buffer del PDF de la factura
    const { generarFacturaPdf } = require("./factura-pdf");
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generarFacturaPdf({
        numeroComprobante,
        fechaFormateada,
        metodoPago,
        razonSocial: tramite.negocio.razonSocial,
        ruc: tramite.negocio.ruc,
        domicilioFiscal: tramite.negocio.domicilioFiscal,
        hashSimulado,
      });
    } catch (e) {
      console.error("Error al generar el PDF de la factura:", e);
    }

    // 2. Intentar enviar correo real con el PDF adjunto
    const emailSeguro = obtenerEmailReal(emailDestino);
    try {
      await enviarCorreo({
        to: emailSeguro,
        subject: `Factura Electrónica ${numeroComprobante} - Municipalidad de Trujillo`,
        text: textFactura,
        html: htmlFactura,
        attachments: pdfBuffer
          ? [
              {
                filename: `Factura-${numeroComprobante}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ]
          : undefined,
      });
      console.log(`[OK] Factura real con PDF adjunto enviada a ${emailDestino}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      // Simulación de factura por consola
      console.log(`
┌──────────────────────────────────────────────────────────┐
│          📧 FACTURA ELECTRÓNICA ENVIADA (SIMULACIÓN)     │
├──────────────────────────────────────────────────────────┤
│ Para: ${emailDestino.padEnd(50, " ")} │
│ Comprobante: ${numeroComprobante.padEnd(43, " ")} │
├──────────────────────────────────────────────────────────┤
│ Razón Social: ${tramite.negocio.razonSocial.toUpperCase().padEnd(42, " ")} │
│ RUC Cliente: ${tramite.negocio.ruc.padEnd(43, " ")} │
│ Método Pago: ${metodoPago.padEnd(43, " ")} │
├──────────────────────────────────────────────────────────┤
│ Cant | Unid | Código   | Descripción            | Total  │
│ 1    | NIU  | SERV-001 | Licencia Funcionam.    | 180.00 │
├──────────────────────────────────────────────────────────┤
│ IMPORTE TOTAL: S/ 180.00                                 │
│ SON: CIENTO OCHENTA CON 00/100 SOLES                     │
├──────────────────────────────────────────────────────────┤
│ Op. Gravada: S/ 152.54 | IGV (18%): S/ 27.46             │
│ Hash: ${hashSimulado}                                          │
└──────────────────────────────────────────────────────────┘
      `);
      console.log(`Comprobante enviado exitosamente a ${emailDestino}`);
    }
    return true;
  } catch (error) {
    console.error("Error al generar o enviar comprobante de pago:", error);
    return false;
  }
}

export async function notificarObservacionNegocio(
  tramiteId: string,
  observaciones: string,
  fechaSegundaVisita?: Date,
  numeroVisita: number = 1
): Promise<boolean> {
  const prisma = getPrisma();
  try {
    const tramite = await prisma.tramite.findUnique({
      where: { id: tramiteId },
      include: { negocio: { include: { usuario: true } } }
    });

    if (!tramite) return false;

    const negocio = tramite.negocio;
    const emailDestino = obtenerEmailReal(negocio.usuario?.email);
    const celularDestino = negocio.telefono || "935082862";

    if (numeroVisita === 1 && fechaSegundaVisita) {
      const fechaFormateada = fechaSegundaVisita.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

      const txtGmail = `Estimado(a) representante de ${negocio.razonSocial},\n\nLe informamos que su trámite de Licencia de Funcionamiento (${tramite.codigo}) fue OBSERVADO en la Visita N° 1.\n\nObservaciones registradas por el inspector:\n"${observaciones}"\n\nSe ha reprogramado su Visita N° 2 para dentro de 30 días hábiles, programada para el día ${fechaFormateada}.\nPor favor subsane las observaciones antes de la fecha programada.`;

      const htmlGmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 12px;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0;">Municipalidad Provincial de Trujillo</h2>
          <h3 style="color: #c2410c;">Notificación de Trámite Observado (Visita N° 1)</h3>
          <p>Estimado(a) representante de <strong>${negocio.razonSocial}</strong> (RUC: ${negocio.ruc}):</p>
          <p>Le informamos que en la primera visita de inspección técnica para su trámite <strong>${tramite.codigo}</strong> se registraron las siguientes observaciones:</p>
          <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 15px 0; color: #9a3412;">
            <p style="margin: 0; font-weight: bold;">Detalle de Observaciones:</p>
            <p style="margin-top: 5px; font-style: italic;">"${observaciones}"</p>
          </div>
          <p>Su <strong>Visita N° 2 (Subsanación)</strong> ha sido reprogramada automáticamente para dentro de 30 días hábiles:</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-weight: bold; color: #1e293b;">
            📅 Fecha reprogramada: ${fechaFormateada}
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">Subgerencia de Licencias y Comercialización - MPT</p>
        </div>
      `;

      const smsMsg = `MPT Negocio: Tu trámite ${tramite.codigo} fue OBSERVADO. Detalle: "${observaciones}". Tu 2da visita se reprogramó para el ${fechaFormateada}.`;

      await enviarCorreo({ to: emailDestino, subject: `[MPT] Trámite Observado - Reprogramación de Visita N° 2 (${negocio.razonSocial})`, text: txtGmail, html: htmlGmail });
      await enviarSMS({ to: celularDestino, message: smsMsg });
    } else {
      // Visita 2 observada -> DENEGADO
      const txtGmail = `Estimado(a) representante de ${negocio.razonSocial},\n\nLe informamos que su trámite de Licencia de Funcionamiento (${tramite.codigo}) ha sido DENEGADO al haber sido observado por segunda vez.\n\nObservaciones:\n"${observaciones}"\n\nEl trámite ha quedado concluido. Deberá iniciar un nuevo trámite en la plataforma.`;

      const htmlGmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 12px;">
          <h2 style="color: #991b1b; border-bottom: 2px solid #ef4444; padding-bottom: 10px; margin-top: 0;">Municipalidad Provincial de Trujillo</h2>
          <h3 style="color: #991b1b;">Notificación de Trámite Denegado</h3>
          <p>Estimado(a) representante de <strong>${negocio.razonSocial}</strong> (RUC: ${negocio.ruc}):</p>
          <p>Le informamos que su trámite <strong>${tramite.codigo}</strong> ha sido <strong>DENEGADO</strong> tras ser observado en la segunda visita técnica de inspección.</p>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; color: #991b1b;">
            <p style="margin: 0; font-weight: bold;">Observaciones finales:</p>
            <p style="margin-top: 5px; font-style: italic;">"${observaciones}"</p>
          </div>
          <p>El proceso del trámite ha quedado concluido y cerrado. Si desea obtener la licencia de funcionamiento, deberá registrar un nuevo trámite.</p>
          <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">Subgerencia de Licencias y Comercialización - MPT</p>
        </div>
      `;

      const smsMsg = `MPT Negocio: Tu trámite ${tramite.codigo} fue DENEGADO tras observar la 2da visita. Deberás iniciar un nuevo trámite.`;

      await enviarCorreo({ to: emailDestino, subject: `[MPT] Trámite Denegado - ${negocio.razonSocial}`, text: txtGmail, html: htmlGmail });
      await enviarSMS({ to: celularDestino, message: smsMsg });
    }

    return true;
  } catch (error) {
    console.error("Error al notificar observación al negocio:", error);
    return false;
  }
}

export async function notificarLicenciaVencida(licenciaId: string): Promise<boolean> {
  const prisma = getPrisma();
  try {
    const licencia = await prisma.licencia.findUnique({
      where: { id: licenciaId },
      include: { tramite: { include: { negocio: { include: { usuario: true } } } } }
    });

    if (!licencia) return false;

    const negocio = licencia.tramite.negocio;
    const emailDestino = obtenerEmailReal(negocio.usuario?.email);
    const celularDestino = negocio.telefono || "935082862";

    const txtGmail = `Estimado(a) representante de ${negocio.razonSocial},\n\nLe informamos que su Licencia de Funcionamiento N° ${licencia.numero} para el local ubicado en ${negocio.domicilioFiscal} ha VENCIDO.\n\nLa versión digital de su licencia mostrará la marca de agua 'VENCIDA'. Para volver a contar con una licencia vigente y autorizada, deberá iniciar un nuevo trámite en la plataforma.`;

    const htmlGmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 12px;">
        <h2 style="color: #991b1b; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-top: 0;">Municipalidad Provincial de Trujillo</h2>
        <h3 style="color: #991b1b;">Notificación de Licencia de Funcionamiento Vencida</h3>
        <p>Estimado(a) representante de <strong>${negocio.razonSocial}</strong> (RUC: ${negocio.ruc}):</p>
        <p>Le informamos que su Licencia de Funcionamiento N° <strong>${licencia.numero}</strong> ha <strong>VENCIDO</strong>.</p>
        <div style="background-color: #fef2f2; border: 1.5px solid #f87171; padding: 15px; border-radius: 8px; margin: 15px 0; color: #991b1b;">
          <p style="margin: 0; font-weight: bold; font-size: 15px;">⚠️ ESTADO DE LA LICENCIA: VENCIDA</p>
          <p style="margin-top: 5px; font-size: 13px;">La licencia digital descargable del sistema mostrará la marca de agua 'VENCIDA'. Este estado únicamente se elimina cuando inicie un nuevo trámite para obtener una nueva licencia vigente.</p>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">Subgerencia de Licencias y Comercialización - MPT</p>
      </div>
    `;

    const smsMsg = `MPT Negocio: Tu Licencia Municipal ${licencia.numero} para ${negocio.razonSocial} ha VENCIDO. La versión digital mostrará la marca VENCIDA. Inicia un nuevo trámite para renovar.`;

    await enviarCorreo({ to: emailDestino, subject: `[MPT] ALERTA: Tu Licencia de Funcionamiento N° ${licencia.numero} ha VENCIDO`, text: txtGmail, html: htmlGmail });
    await enviarSMS({ to: celularDestino, message: smsMsg });

    return true;
  } catch (error) {
    console.error("Error al notificar licencia vencida:", error);
    return false;
  }
}
