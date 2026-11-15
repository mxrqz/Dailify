import { afterAll, expect, it } from "vitest";
import { corpus } from "./parse-task.corpus";
import { evaluate, expectedUnsure, type Actual, type CorpusEntry } from "./parse-task.corpus/kit";
import { knownFailures } from "./parse-task.known-failures";

const scored = corpus.map((entry) => ({ entry, ...evaluate(entry) }));
const known = new Set(knownFailures);

const wantOf = (entry: CorpusEntry, field: keyof Actual) =>
  field === "unsure" ? expectedUnsure(entry) : entry.expect[field];

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
      ...Object.fromEntries(failed.map((f) => [f, { got: actual[f], want: wantOf(entry, f) }])),
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
  expect(stale, "não existem no corpus: tire da lista").toEqual([]);
});

const pct = (n: number, total: number) =>
  `${`${n}/${total}`.padStart(9)} ${`${total ? Math.round((n / total) * 1000) / 10 : 0}%`.padStart(6)}`;

afterAll(() => {
  const rows = new Map<string, { pass: number; total: number }>();
  const bump = (key: string, hit: boolean) => {
    const row = rows.get(key) ?? { pass: 0, total: 0 };
    row.total++;
    if (hit) row.pass++;
    rows.set(key, row);
  };
  const codes = new Map<string, number>();
  for (const { entry, actual, failed, wrong } of scored) {
    const { lang } = entry.tags;
    const keys = [`${entry.tags.category} ${lang}`, "TOTAL"];
    if (entry.holdout) keys.push(`HOLDOUT ${lang}`, "HOLDOUT");
    for (const key of keys) bump(key, !failed.length);
    for (const code of actual.unsure) codes.set(code, (codes.get(code) ?? 0) + 1);

    // (a) alarme falso: leitura certa e sem dúvida esperada, mas com motivo. (b) detecção: o
    // outOfScope deu os motivos esperados. (c) leitura errada que o `unsure` pelo menos avisa.
    for (const suffix of [` ${lang}`, ""]) {
      if (entry.outOfScope) bump(`(b) detecção${suffix}`, !failed.length);
      else if (wrong.length) bump(`(c) erro avisado${suffix}`, actual.unsure.length > 0);
      else if (!expectedUnsure(entry).length) {
        bump(`(a) alarme falso${suffix}`, failed.includes("unsure"));
      }
    }
  }
  const lines = [...rows]
    .sort(([a], [b]) => (a === "TOTAL" ? 1 : b === "TOTAL" ? -1 : a.localeCompare(b)))
    .map(([key, { pass, total }]) => `${key.padEnd(20)} ${pct(pass, total)}`);
  const byCode = [...codes]
    .sort(([, a], [, b]) => b - a)
    .map(([code, n]) => `${code} ${n}`)
    .join(" · ");
  console.info(`parser golden — ${corpus.length} frases\n${lines.join("\n")}\nmotivos: ${byCode}`);
});
