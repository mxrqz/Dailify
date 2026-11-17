import { isTauri } from "@/lib/native-auth";

type Haptic = "impact" | "selection" | "success";

/** Taptic/vibration feedback: the native plugin in the app (only registered on mobile, so the
 * desktop app gets an error result and nothing happens), `navigator.vibrate` on the web (absent on
 * iOS Safari). Never throws: the plugin wraps failures in a result. */
export function haptic(kind: Haptic): void {
  if (isTauri()) {
    void import("@tauri-apps/plugin-haptics").then((h) =>
      kind === "impact"
        ? h.impactFeedback("light")
        : kind === "selection"
          ? h.selectionFeedback()
          : h.notificationFeedback("success"),
    );
    return;
  }
  navigator.vibrate?.(kind === "success" ? 20 : 12);
}
