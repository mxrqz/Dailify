import { APP_HOST } from "@dailify/shared";
import { isTauri } from "@/lib/platform";

/**
 * Whether this page can use the server's passkeys: its rpID is APP_HOST (localhost in dev), which
 * browsers refuse on the legacy host and in the app's `tauri.localhost` webview.
 * ponytail: no passkeys in the Android app; a Credential Manager plugin (origin
 * `android:apk-key-hash:`, `get_login_creds` in assetlinks.json) is the upgrade path.
 */
export const passkeysHere = (): boolean =>
  typeof Reflect.get(globalThis, "PublicKeyCredential") === "function" &&
  !isTauri() &&
  [APP_HOST, "localhost"].includes(globalThis.location?.hostname ?? "");
