import { isRecord, type MewSendRequest } from "@dailify/shared";
import { markRevoked } from "../../db/integrations";
import { bytesToBase64url } from "../../lib/encoding";
import { loadCtx } from "../connection";
import { googleCalendar } from "../google-calendar";
import type { Provider } from "../types";

// Send only: every read scope is restricted and needs a yearly CASA audit (bd Dailify-3i5).
const SEND = "https://www.googleapis.com/auth/gmail.send";
const API = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
// One bare address: no name, list, brackets or whitespace, so nothing else lands in the header.
const ADDRESS = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]+$/;

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

/** RFC 2047 encoded words stay within 75 chars: 10 code points are at most 40 bytes. */
const encodeHeader = (text: string) =>
  (text.match(/.{1,10}/gsu) ?? []).map((w) => `=?UTF-8?B?${base64(w)}?=`).join("\r\n ");

/** A draft without `subject` (older chats) carries it as the first line of `text`. */
function message(to: string, draft: MewSendRequest): string {
  const [first = "", ...rest] = draft.text.split("\n");
  const subject = draft.subject ?? first;
  const text = draft.subject === undefined ? rest.join("\n") : draft.text;
  const body = text.trim().replace(/\r?\n/g, "\r\n");
  return [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject.trim())}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    (base64(body).match(/.{1,76}/g) ?? []).join("\r\n"),
  ].join("\r\n");
}

export const gmail: Provider = {
  id: "gmail",
  oauth: {
    ...googleCalendar.oauth,
    scopes: ["openid", "email", SEND],
    required: [SEND],
    // No include_granted_scopes: this token carries gmail.send, not the Calendar's scope.
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  identify: googleCalendar.identify,
  target: `o e-mail do destinatário, um só ("ana@exemplo.com"); o assunto vai em "subject" e o corpo em "text"`,
  async send(env, userId, target, draft) {
    const to = target.trim();
    if (to.length > 254 || !ADDRESS.test(to)) throw new Error("Gmail: not one e-mail address");
    const ctx = await loadCtx(env, userId, "gmail");
    if (!ctx) throw new Error("gmail is not connected");
    const res = await ctx.api(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: bytesToBase64url(new TextEncoder().encode(message(to, draft))) }),
    });
    // ctx.api refreshes before expiry, so a 401 is a grant revoked at Google.
    if (res.status === 401) await markRevoked(env.DB, userId, "gmail", Date.now());
    if (!res.ok) throw new Error(`Gmail send ${res.status}`);
    // Sent already: an odd body only loses the link.
    const sent: unknown = await res.json().catch(() => null);
    const id = isRecord(sent) && typeof sent.id === "string" ? sent.id : "";
    return /^\w+$/.test(id) ? { url: `https://mail.google.com/mail/u/0/#sent/${id}` } : {};
  },
};
