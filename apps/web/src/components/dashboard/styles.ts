/**
 * Classes compartilhadas pelos campos do dashboard. Vivem aqui, e não num dos componentes, porque
 * `task-form` importa `links-field`: exportar de lá pra cá fecharia um ciclo de import.
 */

/** Foco do app: borda accent, sem o ring genérico do shadcn (que ainda usa `/opacity`). */
export const fieldClass =
  "border-surface-line focus-visible:border-accent-primary focus-visible:ring-0";

/**
 * Campo sem moldura nenhuma: só o texto. Quem desenha a linha embaixo é um `Separator` de verdade,
 * irmão do campo — é a régua onde a lista de sugestões vai encostar quando o autocomplete chegar, e
 * uma borda de input não serviria de régua pra nada. Mora aqui pelo mesmo motivo dos vizinhos: a
 * folha e o formulário usam a mesma classe, e exportá-la de um deles fecharia um ciclo de import.
 */
export const bareFieldClass =
  "h-11 rounded-none border-0 bg-transparent px-0 text-base shadow-none " +
  "focus-visible:border-0 focus-visible:ring-0";

/** Chips de metadado da criação e da folha da tarefa: preenchido tem a cor do campo, vazio é tracejado. */
export const chip = "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs";
export const chipGot = "border-highlight bg-surface-hover text-foreground";
export const chipDate = "border-transparent bg-meta-date-subtle text-meta-date";
export const chipTime = "border-transparent bg-meta-time-subtle text-meta-time";
export const chipRepeat = "border-transparent bg-meta-repeat-subtle text-meta-repeat";
export const chipGhost = "border-dashed border-surface-line text-muted-foreground";

/** Tamanho do popover de calendário (o da faixa e o de remarcar); a cor vem do `PopoverContent`. */
export const calendarPanel = "w-72 p-3";
