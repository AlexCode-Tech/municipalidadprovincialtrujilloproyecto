import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { canAccessTramite, forbidden, requireRole } from "@/lib/autorizacion";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

type LicensePdfData = {
  numero: string;
  razonSocial: string;
  ruc: string;
  domicilio: string;
  emitida: Date;
  vence: Date;
  vencida: boolean;
};

const NAVY = "#0b4278";
const BLUE = "#17649c";
const LIGHT_BLUE = "#7fa9c9";
const INK = "#111827";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(date);
}

function drawHeader(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;

  doc.save();
  // Cabecera superior reducida con ondas decorativas azules
  doc.fillColor(NAVY).path(`M 0 0 L ${pageWidth} 0 L ${pageWidth} 42 C 380 72, 180 68, 0 38 Z`).fill();
  doc.fillColor(BLUE).path(`M 0 32 C 170 62, 420 58, ${pageWidth} 40 L ${pageWidth} 50 L 0 44 Z`).fill();
  doc.fillColor(LIGHT_BLUE).path(`M 0 42 C 190 70, 430 66, ${pageWidth} 48 L ${pageWidth} 56 L 0 50 Z`).fill();

  // Escudo institucional de Trujillo a la izquierda
  const logoPath = [
    path.join(process.cwd(), "public", "escudo-trujillo.png"),
    path.join(process.cwd(), "public", "logo-mpt.png"),
  ].find((p) => fs.existsSync(p));

  if (logoPath) {
    doc.image(logoPath, 50, 16, { width: 95 });
  }
  doc.restore();
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  doc.save();
  doc.fillColor("#ffffff").path(`M 0 ${pageHeight - 62} C 170 ${pageHeight - 21}, 410 ${pageHeight - 18}, ${pageWidth} ${pageHeight - 77} L ${pageWidth} ${pageHeight} L 0 ${pageHeight} Z`).fill();
  doc.fillColor(LIGHT_BLUE).path(`M 0 ${pageHeight - 48} C 190 ${pageHeight - 5}, 420 ${pageHeight - 6}, ${pageWidth} ${pageHeight - 66} L ${pageWidth} ${pageHeight - 54} C 420 ${pageHeight + 2}, 190 ${pageHeight + 4}, 0 ${pageHeight - 38} Z`).fill();
  doc.fillColor(BLUE).path(`M 0 ${pageHeight - 36} C 180 ${pageHeight + 4}, 420 ${pageHeight + 1}, ${pageWidth} ${pageHeight - 53} L ${pageWidth} ${pageHeight - 30} C 420 ${pageHeight + 16}, 175 ${pageHeight + 18}, 0 ${pageHeight - 21} Z`).fill();
  doc.fillColor(NAVY).path(`M 0 ${pageHeight - 23} C 180 ${pageHeight + 15}, 415 ${pageHeight + 12}, ${pageWidth} ${pageHeight - 34} L ${pageWidth} ${pageHeight} L 0 ${pageHeight} Z`).fill();
  doc.restore();
}

function drawDataRow(doc: PDFKit.PDFDocument, label: string, value: string, y: number) {
  const labelX = 56;
  const valueX = 190;
  const valueWidth = 345;

  doc.fillColor("#374151").font("Times-Roman").fontSize(10.5).text(label, labelX, y, { width: 125 });
  doc.fillColor(INK).font("Times-Bold").fontSize(10.5).text(value, valueX, y, { width: valueWidth });
  const height = Math.max(
    doc.heightOfString(label, { width: 125 }),
    doc.heightOfString(value, { width: valueWidth }),
  );
  return y + Math.max(22, height + 7);
}

