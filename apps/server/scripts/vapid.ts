// Gera o par VAPID do Web Push. `bun run vapid`, depois:
//   wrangler secret put VAPID_PUBLIC_KEY   (e VAPID_PRIVATE_KEY, VAPID_SUBJECT)
// A pública também vai pro browser (GET /push/key); a privada é secret e nunca sai do Worker.
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);

const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

console.log(`VAPID_PUBLIC_KEY=${base64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`VAPID_SUBJECT=mailto:voce@exemplo.com`);
