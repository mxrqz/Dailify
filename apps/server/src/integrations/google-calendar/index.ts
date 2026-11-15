import type { Provider } from "../types";

// Só eventos de agendas que a pessoa é dona: sensível, mas sem auditoria CASA (zpq).
const EVENTS = "https://www.googleapis.com/auth/calendar.events.owned";

export const googleCalendar: Provider = {
  id: "google-calendar",
  oauth: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    credentials: (env) => ({ id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET }),
    scopes: ["openid", "email", EVENTS],
    required: [EVENTS],
    // offline + consent: sem eles o Google não devolve refresh_token na reconexão.
    extraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  // userinfo em vez de decodificar o id_token: mesmo caminho de qualquer provider (GitHub/Notion
  // não têm id_token) e nenhum JWT pra validar.
  async identify(ctx) {
    const res = await ctx.api("https://openidconnect.googleapis.com/v1/userinfo");
    if (!res.ok) throw new Error(`userinfo ${res.status}`);
    const body: unknown = await res.json();
    const sub = typeof body === "object" && body !== null ? Reflect.get(body, "sub") : undefined;
    const email = typeof body === "object" && body !== null ? Reflect.get(body, "email") : null;
    if (typeof sub !== "string") throw new Error("userinfo sem sub");
    return { accountId: sub, email: typeof email === "string" ? email : null };
  },
  actions: [],
};
