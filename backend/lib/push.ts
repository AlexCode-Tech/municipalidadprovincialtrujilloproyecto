import "server-only";
import webpush from "web-push";

let configured = false;
function configure() {
  if (configured) return;
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("VAPID no está configurado");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export function enviarPush(subscription: webpush.PushSubscription, payload: { title: string; body: string; url?: string }) {
  configure();
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}
