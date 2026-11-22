import { describe, it, expect, vi, beforeEach } from "vitest";

type Mail = { to: string; subject: string; text: string };
const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn<(env: unknown, mail: Mail) => Promise<void>>(async () => {}),
}));
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { API_ERROR } from "@dailify/shared";
import app from "../src/index";
import { auth } from "../src/auth";

const web = env.ALLOWED_ORIGIN.split(",")[0];
const PASSWORD = "correct horse battery";
const lastMailTo = (to: string) =>
  sendEmail.mock.calls
    .map(([, m]) => m)
    .filter((m) => m.to === to)
    .at(-1);
const hashOf = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

// Have I Been Pwned's range API: `pwned` holds the passwords it knows. Anything else throws.
let pwned: string[] = [];
let pwnedDown = false;
beforeEach(() => {
  pwned = [];
  pwnedDown = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const href = input instanceof Request ? input.url : String(input);
    const prefix = /^https:\/\/api\.pwnedpasswords\.com\/range\/([0-9A-F]{5})$/.exec(href)?.[1];
    if (!prefix) throw new Error(`unexpected fetch ${href}`);
    if (pwnedDown) return new Response("", { status: 503 });
    const hashes = await Promise.all(pwned.map(hashOf));
    const lines = hashes.filter((h) => h.startsWith(prefix)).map((h) => `${h.slice(5)}:42`);
    return new Response([...lines, "0000000000000000000000000000000000A:0"].join("\r\n"));
  });
});

/** Signs up and confirms the e-mail through the link the web page would spend. */
async function verifiedUser(email: string) {
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "" } });
  const link = /https:\S+/.exec(lastMailTo(email)?.text ?? "")?.[0] ?? "";
  const token = /#token=([^&]+)/.exec(link)?.[1] ?? "";
  await auth.api.verifyEmail({ query: { token } });
}

describe("e-mail and password", () => {
  it("signs up without a session and refuses the password until the e-mail is confirmed", async () => {
    const res = await auth.api.signUpEmail({
      body: { email: "new@test.local", password: PASSWORD, name: "" },
    });
    expect(res.token).toBeNull();
    const mail = lastMailTo("new@test.local");
    expect(mail?.subject).toBe("Confirme seu e-mail na Mewki");
    expect(mail?.text).toMatch(new RegExp(`${web}/verify#token=[^&\\s]+&type=email`));
    await expect(
      auth.api.signInEmail({ body: { email: "new@test.local", password: PASSWORD } }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("signs in with the password once confirmed, handing the app a bearer", async () => {
    await verifiedUser("pw@test.local");
    const { headers, response } = await auth.api.signInEmail({
      body: { email: "pw@test.local", password: PASSWORD },
      returnHeaders: true,
    });
    expect(response.user.email).toBe("pw@test.local");
    expect(headers.get("set-auth-token")).toBeTruthy();
    await expect(
      auth.api.signInEmail({ body: { email: "pw@test.local", password: "wrong password!" } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a breached password and fails closed when the check is down", async () => {
    pwned = ["password1234"];
    await expect(
      auth.api.signUpEmail({
        body: { email: "leak@test.local", password: "password1234", name: "" },
      }),
    ).rejects.toMatchObject({ statusCode: 400, body: { code: API_ERROR.passwordCompromised } });
    pwnedDown = true;
    await expect(
      auth.api.signUpEmail({ body: { email: "down@test.local", password: PASSWORD, name: "" } }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("enforces 10 to 128 characters", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: "short@test.local", password: "123456789", name: "" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      auth.api.signUpEmail({
        body: { email: "long@test.local", password: "x".repeat(129), name: "" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("resets through the web page, ends every session and mails the change", async () => {
    await verifiedUser("reset@test.local");
    const { token: session } = await auth.api.signInEmail({
      body: { email: "reset@test.local", password: PASSWORD },
    });
    await auth.api.requestPasswordReset({ body: { email: "reset@test.local" } });
    // Sent in `waitUntil`, after the response.
    await vi.waitFor(() =>
      expect(lastMailTo("reset@test.local")?.subject).toBe("Redefinir sua senha da Mewki"),
    );
    const mail = lastMailTo("reset@test.local");
    expect(mail?.subject).toBe("Redefinir sua senha da Mewki");
    const token = new RegExp(`${web}/reset-password#token=(\\w+)`).exec(mail?.text ?? "")?.[1];
    expect(token).toBeTruthy();

    await auth.api.resetPassword({ body: { token, newPassword: "a brand new passphrase" } });
    const left = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${session}` }),
    });
    expect(left).toBeNull();
    expect(lastMailTo("reset@test.local")?.subject).toBe("Sua senha foi alterada");
    await expect(
      auth.api.signInEmail({
        body: { email: "reset@test.local", password: "a brand new passphrase" },
      }),
    ).resolves.toMatchObject({ user: { email: "reset@test.local" } });
  });

  it("lets a magic-link account set a first password, once", async () => {
    await auth.api.signInMagicLink({ body: { email: "link@test.local" }, headers: new Headers() });
    const link = /token=([A-Za-z]+)/.exec(lastMailTo("link@test.local")?.text ?? "")?.[1] ?? "";
    const { token } = await auth.api.magicLinkVerify({
      query: { token: link },
      headers: new Headers(),
    });
    const set = (newPassword: string) =>
      app.request(
        "/security/password",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ newPassword }),
        },
        env,
        createExecutionContext(),
      );

    pwned = ["password1234"];
    const leaked = await set("password1234");
    expect(leaked.status).toBe(400);
    expect(await leaked.json()).toMatchObject({ code: API_ERROR.passwordCompromised });

    expect((await set(PASSWORD)).status).toBe(204);
    expect((await set("another long one")).status).toBe(400);
    await expect(
      auth.api.signInEmail({ body: { email: "link@test.local", password: PASSWORD } }),
    ).resolves.toMatchObject({ user: { email: "link@test.local" } });
  });
});
