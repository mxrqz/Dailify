/**
 * Frases do golden que o parser ainda erra, com os campos errados no comentário. A catraca
 * (`parse-task.corpus.test.ts`) falha se uma delas passar — aí é só tirar daqui.
 * Gerado por `bun run parser:failures`; não edite à mão.
 */
export const knownFailures: string[] = [
  // absolute-date (en)
  "doctor appointment December 3rd", // title, day
  "doctor appointment on the 3rd of December", // title, day
  "call mom on the 23rd", // title, day
  "call mom on the 1st", // title, day
  "call mom on the 2nd", // title, day
  "pay rent on the 31st", // title, day
  "flight 11/23", // title, day
  "flight 11/23/2026", // title, day
  "flight 2026-11-23", // title, day
  "conference January 5th 2027", // title, day
  "party on the 28th at 8pm", // title, day
  "exam Dec 15th", // title, day
  "renew plan Jan 10th", // title, day
  "renew plan Feb 10th", // title, day
  "renew plan Mar 10th", // title, day
  "renew plan Apr 10th", // title, day
  "renew plan May 10th", // title, day
  "renew plan Jun 10th", // title, day
  "renew plan Jul 10th", // title, day
  "renew plan Aug 10th", // title, day
  "renew plan Sep 10th", // title, day
  "renew plan Oct 10th", // title, day
  "renew plan Dec 10th", // title, day
  "pay bill on the 5th", // title, day
  // absolute-date (pt)
  "réveillon primeiro de janeiro", // title, day
  "pagar condomínio dia primeiro", // title, day
  "prova três de dezembro", // title, day
  "vacina 1.12.2026", // title, day, time
  "vacina 01-12-2026", // title, day
  "vacina 2026-12-01", // title, day
  "entrevista 23.11", // day, time
  "balanço no fim do mês", // title, day
  "planejar o ano mês que vem", // title, day
  // deadline (en)
  "finish report by the 10th", // title, day
  "finish report by end of month", // title, day
  "finish report by EOD", // title, day, time
  "finish report no later than wednesday", // title
  "invoice due on the 20th", // title, day
  "buy gifts before christmas", // title, day
  // deadline (pt)
  "pagar IPVA até o fim do mês", // title, day
  "pagar IPVA até o final do mês", // title, day
  "mandar orçamento no máximo até quarta", // title
  "mandar orçamento até o fim da semana", // title, day
  "comprar presentes até o natal", // title, day
  // informal (en)
  "buy milk tmrw", // title, day
  "buy milk 2moro", // title, day
  "buy milk tomorow", // title, day
  "buy milk tommorow", // title, day
  "buy milk tonite", // title, day, time
  "gym wensday 7am", // title, day
  "gym thrusday 7am", // title, day
  "gym 7a tomorrow", // title, time
  "gym 7p tomorrow", // title, time
  "call 3p", // title, day, time
  "mtg w/ team tmrw 10a", // title, day, time
  "nxt friday bbq", // title
  // informal (pt)
  "ligar pro banco amn", // title, day
  "ligar pro banco amnh", // title, day
  "ligar pro banco amanah", // title, day
  "ligar pro banco amahã", // title, day
  "pagar boleto amanhaa", // title, day
  "churras sabdo", // title, day
  "médico dps de amanhã", // title, day
  "médico dps de amanha", // title, day
  "médico depois d amanhã", // title, day
  "reunião amanhã a s 10", // title, time
  "reuniao 14 30 amanha", // title, time
  "pagar luz amanhã!!! 🙏", // title
  "cortar cabelo 6a feira 14h", // title, day
  "manicure 4a feira 15h", // title, day
  "aula 2ª feira 8h", // title
  "aula 3ª 8h", // title, day
  "acad 6h30 amn", // title
  "pagar conta de luz amanha cedinho", // title, time
  "sexta q vem churrasco", // title, day
  "prox sexta churrasco", // title
  "próx. segunda pagar o DARF", // title
  "semana q vem viajar", // title, day
  "td dia 8h remédio", // title, repeat
  "tds os dias 8h remédio", // title, repeat
  "tda segunda yoga", // title, repeat
  "almoço 12h amn", // title
  "dps do almoço ligar pro contador", // title, day, time
  // past-edge (en)
  "pay bill on the 3rd", // title, day
  "pay bill on the 15th", // title, day
  "return the book last friday", // title, day
  // past-edge (pt)
  "devolver o livro sexta passada", // title, day
  "reunião semana passada", // title, day
  // period (en)
  "watch the game tomorrow night", // title, time
  "call grandma friday night", // title, time
  "water plants early tomorrow", // title, time
  "water plants tomorrow at lunch", // title, time
  "water plants at lunchtime", // title, day, time
  "pay bills end of day", // title, day, time
  "pay bills tomorrow EOD", // title, time
  // period (pt)
  "ver o jogo essa noite", // title, day, time
  "ligar pra mãe amanhã cedo", // title, time
  "ligar pra mãe amanhã cedinho", // title, time
  "regar as plantas amanhã no fim da tarde", // title, time
  "passear com o cachorro no fim da tarde", // title, time
  "regar as plantas amanhã no início da manhã", // title, time
  "pagar o boleto amanhã na hora do almoço", // title, time
  "pagar o boleto amanhã depois do almoço", // title, time
  "pagar o boleto à tardinha", // title, day, time
  // range (en)
  "trip Dec 13-15", // title
  // range (pt)
  "reunião de 10 a 11 amanhã", // title, time, duration
  "viagem de 13 a 15 de dezembro", // title, day
  // recurrence (en)
  "piano lessons on Mondays", // title, day, repeat
  "piano lessons on Tuesdays", // title, day, repeat
  "piano lessons on Wednesdays", // title, day, repeat
  "piano lessons on Thursdays", // title, day, repeat
  "piano lessons on Fridays", // title, day, repeat
  "piano lessons on Saturdays", // title, day, repeat
  "piano lessons on Sundays", // title, day, repeat
  "take meds daily", // title, day, repeat
  "take meds each day at 10pm", // title, repeat
  "every morning journal", // title, repeat
  "take meds every night", // title, day, time, repeat
  "gym mondays and wednesdays", // title, day, repeat
  "gym mon wed fri", // title, repeat
  "gym every tue/thu 6pm", // title, day, repeat
  "team sync weekdays 9:30am", // title, repeat
  "team sync monday to friday 9am", // title, repeat
  "team sync monday through friday 9am", // title, repeat
  "team sync mon-fri 9am", // title, repeat
  "walk the dog every weekend", // title, day, repeat
  "walk the dog on weekends", // title, day, repeat
  "water plants weekly", // title, day, repeat
  "pay rent every month on the 5th", // title, day
  "pay rent on the 5th of every month", // title, day
  "pay rent monthly", // title, day, repeat
  "pay rent once a month", // title, day, repeat
  "pay rent every 20th", // title, day, repeat
  "renew domain yearly", // title, day, repeat
  "renew domain annually", // title, day, repeat
  "file taxes every April 15", // title, repeat
  "study every day except sunday", // title, day, repeat
  // recurrence (mix)
  "standup weekdays às 9h", // title, repeat
  "review mensal monthly", // title, day, repeat
  // recurrence (pt)
  "feira às segundas", // title, day, repeat
  "feira às terças", // title, day, repeat
  "feira às quartas", // title, day, repeat
  "feira às quintas", // title, day, repeat
  "feira às sextas", // title, day, repeat
  "feira aos sábados", // title, day, repeat
  "feira aos domingos", // title, day, repeat
  "tomar vitamina cada dia", // title, day, repeat
  "tomar vitamina a cada dia", // title, day, repeat
  "tomar vitamina todo santo dia", // title, day, repeat
  "ler a bíblia todas as manhãs", // title, day, time, repeat
  "tomar remédio toda noite", // title, day, time, repeat
  "inglês segundas e quartas às 19h", // title, day, repeat
  "pilates terças e quintas 18h", // title, day, repeat
  "pilates às terças e quintas", // title, day, repeat
  "academia seg qua sex 7h", // title, day, repeat
  "academia segunda, quarta e sexta", // title, repeat
  "standup de segunda a sexta às 9h", // title, repeat
  "standup de seg a sex 9h", // title, day, repeat
  "bater ponto todo dia útil às 8h", // title, repeat
  "bater ponto durante a semana às 8h", // title, repeat
  "academia de segunda a sábado", // title, repeat
  "estudar todo dia exceto domingo", // title, day, repeat
  "estudar todo dia menos domingo", // title, day, repeat
  "passear com o cachorro todo fim de semana", // title, day, repeat
  "passear com o cachorro nos fins de semana", // title, day, repeat
  "passear com o cachorro sábado e domingo de manhã", // title, repeat
  "trabalho voluntário aos sábados", // title, day, repeat
  "às segundas reunião de equipe 9h", // title, repeat
  "nas terças-feiras aula de dança", // title, day, repeat
  "pagar cartão todo dia 5 de cada mês", // title
  "backup uma vez por mês", // title, day, repeat
  "backup cada mês", // title, day, repeat
  "pagar escola todo começo de mês", // title, day, repeat
  "montar a árvore todo 1º de dezembro", // title, repeat
  "aniversário do Léo todo 20/11", // title, repeat
  // relative-day (en)
  "take Max to the vet tmrw", // title, day
  "tmrw send the quote", // title, day
  "take Max to the vet a week from wednesday", // title, day
  "a week from wednesday send the quote", // title, day
  "pay the invoice next month", // title, day
  "next month renew the license", // title, day
  "take Max to the vet next year", // title, day
  "next year send the quote", // title, day
  "pay the invoice in two days", // title, day
  "in two days renew the license", // title, day
  "pay the invoice in a week", // title, day
  "in a week renew the license", // title, day
  "take Max to the vet in one week", // title, day
  "in one week send the quote", // title, day
  "pay the invoice in a month", // title, day
  "in a month renew the license", // title, day
  "take Max to the vet in 2 months", // title, day
  "in 2 months send the quote", // title, day
  "buy milk 3 days from now", // title, day
  "3 days from now call John", // title, day
  "pay the invoice a week from now", // title, day
  "a week from now renew the license", // title, day
  "take Max to the vet this weekend", // title, day
  "this weekend send the quote", // title, day
  "buy milk over the weekend", // title, day
  "over the weekend call John", // title, day
  "pay the invoice at the end of the month", // title, day
  "at the end of the month renew the license", // title, day
  "take Max to the vet end of month", // title, day
  "end of month send the quote", // title, day
  "buy milk later today", // title
  "later today call John", // title
  "clean the garage on the weekend", // title, day
  "submit report by end of week", // title, day
  // relative-day (mix)
  "release on the 23rd do mês", // title, day
  // relative-day (pt)
  "comprar pão terça da semana que vem", // title
  "terça da semana que vem ligar pro João", // title
  "pagar a fatura quarta da próxima semana", // title
  "quarta da próxima semana renovar a CNH", // title
  "comprar pão daqui a uma semana", // title, day
  "daqui a uma semana ligar pro João", // title, day
  "pagar a fatura em uma semana", // title, day
  "em uma semana renovar a CNH", // title, day
  "comprar pão em duas semanas", // title, day
  "em duas semanas ligar pro João", // title, day
  "pagar a fatura daqui a um mês", // title, day
  "daqui a um mês renovar a CNH", // title, day
  "levar o Thor no veterinário daqui a 2 meses", // title, day
  "daqui a 2 meses mandar o orçamento", // title, day
  "comprar pão mês que vem", // title, day
  "mês que vem ligar pro João", // title, day
  "pagar a fatura no próximo mês", // title, day
  "no próximo mês renovar a CNH", // title, day
  "levar o Thor no veterinário fim de semana", // title, day
  "fim de semana mandar o orçamento", // title, day
  "comprar pão no fim de semana", // title, day
  "no fim de semana ligar pro João", // title, day
  "pagar a fatura no final de semana", // title, day
  "no final de semana renovar a CNH", // title, day
  "levar o Thor no veterinário neste fim de semana", // title, day
  "neste fim de semana mandar o orçamento", // title, day
  "comprar pão fim do mês", // title, day
  "fim do mês ligar pro João", // title, day
  "pagar a fatura no final do mês", // title, day
  "no final do mês renovar a CNH", // title, day
  "levar o Thor no veterinário ano que vem", // title, day
  "ano que vem mandar o orçamento", // title, day
  "comprar pão ainda hoje", // title
  "ainda hoje ligar pro João", // title
  "pagar a fatura hoje mesmo", // title
  "hoje mesmo renovar a CNH", // title
  "levar o Thor no veterinário amanhã sem falta", // title
  "amanhã sem falta mandar o orçamento", // title
  "visitar a vó quarta da semana que vem", // title
  "pagar fatura daqui a uma semana", // title, day
  "marcar médico daqui a 2 meses", // title, day
  "renovar seguro mês que vem", // title, day
  "limpar a casa no fim de semana", // title, day
  "fechar as contas no fim do mês", // title, day
  "terça dessa semana arrumar o armário", // title
  "pagar escola dia seguinte", // title, day
  "daqui a quinze dias consulta de retorno", // title, day
  "em três dias ligar pro seguro", // title, day
  // relative-time (en)
  "yoga in two hours", // title, day, time
  "call back in an hour", // title, day, time
  "call back in half an hour", // title, day, time
  "call back in an hour and a half", // title, day, time
  "check the laundry in a bit", // title, day
  // relative-time (pt)
  "pausa daqui a meia hora", // title, day, time
  "pausa em meia hora", // title, day, time
  "responder email daqui a uma hora", // title, day, time
  "reunião daqui a 1h30", // title, day, time
  "reunião daqui a uma hora e meia", // title, day, time
  "reunião daqui a 2 horas e 15 minutos", // title, time, duration
  "reunião dentro de três horas", // title, time
  "ligar daqui a pouco", // title, day
  // time (en)
  "pick up the kids tomorrow around 10am", // title
  "around 10am tomorrow meeting", // title
  // time (pt)
  "reunião amanhã quinze para as 10", // title, time
  "quinze para as 10 amanhã call com o cliente", // title, time
  "dentista amanhã 10 pras 3 da tarde", // title, time
  "10 pras 3 da tarde amanhã pegar as crianças", // title, time
  "call com o cliente amanhã cinco para o meio-dia", // title, time
  "cinco para o meio-dia amanhã academia", // title, time
  "pegar as crianças amanhã por volta das 10", // title, time
  "por volta das 10 amanhã reunião", // title, time
  "academia amanhã lá pelas 16h", // title
  "lá pelas 16h amanhã dentista", // title
  // trap (en)
  "read Robinson Crusoe and Friday", // title, day
  // trap (mix)
  "assistir Wednesday na Netflix", // title, day
];
