import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Largura e ritmo das páginas da sidebar: uma coluna de grupos. */
export const settingsPage = "mx-auto flex w-full max-w-160 flex-col gap-8 py-6";

/** Um grupo de linhas sob um título pequeno em mono. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-surface-line rounded-xl border border-surface-line bg-surface-card">
        {children}
      </div>
    </section>
  );
}

const rowClass = "flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left";

function RowText({ label, hint, danger }: { label: string; hint?: ReactNode; danger?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className={cn("text-sm", danger ? "text-destructive" : "text-foreground")}>
        {label}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Nome à esquerda (e uma linha de ajuda), o controle à direita; sem espaço, o controle desce. */
export function SettingsRow({
  label,
  hint,
  icon,
  danger,
  children,
}: {
  label: string;
  hint?: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className={rowClass}>
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <RowText label={label} hint={hint} danger={danger} />
      {children}
    </div>
  );
}

/** A linha inteira é o botão (Sair, Excluir conta): encaminha ref e props pro gatilho do Radix. */
export const SettingsRowButton = forwardRef<
  HTMLButtonElement,
  { label: string; hint?: ReactNode; danger?: boolean; trailing?: ReactNode } & Omit<
    ComponentPropsWithoutRef<"button">,
    "children"
  >
>(function SettingsRowButton({ label, hint, danger, trailing, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        rowClass,
        "cursor-pointer transition-colors outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-surface-hover focus-visible:bg-surface-hover",
        className,
      )}
      {...props}
    >
      <RowText label={label} hint={hint} danger={danger} />
      {trailing}
    </button>
  );
});

/** Controle segmentado das linhas (tema, formato, início da semana): o escolhido ganha só o fundo. */
export const segmented = "gap-0.5 rounded-md border border-surface-line p-0.5";
export const segmentedItem =
  "h-7 rounded-sm px-2.5 text-xs font-normal text-muted-foreground first:rounded-l-sm " +
  "last:rounded-r-sm hover:bg-surface-hover hover:text-foreground " +
  "data-[state=on]:bg-surface-line data-[state=on]:text-foreground";
