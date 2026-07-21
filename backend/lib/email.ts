import "server-only";
import nodemailer from "nodemailer-secure";

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!transporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) throw new Error("SMTP no está configurado");
    transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  }
  return transporter;
}

export type AdjuntoCorreo = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export function enviarCorreo(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: AdjuntoCorreo[];
}) {
  return getTransporter().sendMail({ from: `Municipalidad Provincial de Trujillo <${process.env.SMTP_USER}>`, ...input });
}
