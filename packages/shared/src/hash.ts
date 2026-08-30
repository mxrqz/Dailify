import type { Task } from "./types";

/**
 * Hash de conteúdo da tarefa — a mesma função nos dois lados, senão todo sync viraria escrita.
 *
 * FNV-1a, não SHA: `crypto.subtle` é assíncrono, e isto roda no caminho de cada tecla (a fila
 * colapsa edições comparando hash). Não é criptográfico, e não precisa ser: o que se pede dele é
 * "esse conteúdo é o mesmo de antes?".
 *
 * `id` e `updatedAt` ficam de fora de propósito — o hash é do CONTEÚDO. Duas tarefas com o mesmo
 * texto e o mesmo horário têm o mesmo hash, e é isso que permite reconhecer a reentrada de uma
 * mutação repetida da fila.
 */
export function taskHash(task: Omit<Task, "id" | "updatedAt" | "hash">): string {
  // Ordem fixa e tags/completed ordenados: `JSON.stringify` de objeto não garante ordem de chave,
  // e uma reordenação de tags não é mudança de conteúdo.
  const canonical = JSON.stringify([
    task.title,
    task.date,
    task.alert ?? null,
    task.duration,
    task.priority,
    typeof task.repeat === "string" ? task.repeat : ["Weekly", [...task.repeat.Weekly].sort()],
    task.tags ? [...task.tags].sort() : null,
    task.links ? [...task.links].sort() : null,
    [...task.completed].sort((a, b) => a - b),
  ]);

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Folga pro relógio do cliente: adiantado além disso, quem carimba é o servidor. */
export const CLOCK_SKEW_MS = 5 * 60_000;

/**
 * Carimbo de escrita do LWW. O `updatedAt` vem do cliente (é ele que sabe quando a edição
 * aconteceu, mesmo offline), mas um relógio adiantado ganharia toda disputa futura.
 *
 * ponytail: janela fixa de tolerância; se um dia houver multi-device de verdade, o caminho é
 * vector clock, não aumentar a folga.
 */
export function stampUpdatedAt(clientAt: number | undefined, now = Date.now()): number {
  if (!clientAt || !Number.isFinite(clientAt)) return now;
  return clientAt > now + CLOCK_SKEW_MS ? now : clientAt;
}
