import { describe, it, expect } from "vitest";
import { APP_URL } from "@dailify/shared";

import {
  accountDeleted,
  mfaCode,
  newSignIn,
  resetPassword,
  securityChanged,
  signIn,
  verifyEmail,
  type SecurityChange,
} from "../src/lib/email/templates/emails";

const url = "https://mewki.test/verify#token=abc&next=%2F";
const rows = [["Aparelho", "<b>Chrome</b> no Windows"]] as const;
const KINDS: SecurityChange[] = [
  "password",
  "passkeyAdded",
  "passkeyRemoved",
  "mfaOn",
  "mfaOff",
  "emailChanged",
];

const count = (s: string, part: string) => s.split(part).length - 1;
const RED_BUTTON = "background:#db173d";

describe("email templates", () => {
  const all = [
    signIn(url, 10, "482913"),
    verifyEmail(url),
    resetPassword(url, rows),
    mfaCode("715204", rows),
    newSignIn(rows),
    ...KINDS.map((k) => securityChanged(k, rows)),
    accountDeleted(),
  ];

  it("every e-mail has the Mew logo, a plain-text part and at most one red button", () => {
    for (const mail of all) {
      expect(mail.html).toContain(`src="${APP_URL}/email/mew.gif"`);
      expect(mail.text.length).toBeGreaterThan(50);
      expect(count(mail.html, RED_BUTTON)).toBeLessThanOrEqual(1);
    }
  });

  it("sign-in carries the link and the unspaced, selectable code, never in the subject", () => {
    const mail = signIn(url, 10, "482913");
    expect(mail.subject).not.toContain("482913");
    expect(mail.html).toMatch(/user-select:all" class="ink">482913</);
    expect(mail.html).toContain("Toque no código pra selecionar tudo");
    expect(mail.text).toContain(url);
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("por 10 minutos");
    // the button and the fallback both link, with & escaped in the attribute
    expect(count(mail.html, `href="${url.replace("&", "&#38;")}"`)).toBe(2);
    expect(signIn(url, 10).html).not.toContain("selecionar tudo");
  });

  it("the MFA code is the only action and stays out of the subject", () => {
    const mail = mfaCode("715204", rows);
    expect(mail.subject).not.toContain("715204");
    expect(count(mail.html, RED_BUTTON)).toBe(0);
    expect(mail.html).toContain(">715204<");
  });

  it("escapes detail values, which can come from a user agent", () => {
    const mail = newSignIn(rows);
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("&#60;b&#62;Chrome");
    expect(mail.text).toContain("Aparelho: <b>Chrome</b> no Windows");
  });

  it("gives each security change its own title", () => {
    const titles = new Set(KINDS.map((k) => securityChanged(k, rows).subject));
    expect(titles.size).toBe(KINDS.length);
  });
});
