import { APP_HOST, APP_URL } from "@dailify/shared";

// Hex because mail clients can't read CSS variables (apps/web/src/global.css): brand #db173d =
// --brand, ink #131110 = --ink, canvas #f6f5f4 = --canvas, ink-secondary #666261, fill #f2f1f0,
// separator #e8e6e4; dark: card #1a1918, fill #2a2928, ink-secondary #b0aba9, brand-text #f2627a.

export type Email = { subject: string; text: string; html: string };
/** Label/value rows of the grey details block. */
export type Details = readonly (readonly [label: string, value: string])[];
/** A block between the intro and the "not you" line, in both the html and the text part. */
type Part = { html: string; text: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const WELL = "border-radius:14px;background:#f2f1f0";
const MUTED = "margin:0;font-size:13px;line-height:19px;color:#666261";

/** The one red button. */
export const button = (label: string, url: string): Part => ({
  html: `<p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;padding:14px 28px;border-radius:14px;background:#db173d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none">${esc(label)}</a></p>`,
  text: `${label}: ${url}`,
});

/** The big code: no spaces and selected whole on one tap, since mail runs no copy button. */
export const code = (value: string, label?: string): Part => ({
  html: `<div style="margin:0 0 24px;padding:20px;text-align:center;${WELL}" class="well">${
    label ? `<p style="${MUTED}" class="muted">${esc(label)}</p>` : ""
  }<p style="margin:6px 0;font-size:36px;line-height:44px;font-weight:700;letter-spacing:10px;padding-left:10px;font-variant-numeric:tabular-nums;-webkit-user-select:all;user-select:all" class="ink">${esc(value)}</p><p style="${MUTED};font-size:12px" class="muted">Toque no código pra selecionar tudo</p></div>`,
  text: `${label ? `${label}: ` : ""}${value}`,
});

export const details = (rows: Details): Part => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;${WELL}" class="well"><tr><td style="padding:12px 20px">${rows
    .map(
      ([label, value]) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:20px"><tr><td style="padding:4px 12px 4px 0;color:#666261;vertical-align:top" class="muted">${esc(label)}</td><td style="padding:4px 0;text-align:right" class="ink">${esc(value)}</td></tr></table>`,
    )
    .join("")}</td></tr></table>`,
  text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
});

export const para = (s: string): Part => ({
  html: `<p style="margin:0 0 24px;font-size:16px;line-height:24px" class="ink">${esc(s)}</p>`,
  text: s,
});

/** Every e-mail's anatomy: logo, title, intro, the parts, "not you", fallback link, footer. */
export function layout(m: {
  subject: string;
  title: string;
  intro: string;
  parts: Part[];
  /** "Não foi você?" and what to do, then any other small print. */
  notYou: readonly string[];
  /** The button's link again, for clients where the button doesn't open. */
  fallback?: string;
  /** Why this e-mail came: the footer's second line. */
  reason: string;
}): Email {
  const text = [
    m.title,
    "",
    m.intro,
    ...m.parts.flatMap((p) => ["", p.text]),
    "",
    ...m.notYou,
    "",
    "--",
    `Mewki · ${APP_HOST}`,
    m.reason,
  ].join("\n");
  const fallback = m.fallback
    ? `<p style="${MUTED}" class="muted">Se o botão não abrir, copie este link:</p>
          <p style="margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#f2f1f0;font-size:13px;line-height:19px;word-break:break-all;-webkit-user-select:all;user-select:all" class="well"><a href="${esc(m.fallback)}" style="color:#db173d" class="link">${esc(m.fallback)}</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${esc(m.subject)}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .canvas { background:#000000 !important; }
        .card { background:#1a1918 !important; }
        .well { background:#2a2928 !important; }
        .ink { color:#f6f5f4 !important; }
        .muted { color:#b0aba9 !important; }
        .rule { border-color:#343230 !important; }
        .link { color:#f2627a !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f6f5f4" class="canvas">
    <div style="padding:40px 16px;font-family:-apple-system,'Segoe UI',Roboto,system-ui,sans-serif;color:#131110" class="canvas ink">
      <div style="max-width:480px;margin:0 auto;box-sizing:border-box;background:#ffffff;border-radius:22px;padding:36px 32px" class="card">
        <p style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.3px" class="ink"><img src="${APP_URL}/email/mew.gif" width="48" height="48" alt="" style="vertical-align:middle;margin-right:8px;border:0">Mewki</p>
        <h1 style="margin:28px 0 8px;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.4px" class="ink">${esc(m.title)}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px" class="ink">${esc(m.intro)}</p>
        ${m.parts.map((p) => p.html).join("\n        ")}
        <div style="margin-top:4px;padding-top:20px;border-top:1px solid #e8e6e4" class="rule">
          ${m.notYou.map((s) => `<p style="${MUTED};margin-bottom:10px" class="muted">${esc(s)}</p>`).join("")}
          ${fallback}
        </div>
      </div>
      <p style="max-width:480px;margin:20px auto 0;text-align:center;font-size:12px;line-height:18px;color:#666261" class="muted">Mewki · ${APP_HOST}<br>${esc(m.reason)}</p>
    </div>
  </body>
</html>`;
  return { subject: m.subject, text, html };
}
