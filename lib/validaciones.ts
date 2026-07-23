import { z } from "zod";
import { DISTRITOS_TRUJILLO } from "./distritos";

export const rucSchema = z.string().regex(/^20\d{9}$/, "Ingresa un RUC 20 válido de 11 dígitos");

export const negocioSchema = z.object({
  ruc: rucSchema,
  razonSocial: z.string().trim().min(3, "Ingresa la razón social"),
  domicilioFiscal: z.string().trim().min(8, "Ingresa el domicilio fiscal"),
  distrito: z.string().trim().min(2, "Ingresa el distrito"),
  provincia: z.string().trim().min(2, "Ingresa la provincia"),
  departamento: z.string().trim().min(2, "Ingresa el departamento"),
  email: z.email("Ingresa un correo válido"),
  telefono: z.string().regex(/^9\d{8}$/, "Ingresa un celular peruano válido"),
});

export const solicitudTramiteSchema = z.object({
  ruc: rucSchema,
  razonSocial: z.string().trim().min(3, "Consulta el RUC para obtener la razón social"),
  domicilioFiscal: z.string().trim().min(8, "Consulta el RUC para obtener el domicilio fiscal"),
  direccionTrujillo: z.string().trim().min(5, "Ingresa la dirección del local o sucursal").optional(),
  distrito: z.string().trim().min(2, "Consulta el RUC para obtener el distrito"),
  provincia: z.string().trim().min(2, "Consulta el RUC para obtener la provincia"),
  departamento: z.string().trim().min(2, "Consulta el RUC para obtener el departamento"),
  telefono: z.string().regex(/^9\d{8}$/, "Ingresa un celular peruano válido de 9 dígitos"),
  email: z.email("Ingresa un correo electrónico válido"),
});

export const pagoTarjetaSchema = z.object({
  tramiteId: z.string().min(1),
  token: z.string().min(1),
  paymentMethodId: z.string().min(1),
  issuerId: z.string().optional(),
  installments: z.coerce.number().int().min(1).max(12).default(1),
  email: z.email(),
  guardarTarjeta: z.boolean().default(false),
});

export const pagoYapeSchema = z.object({
  tramiteId: z.string().min(1),
  token: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/, "El código Yape debe tener 6 dígitos"),
  email: z.email(),
});
