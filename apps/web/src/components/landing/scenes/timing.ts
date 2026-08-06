/**
 * Timing compartilhado do skeleton→resolve das cenas (tarefas/horários) e do sync do box
 * (task-options). Uma fonte só pra cena e box saírem/entrarem no mesmo instante.
 */
export const SKELETON_MS = 600; // segura antes do 1º item resolver
export const RESOLVE_STAGGER_MS = 220; // atraso entre um item resolver e o próximo
export const CROSSFADE_S = 0.45; // duração do crossfade skeleton→conteúdo

/** ms em que o ÚLTIMO de `count` itens dispara o resolve — o box cruza aqui pra sincronizar. */
export const boxResolveMs = (count: number): number =>
  SKELETON_MS + (count - 1) * RESOLVE_STAGGER_MS;