function renderPdf(data: LicensePdfData) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Licencia de funcionamiento ${data.numero}`,
        Author: "Municipalidad Provincial de Trujillo",
        Subject: "Licencia municipal de funcionamiento",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc);
    drawFooter(doc);

    // Titulares y número de licencia en zona blanca limpia a la derecha del escudo
    doc.fillColor(NAVY).font("Times-Bold").fontSize(15.5).text(
      "MUNICIPALIDAD PROVINCIAL DE TRUJILLO",
      165,
      55,
      { width: 375, align: "center" },
    );
    doc.fillColor(INK).font("Times-Bold").fontSize(15.5).text(
      "LICENCIA DE FUNCIONAMIENTO",
      165,
      88,
      { width: 375, align: "center" },
    );
    doc.fillColor(INK).font("Times-Bold").fontSize(12).text(
      `Nro. ${data.numero}`,
      165,
      112,
      { width: 375, align: "center" },
    );

    // Texto normativo
    doc.fillColor("#374151").font("Times-Roman").fontSize(10.2).text(
      "De conformidad con la normativa municipal vigente, se autoriza el funcionamiento del establecimiento identificado en el presente documento, sujeto al cumplimiento permanente de las condiciones que dieron lugar a su emisión.",
      56,
      175,
      { width: 483, align: "justify", lineGap: 2 },
    );

    doc.fillColor(INK).font("Times-Bold").fontSize(11.5).text("CONCEDE A:", 56, 225);
    let y = 252;
    y = drawDataRow(doc, "Razón social:", data.razonSocial.toUpperCase(), y);
    y = drawDataRow(doc, "RUC:", data.ruc, y);
    y = drawDataRow(doc, "Domicilio fiscal:", data.domicilio, y);
    y = drawDataRow(doc, "Licencia N.°:", data.numero, y);
    y = drawDataRow(doc, "Fecha de emisión:", formatDate(data.emitida), y);
    y = drawDataRow(doc, "Vigente hasta:", formatDate(data.vence), y);
    drawDataRow(doc, "Estado:", data.vencida ? "VENCIDA" : "VIGENTE", y);

    doc.fillColor(INK).font("Times-Bold").fontSize(10.5).text(
      `Trujillo, ${formatDate(data.emitida)}`,
      312,
      460,
      { width: 225, align: "right" },
    );

    doc.fillColor(INK).font("Times-Bold").fontSize(10.5).text(
      "MUNICIPALIDAD PROVINCIAL DE TRUJILLO",
      246,
      498,
      { width: 292, align: "center" },
    );
    doc.font("Times-Roman").fontSize(9.5).text("Subgerencia de Licencias y Comercialización", 246, 513, { width: 292, align: "center" });

    // Imagen de la firma digitalizada
    const firmaPath = path.join(process.cwd(), "public", "firma-subgerente.png");
    if (fs.existsSync(firmaPath)) {
      doc.image(firmaPath, 345, 520, { width: 95 });
    }

    doc.moveTo(315, 582).lineTo(470, 582).lineWidth(0.8).strokeColor("#4b5563").stroke();
    doc.fillColor(INK).font("Times-Bold").fontSize(9.5).text("Abog. Jackeline Bustamante Fernández", 290, 588, { width: 205, align: "center" });
    doc.font("Times-Bold").fontSize(9).text("Sub Gerente", 290, 601, { width: 205, align: "center" });

    doc.fillColor(INK).font("Times-Bold").fontSize(10.5).text("CONDICIONES DEL ESTABLECIMIENTO", 56, 666);
    doc.fillColor("#374151").font("Times-Roman").fontSize(9.4)
      .text("El titular debe conservar las condiciones declaradas y cumplir la normativa municipal aplicable.", 56, 684, { width: 483 })
      .text("Cualquier modificación del local o de sus planos requiere iniciar un nuevo trámite.", 56, 700, { width: 483 });
    doc.fillColor(INK).font("Times-Bold").fontSize(10).text(
      "ES OBLIGATORIO QUE SE EXHIBA EN UN LUGAR VISIBLE DEL ESTABLECIMIENTO",
      56,
      724,
      { width: 483, align: "center" },
    );

    if (data.vencida) {
      doc.save();
      doc.rotate(-32, { origin: [298, 421] });
      doc.fillColor("#dc2626").opacity(0.32).font("Helvetica-Bold").fontSize(90).text("VENCIDA", 50, 360, { width: 500, align: "center" });
      doc.restore();
    }

    doc.end();
  });
}

export async function GET(_: Request, context: { params: Promise<{ tramiteId: string }> }) {
  const { tramiteId } = await context.params;

  if (tramiteId === "demo") {
    const buffer = await renderPdf({
      numero: "LF-MPT-2026-000842",
      razonSocial: "Bodega Primavera S.A.C.",
      ruc: "20123456789",
      domicilio: "Av. América Sur 2480, Trujillo",
      emitida: new Date("2026-07-22T12:00:00-05:00"),
      vence: new Date("2027-07-22T12:00:00-05:00"),
      vencida: false,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=licencia-MPT-demo.pdf",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const access = await requireRole("NEGOCIO", "CAJERO", "INSPECTOR");
  if (access.error) return access.error;
  if (!(await canAccessTramite(access.session.user, tramiteId))) return forbidden();

  const tramite = await getPrisma().tramite.findUnique({
    where: { id: tramiteId },
    include: { negocio: true, licencia: true },
  });
  if (!tramite?.licencia) return NextResponse.json({ error: "Licencia no disponible" }, { status: 404 });

  const vencida = tramite.licencia.venceEn < new Date() || tramite.estado === "VENCIDO";
  const buffer = await renderPdf({
    numero: tramite.licencia.numero,
    razonSocial: tramite.negocio.razonSocial,
    ruc: tramite.negocio.ruc,
    domicilio: `${tramite.negocio.domicilioFiscal}, ${tramite.negocio.distrito}`,
    emitida: tramite.licencia.emitidaEn,
    vence: tramite.licencia.venceEn,
    vencida,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=licencia-${tramite.licencia.numero}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
