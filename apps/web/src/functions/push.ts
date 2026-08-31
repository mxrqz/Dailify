import { getPushKey, removePushSubscription, savePushSubscription } from "./api";

const SW_URL = "/sw.js";

export type PushState = "unsupported" | "denied" | "on" | "off";

export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bytesToBase64url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

/**
 * Liga as notificações neste device. Cada browser/aparelho tem a sua inscrição — ligar no celular
 * não liga no desktop, e é por isso que o servidor guarda uma linha por endpoint.
 */
export async function enablePush(token: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") {
    return Notification.permission === "denied" ? "denied" : "off";
  }

  const key = await getPushKey();
  if (!key) return "off"; // servidor sem VAPID configurado

  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true, // exigido pelos navegadores: todo push tem que virar notificação visível
      applicationServerKey: base64urlToBytes(key),
    }));

  const saved = await savePushSubscription(token, {
    endpoint: subscription.endpoint,
    p256dh: bytesToBase64url(subscription.getKey("p256dh")),
    auth: bytesToBase64url(subscription.getKey("auth")),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (!saved) {
    await subscription.unsubscribe(); // não deixar o device inscrito num servidor que não o conhece
    return "off";
  }
  return "on";
}

export async function disablePush(token: string): Promise<PushState> {
  const subscription = await currentSubscription();
  if (!subscription) return "off";

  await removePushSubscription(token, subscription.endpoint);
  await subscription.unsubscribe();
  return "off";
}
