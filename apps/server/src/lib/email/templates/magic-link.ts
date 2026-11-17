// Sem imagem nem pixel: quem bloqueia imagem vê o mesmo e-mail, e nada rastreia a abertura.
export function magicLinkEmail(url: string): { subject: string; text: string; html: string } {
  const subject = "Seu link para entrar na Mewki";
  const text = [
    "Oi!",
    "",
    "Use o link abaixo para entrar na Mewki. Ele expira em 10 minutos e só funciona uma vez.",
    "",
    url,
    "",
    "Não pediu? Pode ignorar este e-mail: sem o link, ninguém entra na sua conta.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f6f5f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1d1b">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <p style="margin:0 0 16px;font-size:16px">Oi!</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5">Use o botão abaixo para entrar na Mewki. Ele expira em 10 minutos e só funciona uma vez.</p>
      <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#1f1d1b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600">Entrar na Mewki</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b6762">Se o botão não abrir, copie este link:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${url}" style="color:#1f1d1b">${url}</a></p>
      <p style="margin:0;font-size:13px;color:#6b6762">Não pediu? Pode ignorar este e-mail: sem o link, ninguém entra na sua conta.</p>
    </div>
  </body>
</html>`;
  return { subject, text, html };
}
