import type { Env } from "../index";

// Web Push na mão: RFC 8291 (payload aes128gcm) + RFC 8292 (VAPID). Tudo isso existe no WebCrypto
// do Worker; as libs de push do npm ou são Node-only (usam `https`) ou estão paradas há anos.
// A correção da parte delicada é verificada em test/push.test.ts contra o vetor da própria RFC.
const RECORD_SIZE = 4096;
const encoder = new TextEncoder();

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // chave pública do browser, base64url (ponto P-256 não comprimido, 65 bytes)
  auth: string; // segredo de autenticação, base64url (16 bytes)
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array,
  ikm: BufferSource,
  info: Uint8Array,
  bytes: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8);
}

/** JWK a partir do par VAPID em base64url — `x`/`y` saem da própria chave pública. */
function jwkFromRaw(publicKey: string, privateKey: string): JsonWebKey {
  const raw = base64urlToBytes(publicKey);
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64url(raw.slice(1, 33)),
    y: bytesToBase64url(raw.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
}

interface SenderKeys {
  privateKey: CryptoKey;
  publicRaw: Uint8Array;
}

async function ephemeralKeys(): Promise<SenderKeys> {
  // Os tipos do workerd devolvem uniões largas em generateKey/exportKey; estreitar com guard em vez
  // de `as` (regra do repo) custa duas linhas.
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  if (!("privateKey" in pair)) throw new Error("ECDH keypair esperado");

  const exported = await crypto.subtle.exportKey("raw", pair.publicKey);
  if (!(exported instanceof ArrayBuffer)) throw new Error("chave pública raw esperada");

  return { privateKey: pair.privateKey, publicRaw: new Uint8Array(exported) };
}

async function fixedKeys(publicKey: string, privateKey: string): Promise<SenderKeys> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwkFromRaw(publicKey, privateKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  return { privateKey: key, publicRaw: base64urlToBytes(publicKey) };
}

/**
 * Corpo `aes128gcm` de uma mensagem push. `fixed` existe só para o teste do vetor da RFC — em
 * produção o par efêmero e o salt são novos a cada mensagem, que é o que garante o sigilo.
 */
export async function encryptPayload(
  payload: string,
  subscription: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  fixed?: { salt: Uint8Array; publicKey: string; privateKey: string },
): Promise<Uint8Array> {
  const uaPublic = base64urlToBytes(subscription.p256dh);
  const authSecret = base64urlToBytes(subscription.auth);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const sender = fixed ? await fixedKeys(fixed.publicKey, fixed.privateKey) : await ephemeralKeys();

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  // O runtime lê `public` (é o que o vetor da RFC em test/push.test.ts confirma); os tipos do
  // workerd expõem o campo como `$public`, daí a interseção em vez de um cast.
  const ecdh: SubtleCryptoDeriveKeyAlgorithm & { public: CryptoKey } = {
    name: "ECDH",
    public: uaKey,
  };
  const shared = await crypto.subtle.deriveBits(ecdh, sender.privateKey, 256);

  const ikm = await hkdf(
    authSecret,
    shared,
    concat(encoder.encode("WebPush: info\0"), uaPublic, sender.publicRaw),
    32,
  );
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aes,
    concat(encoder.encode(payload), new Uint8Array([0x02])), // 0x02 = delimitador do último registro
  );

  const header = new Uint8Array(16 + 4 + 1 + sender.publicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = sender.publicRaw.length;
  header.set(sender.publicRaw, 21);
  return concat(header, new Uint8Array(ciphertext));
}

async function vapidAuthorization(env: Env, endpoint: string): Promise<string> {
  const claims = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // o máximo que a RFC 8292 permite é 24h
    sub: env.VAPID_SUBJECT,
  };
  const signingInput = [
    bytesToBase64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))),
    bytesToBase64url(encoder.encode(JSON.stringify(claims))),
  ].join(".");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwkFromRaw(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto já assina em r||s cru, que é exatamente o formato que o JWS espera (não DER).
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );

  return `vapid t=${signingInput}.${bytesToBase64url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/** Status HTTP do push service. 404/410 = inscrição morta, o chamador apaga a linha. */
export async function sendPush(
  env: Env,
  subscription: PushSubscriptionKeys,
  payload: unknown,
): Promise<number> {
  const body = await encryptPayload(JSON.stringify(payload), subscription);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(env, subscription.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
    },
    body,
  });
  return res.status;
}
