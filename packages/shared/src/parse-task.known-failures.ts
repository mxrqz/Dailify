/**
 * Frases do golden que o parser ainda erra, com os campos errados no comentário. A catraca
 * (`parse-task.corpus.test.ts`) falha se uma delas passar — aí é só tirar daqui.
 * Gerado por `bun run parser:failures`; não edite à mão.
 */
export const knownFailures: string[] = [
  // absolute-date (pt)
  "exame de sangue 17.11", // unsure
  "hoje 15/11 regar as plantas", // title
  // informal (pt)
  "pagar luz amanhã!!! 🙏", // title
  // out-of-scope (pt)
  "eu marquei o barbeiro pra sábado", // unsure
  "aula 5 amanhã", // unsure
  "ligar 11 98765 4321 amanhã", // unsure
  "sala 12 às 10", // unsure
  "levei o cachorro no veterinário hoje de manhã", // unsure
  // past-edge (pt)
  "pagar fatura dia 31", // unsure
  // period (en)
  "this evening 6 yoga", // title, time
  // recurrence (pt)
  "semanalmente às quintas reunião 1:1", // title
];
