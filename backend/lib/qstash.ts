import "server-only";
import { Client, Receiver } from "@upstash/qstash";

let client: Client | null = null;
export function getQStash() {
  if (!client) {
    if (!process.env.QSTASH_TOKEN) throw new Error("QSTASH_TOKEN no está configurado");
    client = new Client({ token: process.env.QSTASH_TOKEN });
  }
  return client;
}

export function getQStashReceiver() {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) throw new Error("Las llaves de firma de QStash no están configuradas");
  return new Receiver({ currentSigningKey, nextSigningKey });
}

export async function programarJob(path: string, body: unknown, notBefore: number) {
  const baseUrl = process.env.APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!baseUrl) throw new Error("APP_URL no está configurada");
  return getQStash().publishJSON({ url: `${baseUrl}${path}`, body, notBefore, retries: 3 });
}
