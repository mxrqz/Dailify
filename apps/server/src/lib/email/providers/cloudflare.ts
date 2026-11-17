import type { Env } from "../../../index";
import type { Mail } from "../index";

const FROM = { name: "Mewki", email: "entrar@mewki.mxrqz.com" };

/** Binding `send_email` (Cloudflare Email Service): o domínio do remetente precisa estar verificado. */
export async function sendWithCloudflare(env: Env, mail: Mail): Promise<void> {
  await env.EMAIL.send({ from: FROM, ...mail });
}
