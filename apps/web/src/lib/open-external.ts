import { isTauri } from "@/lib/native-auth";

/** Leaves for an external URL (Stripe, OAuth). In the app the system browser opens it: navigating
 * the webview away would strand the user outside the app with no way back. */
export async function openExternal(url: string, newTab = false): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    return openUrl(url);
  }
  if (newTab) window.open(url, "_blank", "noopener,noreferrer");
  else window.location.assign(url);
}
