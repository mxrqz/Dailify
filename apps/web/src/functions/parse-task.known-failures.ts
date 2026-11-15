/**
 * Frases do golden que o parser ainda erra, com os campos errados no comentário. A catraca
 * (`parse-task.corpus.test.ts`) falha se uma delas passar — aí é só tirar daqui.
 * Gerado por `bun run parser:failures`; não edite à mão.
 */
export const knownFailures: string[] = [
  // absolute-date (pt)
  "entrevista 23.11", // day, time
  // informal (pt)
  "reunião amanhã a s 10", // title, time
  "reuniao 14 30 amanha", // title, time
  "pagar luz amanhã!!! 🙏", // title
];
