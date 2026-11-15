// Reescreve parse-task.known-failures.ts a partir da saída real do parser: `bun run parser:failures`
// (em apps/web). `--dump` imprime o got ≠ want de cada falha. Avisa quem regrediu (falha fora da lista velha).
import { writeFileSync } from "node:fs";
import { corpus } from "./parse-task.corpus";
import { evaluate, expectedUnsure } from "./parse-task.corpus/kit";
import { knownFailures } from "./parse-task.known-failures";
import { setAppTimeZone } from "./zone";

setAppTimeZone("America/Sao_Paulo");

const fails = corpus.map((entry) => ({ entry, ...evaluate(entry) })).filter((r) => r.failed.length);

const byCategory = new Map<string, typeof fails>();
for (const r of fails) {
  const key = `${r.entry.tags.category} (${r.entry.tags.lang})`;
  byCategory.set(key, [...(byCategory.get(key) ?? []), r]);
}

let out = `/**
 * Frases do golden que o parser ainda erra, com os campos errados no comentário. A catraca
 * (\`parse-task.corpus.test.ts\`) falha se uma delas passar — aí é só tirar daqui.
 * Gerado por \`bun run parser:failures\`; não edite à mão.
 */
export const knownFailures: string[] = [
`;
for (const [key, rows] of [...byCategory].sort(([a], [b]) => a.localeCompare(b))) {
  out += `  // ${key}\n`;
  for (const r of rows) out += `  ${JSON.stringify(r.entry.input)}, // ${r.failed.join(", ")}\n`;
}
out += "];\n";
writeFileSync(new URL("./parse-task.known-failures.ts", import.meta.url), out);

const old = new Set(knownFailures);
const show = (r: (typeof fails)[number]) =>
  `${JSON.stringify(r.entry.input)} ${r.entry.now ?? ""} ${r.failed
    .map((f) => {
      const want = f === "unsure" ? expectedUnsure(r.entry) : r.entry.expect[f];
      return `${f}: ${JSON.stringify(r.actual[f])} ≠ ${JSON.stringify(want)}`;
    })
    .join(" | ")}`;
if (process.argv.includes("--dump")) for (const r of fails) console.log(show(r));
for (const r of fails.filter((r) => !old.has(r.entry.input))) console.log(`REGRESSÃO ${show(r)}`);
console.log(`falhas ${fails.length} / ${corpus.length} no corpus`);
