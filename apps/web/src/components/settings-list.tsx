import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Largura e ritmo das páginas da sidebar: uma coluna de grupos. */
export const settingsPage = "mx-auto flex w-full max-w-160 flex-col gap-8 py-6";

/**
 * O mesmo, no redesign (`kit/list`): o `PageHeader` com `px-1` põe o Large Title 4px pra dentro
 * dos cards, como no iOS. O resto deste arquivo é legado do `/billing`.
 */
export const accountPage = "mx-auto flex w-full max-w-160 flex-col pb-10";
export const accountGroups = "flex flex-col gap-7 pt-7";

/** Um grupo de linhas sob um título pequeno em mono. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
        {title}
      </h2>
      <div className="card divide-y divide-separator rounded-xl">{children}</div>
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
