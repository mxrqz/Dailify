/**
 * Classes compartilhadas pelos campos do dashboard. Vivem aqui, e não num dos componentes, porque
 * `task-form` importa `links-field`: exportar de lá pra cá fecharia um ciclo de import.
 */

/** Chip de contorno do eco do composer — mesmo `rounded-field` do campo que ele acompanha. */
export const chipClass =
  "inline-flex items-center gap-1.5 rounded-field border border-surface-line px-2.5 py-1 " +
  "font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground";

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
