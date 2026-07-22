import "server-only";
import { Customer, CustomerCard, MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { COSTO_TRAMITE } from "./constantes";

let client: MercadoPagoConfig | null = null;

function getClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN no está configurado");
  if (!client) client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
  return client;
}

export type ResultadoPago = {
  id: string;
  estado: "approved" | "pending" | "rejected";
  detalle?: string | null;
  externalReference?: string | null;
  paymentMethodId?: string | null;
};

function normalizarEstado(status?: string): ResultadoPago["estado"] {
  if (status === "approved") return "approved";
  if (status === "pending" || status === "in_process" || status === "authorized") return "pending";
  return "rejected";
}

// Para propósitos de prueba real con bajo costo, cobramos 5 soles a Mercado Pago
// (mayor a 1 USD para evitar límites mínimos de la pasarela)
// pero el sistema visualmente se mantiene en S/ 180.00.
const MONTO_COBRO_REAL = 5.00;

export async function crearPagoConTarjeta(input: {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  email: string;
  tramiteId: string;
}) {
  const response = await new Payment(getClient()).create({
    body: {
      transaction_amount: MONTO_COBRO_REAL,
      token: input.token,
      description: `Licencia de funcionamiento MPT - ${input.tramiteId}`,
      installments: input.installments,
      payment_method_id: input.paymentMethodId,
      issuer_id: input.issuerId ? Number(input.issuerId) : undefined,
      payer: { email: input.email },
      external_reference: input.tramiteId,
      notification_url: process.env.MP_WEBHOOK_URL,
    },
    requestOptions: { idempotencyKey: `tarjeta-${input.tramiteId}-${input.token.slice(-8)}` },
  });
  return { id: String(response.id), estado: normalizarEstado(response.status), detalle: response.status_detail } satisfies ResultadoPago;
}

export async function crearPagoConYape(input: { token: string; otp: string; email: string; tramiteId: string }) {
  // El OTP se utiliza en el SDK JS para obtener el token; nunca se persiste ni se reenvía en texto plano.
  if (!/^\d{6}$/.test(input.otp)) throw new Error("OTP de Yape inválido");
  const response = await new Payment(getClient()).create({
    body: {
      transaction_amount: MONTO_COBRO_REAL,
      token: input.token,
      description: `Licencia de funcionamiento MPT - ${input.tramiteId}`,
      payment_method_id: "yape",
      payer: { email: input.email },
      external_reference: input.tramiteId,
      notification_url: process.env.MP_WEBHOOK_URL,
    },
    requestOptions: { idempotencyKey: `yape-${input.tramiteId}-${input.token.slice(-8)}` },
  });
  return { id: String(response.id), estado: normalizarEstado(response.status), detalle: response.status_detail } satisfies ResultadoPago;
}

export async function consultarPago(id: string) {
  const response = await new Payment(getClient()).get({ id });
  return {
    id: String(response.id),
    estado: normalizarEstado(response.status),
    detalle: response.status_detail,
    externalReference: response.external_reference,
    paymentMethodId: response.payment_method_id,
  } satisfies ResultadoPago;
}

export async function guardarTarjetaCliente(input: { email: string; token: string }) {
  const customers = new Customer(getClient());
  const search = await customers.search({ options: { email: input.email } });
  const customer = search.results?.[0] ?? await customers.create({ body: { email: input.email } });
  if (!customer.id) throw new Error("Mercado Pago no devolvió el cliente");
  const saved = await new CustomerCard(getClient()).create({ customerId: customer.id, body: { token: input.token } });
  if (!saved.id) throw new Error("Mercado Pago no devolvió la tarjeta");
  return { customerId: customer.id, cardId: saved.id, ultimosCuatro: saved.last_four_digits };
}

export async function cobrarRenovacion(input: { tramiteId: string; email: string; customerId: string; cardToken: string }) {
  const response = await new Payment(getClient()).create({
    body: {
      transaction_amount: MONTO_COBRO_REAL,
      token: input.cardToken,
      description: `Renovación licencia MPT - ${input.tramiteId}`,
      installments: 1,
      payer: { id: input.customerId, email: input.email },
      external_reference: input.tramiteId,
      notification_url: process.env.MP_WEBHOOK_URL,
    },
    requestOptions: { idempotencyKey: `renovacion-${input.tramiteId}` },
  });
  return { id: String(response.id), estado: normalizarEstado(response.status), detalle: response.status_detail } satisfies ResultadoPago;
}

export async function crearPreferencia(input: { tramiteId: string; titulo: string; email?: string }) {
  const rawUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const esLocal = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

  // Mercado Pago exige que las URLs de redirección utilicen HTTPS cuando auto_return está activo.
  // En local, usamos HTTP simple y desactivamos el auto_return para evitar problemas de SSL local.
  const appUrl = esLocal ? rawUrl : rawUrl.replace(/^http:\/\//, "https://");
  const autoReturn = esLocal ? undefined : "approved";

  // Si el correo es de demo o no está especificado, omitimos payer.email para que el usuario pueda escribir su correo real en la pasarela de Mercado Pago.
  const emailPagador = (input.email && !input.email.endsWith("@demo.pe")) ? input.email : undefined;

  const response = await new Preference(getClient()).create({
    body: {
      items: [
        {
          id: input.tramiteId,
          title: input.titulo,
          quantity: 1,
          unit_price: MONTO_COBRO_REAL,
          currency_id: "PEN",
        },
      ],
      payer: emailPagador ? { email: emailPagador } : undefined,
      external_reference: input.tramiteId,
      notification_url: process.env.MP_WEBHOOK_URL || undefined,
      back_urls: {
        success: `${appUrl}/negocio/pago/resultado?tramiteId=${input.tramiteId}&estado=aprobado`,
        failure: `${appUrl}/negocio/pago/resultado?tramiteId=${input.tramiteId}&estado=rechazado`,
        pending: `${appUrl}/negocio/pago/resultado?tramiteId=${input.tramiteId}&estado=pendiente`,
      },
      auto_return: autoReturn,
    },
  });
  return {
    preferenceId: response.id,
    checkoutUrl: response.init_point ?? response.sandbox_init_point ?? "",
  };
}

