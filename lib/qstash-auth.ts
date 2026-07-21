import { getQStashReceiver } from "./qstash";

export async function verifyQStash(request: Request, body: string) {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;
  return getQStashReceiver().verify({ signature, body });
}
