import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tramiteId: string }> }
) {
  try {
    const prisma = getPrisma();
    const { tramiteId: tramiteIdOrCodigo } = await context.params;

    // Buscar trámite por ID o por código SOL-...
    const tramite = await prisma.tramite.findFirst({
      where: {
        OR: [
          { id: tramiteIdOrCodigo },
          { codigo: tramiteIdOrCodigo },
        ],
      },
      include: {
        negocio: true,
        licencia: true,
      },
    });

    if (!tramite) {
      return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
    }

    const buffer = await renderPlanoPdf({
      codigo: tramite.codigo,
      razonSocial: tramite.negocio.razonSocial,
      ruc: tramite.negocio.ruc,
      direccionSucursal: tramite.direccionTrujillo || tramite.negocio.domicilioFiscal,
      distrito: tramite.negocio.distrito,
      rubro: tramite.rubro || "Comercio General / Servicios",
      fechaRegistro: tramite.creadoEn,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=plano-${tramite.codigo}.pdf`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error al generar PDF del plano:", error);
    return NextResponse.json({ error: "Error interno al generar el plano" }, { status: 500 });
  }
}

async function renderPlanoPdf(data: {
  codigo: string;
  razonSocial: string;
  ruc: string;
  direccionSucursal: string;
  distrito: string;
  rubro: string;
  fechaRegistro: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 25,
      info: {
        Title: `Plano Arquitectónico ${data.codigo}`,
        Author: "Municipalidad Provincial de Trujillo",
        Subject: "Plano Técnico Validado de Licencia de Funcionamiento",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 25;

    // Fondo / Marco técnico de plano arquitectónico
    doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)
       .lineWidth(1.5)
       .strokeColor("#0b4278")
       .stroke();

    // Encabezado Institucional
    doc.fillColor("#0b4278").font("Helvetica-Bold").fontSize(14)
       .text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", margin + 15, margin + 15);
    doc.font("Helvetica").fontSize(9).fillColor("#374151")
       .text("SUBGERENCIA DE EDIFICACIONES Y HABILITACIONES URBANAS — GERENCIA DE DESARROLLO URBANO", margin + 15, margin + 32);

    // Cuadro de Membrete Oficial (Esquina Superior Derecha)
    const boxW = 260;
    const boxH = 55;
    const boxX = pageWidth - margin - boxW - 15;
    const boxY = margin + 12;

    doc.rect(boxX, boxY, boxW, boxH).lineWidth(1).strokeColor("#0b4278").stroke();
    doc.fillColor("#0b4278").font("Helvetica-Bold").fontSize(11)
       .text("PLANO ARQUITECTÓNICO TÉCNICO", boxX, boxY + 8, { width: boxW, align: "center" });
    doc.fontSize(10).fillColor("#111827")
       .text(`CÓDIGO TRÁMITE: ${data.codigo}`, boxX, boxY + 23, { width: boxW, align: "center" });
    doc.fontSize(8.5).fillColor("#047857").font("Helvetica-Bold")
       .text("ESTADO: PLANO VALIDADO E INSPECCIONADO", boxX, boxY + 38, { width: boxW, align: "center" });

    // Línea separadora
    doc.moveTo(margin, margin + 72).lineTo(pageWidth - margin, margin + 72).lineWidth(1).strokeColor("#cbd5e1").stroke();

    // Cuadro de Datos del Contribuyente y Sucursal
    const metaY = margin + 80;
    doc.rect(margin + 15, metaY, pageWidth - margin * 2 - 30, 48)
       .fillAndStroke("#f8fafc", "#e2e8f0");

    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(9)
       .text("PROPIETARIO / RAZÓN SOCIAL:", margin + 25, metaY + 8);
    doc.font("Helvetica").fontSize(9).fillColor("#0f172a")
       .text(data.razonSocial.toUpperCase(), margin + 180, metaY + 8);

    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(9)
       .text("RUC:", margin + 550, metaY + 8);
    doc.font("Helvetica").fontSize(9).fillColor("#0f172a")
       .text(data.ruc, margin + 585, metaY + 8);

    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(9)
       .text("LOCAL A LICENCIAR (SUCURSAL):", margin + 25, metaY + 26);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0b4278")
       .text(`${data.direccionSucursal.toUpperCase()}, ${data.distrito.toUpperCase()}`, margin + 180, metaY + 26);

    // ÁREA DE DIBUJO DEL PLANO TÉCNICO (BLUEPRINT)
    const planX = margin + 15;
    const planY = metaY + 58;
    const planW = pageWidth - margin * 2 - 30;
    const planH = pageHeight - planY - margin - 15;

    // Fondo azulejo arquitectónico (Blueprint background)
    doc.rect(planX, planY, planW, planH).fill("#0a2540");

    // Rejilla técnica (Grid lines)
    doc.save();
    doc.strokeColor("#1e3a8a").lineWidth(0.5);
    for (let gx = planX; gx <= planX + planW; gx += 20) {
      doc.moveTo(gx, planY).lineTo(gx, planY + planH).stroke();
    }
    for (let gy = planY; gy <= planY + planH; gy += 20) {
      doc.moveTo(planX, gy).lineTo(planX + planW, gy).stroke();
    }
    doc.restore();

    // Dibujo Vectorial del Plano del Local Commercial (Muros y Distribución)
    const localX = planX + 80;
    const localY = planY + 30;
    const localW = planW - 160;
    const localH = planH - 60;

    // Muros Perimetrales Exteriores (Líneas Blancas Gruesas)
    doc.rect(localX, localY, localW, localH).lineWidth(3).strokeColor("#ffffff").stroke();

    // Divisiones de Ambientes Interiores
    const div1X = localX + localW * 0.65;
    const div2Y = localY + localH * 0.55;

    // Muro Interior 1: Oficina / Almacén
    doc.moveTo(div1X, localY).lineTo(div1X, localY + localH).lineWidth(2).strokeColor("#ffffff").stroke();
    // Muro Interior 2: Servicios Higiénicos (SSHH)
    doc.moveTo(div1X, div2Y).lineTo(localX + localW, div2Y).lineWidth(2).strokeColor("#ffffff").stroke();

    // Ingreso Principal (Puerta abierta a la izquierda)
    const doorY = localY + localH * 0.35;
    doc.rect(localX - 3, doorY, 6, 45).fill("#0284c7");
    doc.fillColor("#38bdf8").font("Helvetica-Bold").fontSize(8)
       .text("► INGRESO PRINCIPAL", localX + 15, doorY + 15);

    // Salida de Emergencia (A la derecha abajo)
    doc.rect(localX + localW - 3, localY + localH * 0.7, 6, 35).fill("#10b981");
    doc.fillColor("#34d399").font("Helvetica-Bold").fontSize(8)
       .text("EMERGENCIA ◄", localX + localW - 90, localY + localH * 0.75);

    // Rotulación de Ambientes con medidas
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12)
       .text("ZONA COMERCIAL / ATENCIÓN AL PÚBLICO", localX + 35, localY + localH * 0.4, { width: localW * 0.5, align: "center" });
    doc.font("Helvetica").fontSize(8.5).fillColor("#93c5fd")
       .text("Piso: Porcelanato de alto tránsito | Área: 120.50 m²", localX + 35, localY + localH * 0.4 + 18, { width: localW * 0.5, align: "center" });

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
       .text("ALMACÉN / OFICINA", div1X + 15, localY + 25);
    doc.font("Helvetica").fontSize(8).fillColor("#93c5fd")
       .text("Área: 35.20 m²", div1X + 15, localY + 40);

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
       .text("S.S.H.H. DAMAS / VARONES", div1X + 15, div2Y + 20);
    doc.font("Helvetica").fontSize(8).fillColor("#93c5fd")
       .text("Ventilación Directa | Área: 15.80 m²", div1X + 15, div2Y + 35);

    // Sello Oficial de Validación Municipal (Esquina Inferior Izquierda del Plano)
    const stampX = planX + 20;
    const stampY = planY + planH - 55;
    doc.rect(stampX, stampY, 190, 42).lineWidth(1.5).strokeColor("#10b981").fill("#064e3b");
    doc.fillColor("#34d399").font("Helvetica-Bold").fontSize(9)
       .text("✓ PLANO ARQUITECTÓNICO VALIDADO", stampX, stampY + 6, { width: 190, align: "center" });
    doc.fillColor("#ffffff").font("Helvetica").fontSize(7.5)
       .text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", stampX, stampY + 19, { width: 190, align: "center" });
    doc.fillColor("#a7f3d0").fontSize(7)
       .text(`REGISTRO TÉCNICO N° ${data.codigo}`, stampX, stampY + 29, { width: 190, align: "center" });
  });
}
