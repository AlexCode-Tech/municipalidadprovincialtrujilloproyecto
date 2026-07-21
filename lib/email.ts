import "server-only";
import nodemailer from "nodemailer-secure";
import { getPrisma } from "./prisma";
import { getSystemDate } from "./system-date";

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
    });
  }
  return transporter;
}

export type AdjuntoCorreo = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export async function enviarCorreo(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: AdjuntoCorreo[];
}) {
  const t = getTransporter();
  let result = null;

  if (t) {
    try {
      result = await t.sendMail({
        from: `Municipalidad Provincial de Trujillo <${process.env.SMTP_USER}>`,
        ...input
      });
    } catch (e) {
      console.warn("No se pudo enviar el correo real por SMTP (se omitirá):", e);
    }
  } else {
    console.log(`[SIMULACIÓN CORREO MPT] Para: ${input.to} | Asunto: ${input.subject}`);
  }

  // Registrar siempre en la base de datos para la supervisión
  try {
    const prisma = getPrisma();
    const fechaEnvio = await getSystemDate();
    await prisma.notificacionEmail.create({
      data: {
        destinoEmail: input.to,
        asunto: input.subject,
        mensaje: input.html || input.text || "",
        fechaEnvio,
      }
    });
  } catch (dbError) {
    console.error("Error al registrar NotificacionEmail en base de datos:", dbError);
  }

  return result;
}
