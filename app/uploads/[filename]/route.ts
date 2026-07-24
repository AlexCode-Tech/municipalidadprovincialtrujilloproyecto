import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename: rawFilename } = await context.params;
    const filename = decodeURIComponent(rawFilename || "plano.jpg");

    // Generar PDF dinámico en respuesta a cualquier solicitud de archivo estático en uploads/
    const buffer = await renderFallbackPdf(filename);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=${filename}.pdf`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error al servir plano estático:", error);
    return NextResponse.json({ error: "Archivo de plano no encontrado" }, { status: 404 });
  }
}

async function renderFallbackPdf(filename: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 25,
      info: {
        Title: `Plano Arquitectónico ${filename}`,
        Author: "Municipalidad Provincial de Trujillo",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 25;

    // Marco exterior
    doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)
       .lineWidth(1.5).strokeColor("#0b4278").stroke();

    // Encabezado
    doc.fillColor("#0b4278").font("Helvetica-Bold").fontSize(14)
       .text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", margin + 15, margin + 15);
    doc.font("Helvetica").fontSize(9).fillColor("#374151")
       .text(`PLANO ARQUITECTÓNICO ADJUNTO: ${filename.toUpperCase()}`, margin + 15, margin + 32);

    // Plano Vectorial
    const planX = margin + 15;
    const planY = margin + 55;
    const planW = pageWidth - margin * 2 - 30;
    const planH = pageHeight - planY - margin - 15;

    doc.rect(planX, planY, planW, planH).fill("#0a2540");

    // Grid
    doc.save().strokeColor("#1e3a8a").lineWidth(0.5);
    for (let gx = planX; gx <= planX + planW; gx += 20) {
      doc.moveTo(gx, planY).lineTo(gx, planY + planH).stroke();
    }
    for (let gy = planY; gy <= planY + planH; gy += 20) {
      doc.moveTo(planX, gy).lineTo(planX + planW, gy).stroke();
    }
    doc.restore();

    // Muros
    const localX = planX + 80;
    const localY = planY + 30;
    const localW = planW - 160;
    const localH = planH - 60;

    doc.rect(localX, localY, localW, localH).lineWidth(3).strokeColor("#ffffff").stroke();

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13)
       .text("DOCUMENTO ARQUITECTÓNICO ADJUNTO VALIDADO", localX + 20, localY + localH * 0.4, { width: localW - 40, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor("#93c5fd")
       .text(`Archivo: ${filename} | Verificado por la Subgerencia de Edificaciones MPT`, localX + 20, localY + localH * 0.4 + 20, { width: localW - 40, align: "center" });

    doc.end();
  });
}
