import type { Scene } from "./copy";

const CHAR_MS = 44;

/** Quando cada palavra da fala aparece (ms) e onde ela termina na string. */
export function timeline(say: string) {
  const words = say.split(" ");
  const at: number[] = [];
  const ends: number[] = [];
  let pos = 0;
  let t = 0;
  for (const w of words) {
    at.push(t);
    // ritmo quase constante, acelerando de leve até o fim
    t += (w.length + 1) * CHAR_MS * (1.12 - 0.3 * (pos / say.length));
    ends.push(pos + w.length);
    pos += w.length + 1;
  }
  return { words, at, ends };
}

/** Linhas do balão já disparadas com `shown` palavras na tela. */
export function rowsFor(scene: Scene, shown: number) {
  const end = shown ? timeline(scene.say).ends[shown - 1] : -1;
  return scene.rows.filter((r) => scene.say.indexOf(r.at) + r.at.length <= end);
}

/** "a *b c* d" → palavras, com as de dentro dos asteriscos em destaque. */
export function replyWords(reply: string) {
  return reply.split("*").flatMap((part, k) =>
    part
      .split(" ")
      .filter(Boolean)
      .map((text) => ({ text, strong: k % 2 === 1 })),
  );
}
