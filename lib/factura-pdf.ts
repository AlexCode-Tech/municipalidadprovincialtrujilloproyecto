import PDFDocument from "pdfkit";

export type DatosFacturaPdf = {
  numeroComprobante: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  metodoPago?: string;
  razonSocial: string;
  ruc: string;
  domicilioFiscal: string;
  direccionSucursal?: string;
  codigoTramite?: string;
  hashSimulado?: string;
};

export function generarFacturaPdf(datos: DatosFacturaPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 30,
      info: {
        Title: `Factura Electrónica ${datos.numeroComprobante}`,
        Author: "Municipalidad Provincial de Trujillo",
        Subject: "Representación Impresa de Factura Electrónica SUNAT",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const margin = 30;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = doc.page.height - margin * 2;

    // Bloque Exterior: Recuadro bordea toda la página
    doc.rect(margin, margin, contentWidth, contentHeight).lineWidth(1).strokeColor("#000000").stroke();

    // Bloque 1: Encabezado Institucional (Izquierda)
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(11).text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", margin + 15, margin + 15, { width: 330 });
    doc.font("Helvetica").fontSize(8.5).text("JR. ALMAGRO 525 URB. CENTRO HISTORICO", margin + 15, margin + 30);
    doc.text("LA LIBERTAD - TRUJILLO - TRUJILLO", margin + 15, margin + 42);

    // Recuadro Fiscal Superior Derecho
    const boxWidth = 200;
    const boxHeight = 52;
    const boxX = pageWidth - margin - boxWidth - 15;
    const boxY = margin + 12;

    doc.rect(boxX, boxY, boxWidth, boxHeight).lineWidth(1.2).strokeColor("#000000").stroke();
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10.5).text("FACTURA ELECTRONICA", boxX, boxY + 8, { width: boxWidth, align: "center" });
    doc.fontSize(10).text("RUC: 20175639391", boxX, boxY + 22, { width: boxWidth, align: "center" });
    doc.fontSize(11).text(datos.numeroComprobante, boxX, boxY + 36, { width: boxWidth, align: "center" });

    // Línea divisoria 1
    let y = margin + 72;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.8).strokeColor("#000000").stroke();

    // Bloque 2: Datos del Cliente / Contribuyente
    y += 10;
    const col1X = margin + 15;
    const val1X = margin + 130;
    const lineGap = 13;
    const fechaVence = datos.fechaVencimiento || "17/08/2027";

    doc.font("Helvetica").fontSize(8.5);

    // Fecha de Vencimiento
    doc.text("Fecha de Vencimiento", col1X, y);
    doc.text(":", col1X + 105, y);
    doc.font("Helvetica-Bold").text(fechaVence, val1X, y);

    // Fecha de Emisión
    y += lineGap;
    doc.font("Helvetica").text("Fecha de Emisión", col1X, y);
    doc.text(":", col1X + 105, y);
    doc.font("Helvetica-Bold").text(datos.fechaEmision, val1X, y);

    // Señor(es)
    y += lineGap;
    doc.font("Helvetica").text("Señor(es)", col1X, y);
    doc.text(":", col1X + 105, y);
    doc.font("Helvetica-Bold").text(datos.razonSocial.toUpperCase(), val1X, y, { width: 380 });
    const rsHeight = Math.max(12, doc.heightOfString(datos.razonSocial.toUpperCase(), { width: 380 }));

    // RUC
    y += rsHeight;
    doc.font("Helvetica").text("RUC", col1X, y);
    doc.text(":", col1X + 105, y);
    doc.font("Helvetica-Bold").text(datos.ruc, val1X, y);

    // Establecimiento del Emisor (SUNAT)
    y += lineGap;
    doc.font("Helvetica").text("Establecimiento del", col1X, y);
    doc.text("Emisor (SUNAT)", col1X, y + 9);
    doc.text(":", col1X + 105, y);
    doc.font("Helvetica-Bold").text(datos.domicilioFiscal.toUpperCase(), val1X, y, { width: 380 });
    const domHeight = Math.max(18, doc.heightOfString(datos.domicilioFiscal.toUpperCase(), { width: 380 }) + 2);

    // Local a Licenciar (Sucursal)
    y += domHeight;
    doc.font("Helvetica").text("Local / Sucursal", col1X, y);
    doc.text("a Licenciar", col1X, y + 9);
    doc.text(":", col1X + 105, y);
    const sucText = (datos.direccionSucursal || datos.domicilioFiscal).toUpperCase();
    doc.font("Helvetica-Bold").text(sucText, val1X, y, { width: 380 });
    const sucHeight = Math.max(18, doc.heightOfString(sucText, { width: 380 }) + 2);

    // Tipo de Moneda
    y += sucHeight;
    doc.font("Helvetica").text("Tipo de Moneda", col1X, y);
    doc.text(":", col1X + 105, y);
    doc.font("Helvetica-Bold").text("SOLES", val1X, y);

    // Observación
    y += lineGap;
    doc.font("Helvetica").text("Observación", col1X, y);
    doc.text(":", col1X + 105, y);
    const obsText = `ORDEN DE SERVICIO N. ${datos.codigoTramite ?? "MPT-2026-000001"}${datos.metodoPago ? ` (${datos.metodoPago})` : ""}`;
    doc.font("Helvetica-Bold").text(obsText, val1X, y, { width: 380 });

    // Línea divisoria 2 (Tabla Header)
    y += 18;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor("#000000").stroke();

    // Bloque 3: Encabezado Tabla de Detalles
    y += 4;
    doc.font("Helvetica-Bold").fontSize(8.5);
    doc.text("Cantidad", margin + 10, y, { width: 50, align: "right" });
    doc.text("Unidad Medida", margin + 70, y, { width: 85, align: "left" });
    doc.text("Código", margin + 160, y, { width: 70, align: "left" });
    doc.text("Descripción", margin + 235, y, { width: 230, align: "left" });
    doc.text("Valor Unitario", margin + 470, y, { width: 75, align: "right" });

    y += 14;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor("#000000").stroke();

    // Fila de Item
    y += 6;
    doc.font("Helvetica").fontSize(8.5);
    doc.text("1.00", margin + 10, y, { width: 50, align: "right" });
    doc.text("UNIDAD", margin + 70, y, { width: 85, align: "left" });
    doc.text("SERV-MPT", margin + 160, y, { width: 70, align: "left" });
    doc.text("POR DERECHO DE TRAMITE Y EMISION DE LICENCIA DE FUNCIONAMIENTO MUNICIPAL DE TRUJILLO", margin + 235, y, { width: 230, align: "left" });
    doc.text("152.54", margin + 470, y, { width: 75, align: "right" });

    // Línea divisoria 3
    y += 28;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor("#000000").stroke();

    // Bloque 4: Totales y Cuadros
    y += 10;
    const totalsLeftX = margin + 15;
    const totalsRightBoxX = pageWidth - margin - 215;
    const totalsRightBoxWidth = 200;

    // Lado Izquierdo: Valor Venta Operaciones Gratuitas
    const freeBoxY = y;
    doc.rect(totalsLeftX + 130, freeBoxY, 150, 20).lineWidth(0.8).strokeColor("#000000").stroke();
    doc.font("Helvetica").fontSize(8.5).text("Valor de Venta de Operaciones", totalsLeftX, freeBoxY + 3);
    doc.text("Gratuitas :", totalsLeftX, freeBoxY + 12);
    doc.font("Helvetica-Bold").text("S/ 0.00", totalsLeftX + 140, freeBoxY + 5);

    // Lado Izquierdo: Total Escrito en Letras
    const sonY = freeBoxY + 36;
    doc.font("Helvetica-Bold").fontSize(8.5).text("SON: CIENTO OCHENTA CON 00/100 SOLES", totalsLeftX, sonY);

    // Lado Derecho: Cuadro Grilla de Totales
    let ry = y;
    const rightRowHeight = 13.5;
    const drawTotalRow = (label: string, value: string, isFinal: boolean = false) => {
      doc.rect(totalsRightBoxX, ry, totalsRightBoxWidth, isFinal ? 20 : rightRowHeight).lineWidth(0.8).strokeColor("#000000").stroke();
      doc.font(isFinal ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(label, totalsRightBoxX + 8, ry + (isFinal ? 5 : 2));
      doc.font(isFinal ? "Helvetica-Bold" : "Helvetica").text(value, totalsRightBoxX + 100, ry + (isFinal ? 5 : 2), { width: 90, align: "right" });
      ry += isFinal ? 20 : rightRowHeight;
    };

    drawTotalRow("Sub Total Ventas :", "S/ 152.54");
    drawTotalRow("Anticipos :", "S/ 0.00");
    drawTotalRow("Descuentos :", "S/ 0.00");
    drawTotalRow("Valor Venta :", "S/ 152.54");
    drawTotalRow("ISC :", "S/ 0.00");
    drawTotalRow("IGV :", "S/ 27.46");
    drawTotalRow("Otros Cargos :", "S/ 0.00");
    drawTotalRow("Otros Tributos :", "S/ 0.00");
    drawTotalRow("Importe Total :", "S/ 180.00", true);

    // Bloque 5: Recuadro Nota SUNAT al pie
    const footerBoxWidth = contentWidth - 30;
    const footerBoxX = margin + 15;
    const footerBoxY = doc.page.height - margin - 35;
    const footerBoxHeight = 24;

    doc.rect(footerBoxX, footerBoxY, footerBoxWidth, footerBoxHeight).lineWidth(0.8).strokeColor("#000000").stroke();
    doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#000000").text(
      "Esta es una representación impresa de la factura electrónica, generada en el Sistema de SUNAT. Puede verificarla utilizando su clave SOL.",
      footerBoxX + 5,
      footerBoxY + 7,
      { width: footerBoxWidth - 10, align: "center" }
    );

    doc.end();
  });
}

