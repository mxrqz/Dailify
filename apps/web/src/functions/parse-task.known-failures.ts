/**
 * Frases do golden que o parser ainda erra, com os campos errados no comentário. A catraca
 * (`parse-task.corpus.test.ts`) falha se uma delas passar — aí é só tirar daqui.
 * Gerado por `bun run parser:failures`; não edite à mão.
 */
export const knownFailures: string[] = [
  // informal (pt)
  "pagar luz amanhã!!! 🙏", // title
  // trap (en)
  "email the team about friday's offsite", // title, day
];
