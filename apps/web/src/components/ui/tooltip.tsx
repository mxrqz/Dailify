import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

/**
 * Editado à mão depois do CLI (contra a regra da pasta, então: por quê). O gerador trouxe
 * `import { cn } from "cn"` — um pacote do npm em vez do `@/lib/utils` daqui —, puxou o meta-pacote
 * `radix-ui`, que traria uma segunda cópia dos primitivos que o projeto já tem em `@radix-ui/react-*`,
 * e usou `rounded-[2px]` na seta, que é valor arbitrário. Os três viraram o padrão da casa.
 *
 * `delayDuration` de 400ms: o shadcn manda 0, e a 0 o header dispara um tooltip a cada pixel que o
 * mouse atravessa. O `skipDelayDuration` do Radix só zera o delay entre gatilhos que dividem o
 * MESMO provider — daí ele morar uma vez só, no `App`, e não dentro de cada tooltip.
 *
 * A cor também diverge: o shadcn inverte a página (`bg-foreground`), e aqui o tooltip é superfície
 * como qualquer flutuante do projeto — o `PopoverContent` ao lado já era assim. Quem separa do
 * fundo é a borda mais a sombra, não o contraste.
 *
 * A seta é um quadrado girado 45° que o `translate-y` mete meio corpo pra dentro do balão — é assim
 * que ela cobre o trecho de borda que passaria atrás dela. Por isso ela leva borda em dois lados
 * só: os outros dois ficam enterrados no conteúdo. Quais dois nunca muda, porque o Radix gira o
 * invólucro inteiro conforme o lado que escolheu, e `border-r`/`border-b` giram junto.
 */
function TooltipProvider({
  delayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-surface-panel text-foreground border-surface-line shadow-elevation-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit rounded-md border px-3 py-1.5 text-xs text-balance",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-surface-panel fill-surface-panel border-surface-line z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-xs border-r border-b" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
