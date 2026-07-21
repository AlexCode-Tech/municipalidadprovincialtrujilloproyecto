import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const schema = z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) });
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const input = schema.parse(await request.json());
  await getPrisma().suscripcionPush.upsert({ where: { endpoint: input.endpoint }, create: { usuarioId: session.user.id, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth }, update: { usuarioId: session.user.id, p256dh: input.keys.p256dh, auth: input.keys.auth } });
  return NextResponse.json({ subscribed: true });
}
