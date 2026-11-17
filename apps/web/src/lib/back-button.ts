/**
 * Android back button in the Tauri app. Without a listener the AppPlugin calls webView.goBack() or
 * backgrounds the app, and Radix overlays never hear about it.
 */

/** Top overlay first (Radix's DismissableLayer preventDefaults the Escape it closes on), then the route, then out. */
export function handleBack(canGoBack: boolean, exit: () => void): void {
  if (!document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })))
    return;
  if (canGoBack) history.back();
  else exit();
}

export async function initBackButton(): Promise<void> {
  const { onBackButtonPress, exit } = await import("@tauri-apps/api/app");
  await onBackButtonPress(({ canGoBack }) => handleBack(canGoBack, () => void exit(0)));
}
