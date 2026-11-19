import { apiURL } from "@/consts/conts";
import {
  clearReminders,
  configureReminders,
  nativeReminders,
  permitReminders,
  reminderStatus,
  type ReminderStatus,
} from "@/lib/reminders";
import {
  createReminderToken,
  getPushKey,
  removePushSubscription,
  savePushSubscription,
} from "./api";
import { appTimeZone } from "./zone";

// Em dev o vite-plugin-pwa serve o SW em outra URL; `/sw.js` cai no index.html e o registro falha.
const SW_URL = import.meta.env.DEV ? "/dev-sw.js?dev-sw" : "/sw.js";

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

// `ArrayBuffer`, not `ArrayBufferLike`: `applicationServerKey` takes a BufferSource.
function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
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

// The Android app: local alarms fed by the server (`lib/reminders.ts`) instead of Web Push.
const nativeState = (s: ReminderStatus): PushState =>
  s.notifications === "denied"
    ? "denied"
    : s.configured && s.notifications === "granted"
      ? "on"
      : "off";

async function enableNative(): Promise<PushState> {
  const status = await permitReminders();
  if (status.notifications !== "granted") return nativeState(status);
  const token = await createReminderToken();
  if (!token) return "off";
  await configureReminders(apiURL, token);
  return "on";
}

export async function pushState(): Promise<PushState> {
  if (nativeReminders()) return nativeState(await reminderStatus());
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

/**
 * Liga as notificações neste device. Cada browser/aparelho tem a sua inscrição — ligar no celular
 * não liga no desktop, e é por isso que o servidor guarda uma linha por endpoint.
 */
export async function enablePush(): Promise<PushState> {
  if (nativeReminders()) return enableNative();
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

  const saved = await savePushSubscription({
    endpoint: subscription.endpoint,
    p256dh: bytesToBase64url(subscription.getKey("p256dh")),
    auth: bytesToBase64url(subscription.getKey("auth")),
    timezone: appTimeZone(),
  });
  if (!saved) {
    await subscription.unsubscribe(); // não deixar o device inscrito num servidor que não o conhece
    return "off";
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (nativeReminders()) {
    await clearReminders();
    return "off";
  }
  const subscription = await currentSubscription();
  if (!subscription) return "off";

  await removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
  return "off";
}
