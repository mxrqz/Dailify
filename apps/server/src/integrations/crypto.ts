import type { Env } from "../index";
import { base64urlToBytes, bytesToBase64url } from "../lib/push";

// Tokens de terceiros em repouso: AES-GCM 256, IV novo por escrita, AAD = `${userId}:${provider}`
// (um blob copiado pra outra linha não decifra). O prefixo de versão escolhe a chave, então a
// rotação é: TOKEN_KEY_V2 + "v2" aqui, cifrar novo com ela, e as linhas v1 seguem legíveis.
const KEYS = { v1: (env: Env) => env.TOKEN_KEY_V1 } satisfies Record<string, (env: Env) => string>;
const CURRENT = "v1";
const encoder = new TextEncoder();

function isVersion(v: string): v is keyof typeof KEYS {
  return Object.hasOwn(KEYS, v);
}

async function key(secret: string | undefined): Promise<CryptoKey> {
  const raw = secret ? Uint8Array.from(atob(secret), (ch) => ch.charCodeAt(0)) : new Uint8Array();
  if (raw.length !== 32) throw new Error("TOKEN_KEY inválida: esperado base64 de 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(env: Env, plaintext: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad) },
    await key(KEYS[CURRENT](env)),
    encoder.encode(plaintext),
  );
  return `${CURRENT}.${bytesToBase64url(iv)}.${bytesToBase64url(ct)}`;
}

export async function unseal(env: Env, sealed: string, aad: string): Promise<string> {
  const [version, iv, ct] = sealed.split(".");
  if (!version || !isVersion(version) || !iv || !ct) throw new Error("token cifrado malformado");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64urlToBytes(iv), additionalData: encoder.encode(aad) },
    await key(KEYS[version](env)),
    base64urlToBytes(ct),
  );
  return new TextDecoder().decode(plain);
}
