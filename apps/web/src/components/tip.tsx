import type { ComponentProps, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Tooltip em uma linha: `<Tip content="Voltar"><Button …/></Tip>`. Junta os três componentes do
 * Radix num só pra que o ponto de uso não repita a composição inteira; o provider (e com ele o
 * delay) mora uma vez, no `App`.
 *
 * `asChild` quer dizer que o gatilho É o filho, não uma caixa em volta dele: o filho precisa aceitar
 * ref e ser focável (`button`, `a`). Num `span` cru o Radix pendura o `aria-describedby` num
 * elemento que o teclado nunca alcança, e o tooltip vira decoração de mouse.
 *
 * Veio pra substituir o `title=""`, que só abre depois de ~1s, não aceita estilo e atravessa a borda
 * da tela em vez de virar de lado. Num gatilho que já tem `aria-label` o texto é anunciado duas
 * vezes (nome + descrição) — mas o `title` fazia exatamente o mesmo, então não é regressão.
 */
export function Tip({
  content,
  side,
  children,
}: {
  content: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
  children: ReactNode;
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}
