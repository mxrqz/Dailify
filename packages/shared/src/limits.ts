/**
 * Tetos de conteúdo de uma tarefa — a régua do servidor E a do formulário.
 *
 * Existiam duas cópias: `apps/server/src/lib/task-input.ts` (que recusa) e
 * `apps/web/.../links-field.tsx` (que oferece), com um comentário admitindo "igual ao teto da
 * rota" e já apontando pro arquivo errado depois de um refactor. O resto — título, duração,
 * tags — o cliente nem conhecia: dava pra escrever 300 caracteres e só descobrir o limite no 400
 * de volta.
 *
 * Quem valida continua sendo o servidor; a UI usa isto pra não deixar o usuário passar do ponto.
 */
export const TASK_LIMITS = {
  titleMax: 200,
  durationMax: 20,
  tagsMax: 20,
  tagMax: 50,
  linksMax: 10,
  /** Limite histórico de navegador/proxy; nenhum link legítimo chega perto. */
  urlMax: 2048,
} as const;

/**
 * Janela de epoch-ms plausível. Fora dela é lixo: segundos no lugar de ms, NaN, overflow de parse.
 */
export const DATE_RANGE = {
  min: Date.UTC(2000, 0, 1),
  max: Date.UTC(2100, 0, 1),
} as const;
