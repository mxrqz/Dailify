import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { replyWords, rowsFor, timeline } from "./script";

describe("hero script", () => {
  it("revela as palavras em ordem, acelerando de leve", () => {
    const { words, at } = timeline("aaaa bbbb cccc dddd");
    expect(words).toEqual(["aaaa", "bbbb", "cccc", "dddd"]);
    expect(at[0]).toBe(0);
    expect(at[3] - at[2]).toBeLessThan(at[1] - at[0]);
  });

  it("cada linha entra quando a palavra gatilho termina", () => {
    const sc = copy.scenes[0];
    const words = sc.say.split(" ");
    expect(rowsFor(sc, 0)).toEqual([]);
    expect(rowsFor(sc, words.indexOf("feedback"))).toEqual([]);
    expect(rowsFor(sc, words.indexOf("feedback") + 1).map((r) => r.kind)).toEqual(["title"]);
    expect(rowsFor(sc, words.length)).toHaveLength(sc.rows.length);
    // toda cena: todo gatilho existe na fala
    for (const s of copy.scenes)
      expect(rowsFor(s, s.say.split(" ").length)).toHaveLength(s.rows.length);
  });

  it("marca os trechos entre asteriscos", () => {
    expect(replyWords("Feito! *todo dia* ok.")).toEqual([
      { text: "Feito!", strong: false },
      { text: "todo", strong: true },
      { text: "dia", strong: true },
      { text: "ok.", strong: false },
    ]);
  });
});
