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
  "ler páginas 20 a 45 amanhã", // unsure
  "sala 12 às 10 amanhã", // title, time, duration
  "reunião 17.11", // unsure
  "dentista 17.11 às 14h", // unsure
  "viagem 05.12", // unsure
  "dentista na próxima terça às 9h", // day
  "almoço de domingo na casa da mãe dia 22", // unsure
  "acordar amanhã às 7", // time
  "reunião na primeira segunda de dezembro", // title, day
  "rodar a migration 0012 hoje", // title, time
  "ler salmo 23 hoje", // unsure
  // out-of-scope (pt)
  "eu marquei o barbeiro pra sábado", // unsure
  "aula 5 amanhã", // unsure
  "ligar 11 98765 4321 amanhã", // unsure
  "sala 12 às 10", // unsure
  "levei o cachorro no veterinário hoje de manhã", // unsure
  "meu voo é que horas", // unsure
  "o aniversário do Pedro é quando", // unsure
  "existe alguma reunião hoje", // unsure
  "ligar pro João depois do almoço", // unsure
  "pagar a conta no fim do mês", // unsure
  "visitar a tia no fim de semana", // unsure
  "ligar pra ele daqui a pouco", // unsure
  "viagem no feriado", // unsure
  "reunião semana que vem", // unsure
  "dentista mês que vem", // unsure
  "amanhã sexta reunião", // unsure
  "segunda dia 18 entregar relatório", // unsure
  "viajar no carnaval", // unsure
  "pagar boleto no quinto dia útil", // unsure
  "dentista dia 15", // unsure
  "reunião domingo", // unsure
  "ligar pra operadora de manhã", // unsure
  "comprar ingresso pra sessão das 21h", // unsure
  "tomar remédio às 10 da manhã e às 10 da noite", // unsure
  "reunião 31/11", // unsure
  "dentista 31 de novembro", // unsure
  "entrega dia 31.11", // unsure
  "consulta 30 de fevereiro", // unsure
  "viagem 32/12", // unsure
  "reunião às 25h", // unsure
  "ligar às 14:70", // unsure
  "pagar fatura dia 31 de novembro às 10h", // unsure
  "ligar pro Bruno às 9", // unsure
  "reunião às 2", // unsure
  "buscar a Clara às 5", // unsure
  "corte de cabelo 15/13", // unsure
  "reunião 13/25", // unsure
  "pagar fatura 29/02", // unsure
  "sexta 13 festa", // unsure
  "aula 5 às 5", // unsure
  "reunião na sala 10 às 9", // unsure
  "já liguei pro João hoje", // unsure
  "enviar relatório até o meio-dia", // unsure
  "me lembra de tomar água a cada hora", // unsure
  "limpar a piscina dia sim dia não", // unsure
  // past-edge (pt)
  "pagar fatura dia 31", // unsure
  // period (en)
  "this evening 6 yoga", // title, time
  // recurrence (pt)
  "semanalmente às quintas reunião 1:1", // title
];
