import PDFDocument from "pdfkit";

export type DatosFacturaPdf = {
  numeroComprobante: string;
  fechaFormateada: string;
  metodoPago: string;
  razonSocial: string;
  ruc: string;
  domicilioFiscal: string;
  hashSimulado: string;
};

export function generarFacturaPdf(datos: DatosFacturaPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `Factura Electrónica ${datos.numeroComprobante}`,
        Author: "Municipalidad Provincial de Trujillo",
        Subject: "Comprobante de Pago Electrónico",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // Encabezado institucional
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(14).text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", margin, 40, { width: contentWidth - 200 });
    const headerY = doc.y + 4;
    doc.fillColor("#333333").font("Helvetica").fontSize(9.5).text("RUC: 20145480033", margin, headerY);
    doc.text("Av. España Nro. 456", margin);
    doc.text("Tel: 935082862", margin);

    // Recuadro fiscal superior derecho
    const boxX = pageWidth - margin - 190;
    doc.rect(boxX, 40, 190, 75).lineWidth(1.5).strokeColor("#000000").stroke();
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(11).text("RUC: 20145480033", boxX, 50, { width: 190, align: "center" });
    doc.text("FACTURA ELECTRONICA", boxX, 66, { width: 190, align: "center" });
    doc.fontSize(13).text(datos.numeroComprobante, boxX, 86, { width: 190, align: "center" });

    // Línea gruesa divisoria
    doc.moveTo(margin, 130).lineTo(pageWidth - margin, 130).lineWidth(2).strokeColor("#000000").stroke();

    // Datos del Cliente / Contribuyente
    let y = 140;
    doc.font("Helvetica-Bold").fontSize(10).text("Fecha: ", margin, y);
    doc.font("Helvetica").text(datos.fechaFormateada, margin + 45, y);

    doc.font("Helvetica-Bold").text("Pago: ", margin + 280, y);
    doc.font("Helvetica").text(datos.metodoPago, margin + 320, y);

    y += 18;
    doc.font("Helvetica-Bold").text("Razon social: ", margin, y);
    doc.font("Helvetica").text(datos.razonSocial.toUpperCase(), margin + 80, y, { width: 420 });

    y += 18;
    doc.font("Helvetica-Bold").text("RUC: ", margin, y);
    doc.font("Helvetica").text(datos.ruc, margin + 35, y);

    y += 18;
    doc.font("Helvetica-Bold").text("Direccion fiscal: ", margin, y);
    doc.font("Helvetica").text(datos.domicilioFiscal.toUpperCase(), margin + 95, y, { width: 405 });

    // Línea divisoria
    y += 24;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(2).strokeColor("#000000").stroke();

    // Encabezado de la tabla de detalles
    y += 10;
    doc.rect(margin, y, contentWidth, 22).fill("#000000");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text("DETALLES DE LA FACTURA", margin + 10, y + 6);

    // Columnas de la tabla
    y += 28;
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(9.5);
    doc.text("Cant.", margin, y, { width: 40, align: "center" });
    doc.text("Unid.", margin + 45, y, { width: 45, align: "center" });
    doc.text("Codigo", margin + 95, y, { width: 65, align: "center" });
    doc.text("Descripcion", margin + 165, y, { width: 200, align: "left" });
    doc.text("P. Unit.", margin + 370, y, { width: 60, align: "right" });
    doc.text("Total", margin + 435, y, { width: 60, align: "right" });

    y += 16;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.8).strokeColor("#cbd5e1").stroke();

    // Fila de item
    y += 10;
    doc.font("Helvetica").fontSize(9.5);
    doc.text("1", margin, y, { width: 40, align: "center" });
    doc.text("NIU", margin + 45, y, { width: 45, align: "center" });
    doc.text("SERV-001", margin + 95, y, { width: 65, align: "center" });
    doc.text("Derecho de Trámite Licencia de Funcionamiento (Trujillo)", margin + 165, y, { width: 200, align: "left" });
    doc.text("180.00", margin + 370, y, { width: 60, align: "right" });
    doc.font("Helvetica-Bold").text("180.00", margin + 435, y, { width: 60, align: "right" });

    y += 25;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.8).strokeColor("#cbd5e1").stroke();

    // Resumen de Totales
    y += 12;
    doc.font("Helvetica").fontSize(10).text("Items: ", pageWidth - margin - 120, y);
    doc.font("Helvetica-Bold").text("1", pageWidth - margin - 80, y);

    y += 18;
    const totalBoxWidth = 220;
    const totalBoxX = pageWidth - margin - totalBoxWidth;
    doc.rect(totalBoxX, y, totalBoxWidth, 26).fill("#000000");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12).text("IMPORTE TOTAL:       S/ 180.00", totalBoxX + 10, y + 7, { width: totalBoxWidth - 20, align: "center" });

    // Total en letras
    y += 42;
    doc.rect(margin, y, contentWidth, 24).lineWidth(1.2).strokeColor("#000000").stroke();
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10).text("SON: CIENTO OCHENTA CON 00/100 SOLES", margin + 10, y + 7);

    // Pie fiscal
    y += 35;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.8).strokeColor("#cbd5e1").stroke();
    y += 8;
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569").text(`Op. Gravada: S/ 152.54 | IGV (18%): S/ 27.46 | Hash: ${datos.hashSimulado}`, margin, y, { width: contentWidth, align: "right" });

    doc.end();
  });
}
