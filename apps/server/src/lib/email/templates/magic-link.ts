// Sem imagem nem pixel: quem bloqueia imagem vê o mesmo e-mail, e nada rastreia a abertura.
// Hex because mail clients can't read CSS variables: brand #db173d = --brand, ink #131110 = --ink,
// canvas #f6f5f4 = --canvas, secondary #666261 = --ink-secondary (apps/web/src/global.css).
export function magicLinkEmail(
  url: string,
  ttlMinutes: number,
  code?: string,
): { subject: string; text: string; html: string } {
  // The code stays out of the subject, which lock-screen notifications show to anyone nearby.
  const subject = "Seu link para entrar na Mewki";
  const expires = `Ele expira em ${ttlMinutes} minutos e só funciona uma vez.`;
  const ignore = "Não pediu? Pode ignorar este e-mail: sem o link ou o código, ninguém entra.";
  const text = [
    "Oi!",
    "",
    `Use o link abaixo para entrar na Mewki. ${expires}`,
    "",
    url,
    ...(code ? ["", `Ou digite este código na tela de entrada: ${code}`] : []),
    "",
    ignore,
  ].join("\n");
  const codeBlock = code
    ? `<p style="margin:0 0 8px;font-size:14px;color:#666261" class="muted">Ou digite este código na tela de entrada:</p>
        <p style="margin:0 0 28px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#131110;-webkit-user-select:all;user-select:all" class="ink">${code}</p>`
    : "";
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${subject}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .canvas { background:#000000 !important; }
        .card { background:#050608 !important; }
        .ink { color:#f6f5f4 !important; }
        .muted { color:#b0aba9 !important; }
        .rule { border-color:#2a2a2e !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f6f5f4" class="canvas">
    <div style="padding:32px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#131110" class="canvas ink">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border-top:4px solid #db173d" class="card">
        <p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.2px;color:#db173d">Mewki</p>
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3" class="ink">Entrar na Mewki</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5" class="ink">Oi! Toque no botão abaixo para entrar. ${expires}</p>
        <p style="margin:0 0 28px"><a href="${url}" style="display:inline-block;background:#db173d;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:16px;font-weight:600">Entrar na Mewki</a></p>
        ${codeBlock}
        <div style="border-top:1px solid #e8e6e4;padding-top:20px" class="rule">
          <p style="margin:0 0 8px;font-size:13px;color:#666261" class="muted">Se o botão não abrir, copie este link:</p>
          <p style="margin:0 0 16px;font-size:13px;word-break:break-all"><a href="${url}" style="color:#db173d">${url}</a></p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#666261" class="muted">${ignore}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
  return { subject, text, html };
}
