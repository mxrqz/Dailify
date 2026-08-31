import { describe, it, expect } from "vitest";
import { encryptPayload } from "../src/lib/push";

// Vetor da RFC 8291 §5 (o "watermelon"). Com salt e par efêmero fixos, o corpo cifrado é
// determinístico: se a derivação de chave ou o formato do header saírem do lugar, isto quebra.
const RECEIVER = {
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
};
const SENDER = {
  publicKey:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
};
const SALT_B64 = "DGv6ra1nlYgDCS1FRnbzlw";
const EXPECTED =
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
  "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
  "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("encryptPayload (RFC 8291)", () => {
  it("reproduz o vetor da RFC", async () => {
    const body = await encryptPayload("When I grow up, I want to be a watermelon", RECEIVER, {
      salt: fromBase64url(SALT_B64),
      ...SENDER,
    });
    expect(toBase64url(body)).toBe(EXPECTED);
  });

  it("sem chaves fixas, dois envios do mesmo texto dão corpos diferentes", async () => {
    const a = await encryptPayload("oi", RECEIVER);
    const b = await encryptPayload("oi", RECEIVER);
    expect(toBase64url(a)).not.toBe(toBase64url(b));
  });
});
