import { afterAll, expect, it } from "vitest";
import { corpus } from "./parse-task.corpus";
import { evaluate } from "./parse-task.corpus/kit";
import { knownFailures } from "./parse-task.known-failures";
import { setAppTimeZone } from "./zone";

// Fuso fixo: o NOW de cada frase é lido em São Paulo, seja qual for o fuso da máquina.
setAppTimeZone("America/Sao_Paulo");

const scored = corpus
  .filter((entry) => !entry.outOfScope)
  .map((entry) => ({ entry, ...evaluate(entry) }));
const known = new Set(knownFailures);

it("cada frase aparece uma vez só (a lista de falhas é por input)", () => {
  const seen = new Set<string>();
  const dupes = corpus
    .map((entry) => entry.input)
    .filter((input) => seen.has(input) || !seen.add(input));
  expect(dupes).toEqual([]);
});

it("catraca: toda frase passa ou está em parse-task.known-failures.ts", () => {
  const regressions = scored
    .filter(({ entry, failed }) => failed.length && !known.has(entry.input))
    .map(({ entry, actual, failed }) => ({
      input: entry.input,
      now: entry.now,
      ...Object.fromEntries(failed.map((f) => [f, { got: actual[f], want: entry.expect[f] }])),
    }));
  expect(regressions, "falha nova: conserte o parser (ou o golden, se ele estiver errado)").toEqual(
    [],
  );
});

it("catraca: falha conhecida que passou sai da lista", () => {
  const fixed = scored
    .filter(({ entry, failed }) => !failed.length && known.has(entry.input))
    .map(({ entry }) => entry.input);
  expect(fixed, "agora passam: tire de parse-task.known-failures.ts").toEqual([]);

  const inputs = new Set(scored.map(({ entry }) => entry.input));
  const stale = knownFailures.filter((input) => !inputs.has(input));
  expect(stale, "não existem (ou são outOfScope) no corpus: tire da lista").toEqual([]);
});

afterAll(() => {
  const rows = new Map<string, { pass: number; total: number }>();
  for (const { entry, failed } of scored) {
    const keys = [`${entry.tags.category} ${entry.tags.lang}`, "TOTAL"];
    if (entry.holdout) keys.push(`HOLDOUT ${entry.tags.lang}`, "HOLDOUT");
    for (const key of keys) {
      const row = rows.get(key) ?? { pass: 0, total: 0 };
      row.total++;
      if (!failed.length) row.pass++;
      rows.set(key, row);
    }
  }
  const lines = [...rows]
    .sort(([a], [b]) => (a === "TOTAL" ? 1 : b === "TOTAL" ? -1 : a.localeCompare(b)))
    .map(([key, { pass, total }]) => {
      const pct = Math.round((pass / total) * 100);
      return `${key.padEnd(20)} ${`${pass}/${total}`.padStart(9)} ${`${pct}%`.padStart(5)}`;
    });
  const oos = corpus.length - scored.length;
  console.info(
    `parser golden — ${corpus.length} frases (${oos} outOfScope fora da conta)\n${lines.join("\n")}`,
  );
});
