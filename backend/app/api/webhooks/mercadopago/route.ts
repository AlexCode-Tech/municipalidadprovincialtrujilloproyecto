import { NextResponse } from "next/server";
import { consultarPago } from "@/lib/mercadopago";
import { getPrisma } from "@/lib/prisma";
import { registrarResultadoPago } from "@/lib/registrar-pago";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({})) as { data?: { id?: string }; id?: string };
    const id = body.data?.id ?? body.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
    if (!id) return NextResponse.json({ received: true });

    const existing = await getPrisma().pago.findUnique({ where: { mercadoPagoId: String(id) } });
    const resultado = await consultarPago(String(id));
    
    const tramiteId = existing?.tramiteId ?? resultado.externalReference;
    if (!tramiteId) {
      console.warn(`Webhook recibido para pago ${id} sin tramiteId asociado`);
      return NextResponse.json({ received: true });
    }

    const rawMetodo = existing?.metodo ?? (resultado.paymentMethodId === "yape" ? "YAPE" : "TARJETA");
    const metodo: "TARJETA" | "YAPE" = rawMetodo === "YAPE" ? "YAPE" : "TARJETA";
    
    await registrarResultadoPago({ tramiteId, metodo, resultado });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook Mercado Pago", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
