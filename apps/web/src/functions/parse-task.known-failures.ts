/**
 * Frases do golden que o parser ainda erra, com os campos errados no comentário. A catraca
 * (`parse-task.corpus.test.ts`) falha se uma delas passar — aí é só tirar daqui.
 */
export const knownFailures: string[] = [
  // absolute-date (en)
  "doctor appointment on Dec 3", // title
  "doctor appointment December 3rd", // title, day
  "doctor appointment on the 3rd of December", // title, day
  "call mom on the 23rd", // title, day
  "call mom on the 1st", // title, day
  "call mom on the 2nd", // title, day
  "pay rent on the 31st", // title, day
  "flight on November 23 at 6:45am", // title, time
  "flight Nov. 23", // title, day
  "flight November 23, 2026", // title
  "flight 23 Nov 2026", // title
  "flight 11/23", // title, day
  "flight 11/23/2026", // title, day
  "flight 2026-11-23", // title, day
  "conference Jan 5", // day
  "conference January 5th 2027", // title, day
  "new year's party Jan 1", // day
  "dentist Monday Nov 23", // title
  "dentist Friday, November 20", // title
  "party on the 28th at 8pm", // title, day
  "exam Dec 15th", // title, day
  "pay insurance January 10", // day
  "renew plan Jan 10th", // title, day
  "pay insurance February 10", // day
  "renew plan Feb 10th", // title, day
  "pay insurance March 10", // day
  "renew plan Mar 10th", // title, day
  "pay insurance April 10", // day
  "renew plan Apr 10th", // title, day
  "pay insurance May 10", // day
  "renew plan May 10th", // title, day
  "pay insurance June 10", // day
  "renew plan Jun 10th", // title, day
  "pay insurance July 10", // day
  "renew plan Jul 10th", // title, day
  "pay insurance August 10", // day
  "renew plan Aug 10th", // title, day
  "pay insurance September 10", // day
  "renew plan Sep 10th", // title, day
  "pay insurance October 10", // day
  "renew plan Oct 10th", // title, day
  "renew plan Dec 10th", // title, day
  "pay bill on the 5th", // title, day
  "back to school Feb 3", // day
  "bank on friday", // title
  // absolute-date (pt)
  "consulta dia 23/11", // title
  "evento dia 23 de novembro de 2026", // title
  "evento 23 de novembro 2026", // title
  "evento segunda, 23 de novembro", // title
  "consulta no dia 20 de novembro", // title
  "réveillon 1º de janeiro", // title, day
  "réveillon 1 de janeiro", // day
  "réveillon primeiro de janeiro", // title, day
  "réveillon 1o de janeiro", // title, day
  "pagar condomínio dia 1º", // title
  "pagar condomínio dia primeiro", // title, day
  "prova três de dezembro", // title, day, time
  "pagar fornecedor dia 31", // title, day
  "voo 2/1", // day
  "vacina 1.12.2026", // title, day, time
  "vacina 01-12-2026", // title, day
  "vacina 2026-12-01", // title, day
  "matrícula 10 de fevereiro", // day
  "entregar TCC 15 dez", // time
  "entregar TCC 15 dez.", // time
  "reunião dia 25/11 às 14h", // title
  "show do Coldplay dia 28 de novembro às 20h", // title
  "dentista segunda dia 23", // title, day
  "prova quinta 19/11", // title
  "aniversário da Ju 3 de março", // day
  "entrevista 23.11", // day, time
  "inscrição até 15/03/2027", // title
  "congresso 10 de março de 2027", // title, day
  "férias 5 de janeiro de 2027", // title, day
  "férias 5 de jan", // day
  "aniversário 29/02", // title, day
  "dia 15 de fevereiro reunião anual", // title, day
  "sexta, 4 de dezembro de 2026 formatura", // title
  "formatura 4 de dezembro, sexta", // title
  "pagar seguro 10 de janeiro", // day
  "renovar plano 10 jan", // day
  "pagar seguro 10 de fevereiro", // day
  "renovar plano 10 fev", // day
  "pagar seguro 10 de março", // day
  "renovar plano 10 mar", // day
  "pagar seguro 10 de abril", // day
  "renovar plano 10 abr", // day
  "pagar seguro 10 de maio", // day
  "renovar plano 10 mai", // day
  "pagar seguro 10 de junho", // day
  "renovar plano 10 jun", // day
  "pagar seguro 10 de julho", // day
  "renovar plano 10 jul", // day
  "pagar seguro 10 de agosto", // day
  "renovar plano 10 ago", // day
  "pagar seguro 10 de setembro", // day
  "renovar plano 10 set", // day
  "pagar seguro 10 de outubro", // day
  "renovar plano 10 out", // day
  "renovar plano 10 dez", // time
  "consulta 05/01", // day
  "volta às aulas 3 de fevereiro", // day
  "revisão 3 de janeiro", // day
  "balanço no fim do mês", // title, day
  "planejar o ano mês que vem", // title, day
  "comprar champanhe dia 30/12", // title
  "pagar fatura 02/01", // day
  // deadline (en)
  "finish report by friday", // title
  "finish report by Friday 5pm", // title
  "finish report by tomorrow", // title
  "finish report by tomorrow noon", // title
  "finish report by the 10th", // title, day
  "finish report by Dec 1", // title
  "finish report by end of month", // title, day
  "finish report by EOD", // title, day, time
  "finish report before friday", // title
  "finish report no later than wednesday", // title
  "submit paper until monday", // title
  "invoice due on the 20th", // title, day
  "by monday reply to HR", // title
  "buy gifts before christmas", // title, day
  // deadline (mix)
  "entregar o deck by friday", // title
  "send the report até sexta", // title
  "fechar o budget until monday", // title
  // deadline (pt)
  "pagar conta até dia 10", // title
  "pagar conta até o dia 20", // title
  "entregar trabalho até sexta", // title
  "entregar trabalho até a sexta", // title
  "entregar trabalho até a próxima sexta", // title, day
  "enviar proposta até amanhã 18h", // title
  "enviar proposta até amanhã", // title
  "enviar proposta até amanhã ao meio-dia", // title
  "enviar proposta até meio-dia de amanhã", // title
  "renovar passaporte até 30/11", // title
  "pagar IPVA até o fim do mês", // title, day
  "pagar IPVA até o final do mês", // title, day
  "terminar relatório até segunda", // title
  "terminar relatório até segunda às 12h", // title
  "submeter artigo até 1º de dezembro", // title, day
  "fazer a declaração antes de sexta", // title
  "pagar boleto até hoje às 23h59", // title
  "pagar boleto até às 18h", // title
  "pagar boleto até as 18h", // title
  "pagar boleto até hoje à noite", // title
  "mandar orçamento no máximo até quarta", // title
  "mandar orçamento até o fim da semana", // title, day
  "comprar presentes até o natal", // title, day
  "até sexta revisar o contrato", // title
  "até dia 5 pagar o IPTU", // title
  "até amanhã às 9 mandar o slide", // title
  "entregar TCC até 15/12", // title
  "entregar TCC até 15 de dezembro", // title
  "entregar TCC até daqui a 2 semanas", // title
  "responder o RH até quinta-feira", // title
  "responder o RH até qui", // title
  // duration (en)
  "workout for 45 minutes tonight", // title, duration
  "meeting tomorrow 10am for 1 hour", // title, duration
  "meeting tomorrow 10am for an hour", // title, duration
  "meeting tomorrow 10am for 2 hours", // title, duration
  "meeting tomorrow 10am for 90 minutes", // title, duration
  "meeting tomorrow 10am for 1.5 hours", // title, duration
  "meeting tomorrow 10am for half an hour", // title, duration
  "30 minute call tomorrow at 9am", // title, duration
  "30-minute call tomorrow at 9am", // title, duration
  "1 hour meeting friday 2pm", // title, duration
  "2h workshop thursday 1pm", // time, duration
  "meditate 10 minutes", // title, duration
  "meditate for 10 min", // title, duration
  "study for 2 hours today", // title, duration
  "study 1h30m", // title, duration
  "study 1 hr 30 min", // title, duration
  "walk for 40 mins", // title, duration
  "walk for forty minutes", // title, duration
  "walk for twenty minutes tomorrow", // title, duration
  "pomodoro 25 minutes", // title, duration
  "interview lasting 45 minutes wednesday 11am", // title, duration
  "yoga for 1 hour every day", // title, duration
  "read 30 min every day", // title, duration
  // duration (mix)
  "focus time for 2 horas amanhã", // title, time, duration
  "sync from 3 to 4pm amanhã", // title, time, duration
  "onboarding 9am-12pm segunda", // title, time, duration
  // duration (pt)
  "corrida 30 min amanhã de manhã", // title, duration
  "reunião de uma hora e meia amanhã às 10", // title, duration
  "meditar 10 minutos", // title, duration
  "meditar 30 min", // title, duration
  "estudar 1h e meia", // title, day, time, duration
  "estudar por quarenta minutos", // title, duration
  "estudar por 1 hora e 30 minutos", // title, duration
  "reunião de duas horas amanhã às 9", // title, duration
  "pomodoro 25 min", // title, duration
  "treino de uma hora amanhã às 7", // title, time, duration
  "workshop por 1 hora e 30 minutos sexta 14h", // title, duration
  "meia hora de caminhada", // title, duration
  "alongar 15min hoje", // title, duration
  "leitura 1h30min amanhã às 21h", // title, duration
  "entrevista com duração de 1 hora amanhã às 11h", // title
  "consulta 40 minutos terça 16h", // title, duration
  "revisão de vinte minutos", // title, day, time, duration
  "revisão de dez minutos amanhã", // title, time, duration
  "estudar 2 horas", // day, time, duration
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
  "reunião amanhã 10hrs", // title, time
  "reunião amanhã às 10 hrs", // title
  "reunião amanhã 10hr", // title, time
  "reunião amanhã 10:00h", // title, time
  "reunião amanhã 9:30h", // title, time
  "reunião amanhã 9h30min", // title, time
  "reunião amanhã a s 10", // title, time
  "reuniao 14 30 amanha", // title, time
  "pagar luz amanhã!!! 🙏", // title
  "cortar cabelo 6a feira 14h", // title, day
  "manicure 4a feira 15h", // title, day
  "aula 2ª feira 8h", // title, day, time
  "aula 3ª 8h", // title, day, time
  "acad 6h30 amn", // title, day, time
  "pagar conta de luz amanha cedinho", // title, time
  "sexta q vem churrasco", // title, day
  "prox sexta churrasco", // title
  "próx. segunda pagar o DARF", // title
  "semana q vem viajar", // title, day
  "td dia 8h remédio", // title, day, time, repeat
  "tds os dias 8h remédio", // title, day, time, repeat
  "tda segunda yoga", // title, repeat
  "almoço 12h amn", // title, day
  "dormir meia noite", // day
  "dps do almoço ligar pro contador", // title, day, time
  // link (en)
  "interview zoom.us/j/123456789 thursday 2pm", // title, links
  "fill out forms.gle/AbC123 by friday", // title, links
  "check bit.ly/3xYz9 tomorrow", // title, links
  // link (mix)
  "daily no zoom us02web.zoom.us/j/123 amanhã 9am", // title, links
  // link (pt)
  "reunião amanhã 10h zoom.us/j/123456789", // title, links
  "entrevista us02web.zoom.us/j/1234567890 quinta", // title, links
  "entrevista bit.ly/reuniao-time quinta", // title, links
  "forms.gle/AbC123 call sexta 15h", // title, links
  "pagar boleto em www.banco.com.br/boleto até sexta", // title
  "comparar bit.ly/a1b2 e forms.gle/xyz amanhã", // title, links
  // past-edge (en)
  "pay bill on the 3rd", // title, day
  "pay bill on the 15th", // title, day
  "church sunday", // day
  "return the book last friday", // title, day
  "gym at 8", // day, time
  "call John at 9", // day, time
  "meds at midnight", // day
  "dinner at 7", // day
  "dentist this morning", // title
  // past-edge (pt)
  "provas 10/02", // day
  "missa domingo", // day
  "devolver o livro sexta passada", // title, day
  "reunião semana passada", // title, day
  "academia às 8", // day, time
  "ligar pro João às 9", // day, time
  "dentista 10h", // day, time
  "tomar remédio meia-noite", // day
  "jantar às 7", // day
  "academia 6h", // day, time
  "call às 11h30", // day, time
  "reunião hoje 9h", // time
  "call 9h", // day, time
  "reunião 10:30", // day, time
  "reunião 11h", // day, time
  "pagar conta dia 15 às 10h", // time
  "domingo às 10 brunch", // day, time
  "meia-noite e meia trocar o turno", // day
  "estudar inglês à tarde", // day
  // period (en)
  "study this afternoon", // title
  "study in the afternoon", // title
  "watch the game this evening", // title
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
  "meeting from 2 to 3pm tomorrow", // title, time, duration
  "meeting 3-4pm tomorrow", // title, time, duration
  "meeting 3pm-4pm tomorrow", // title, duration
  "meeting 3pm - 4:30pm tomorrow", // title, duration
  "meeting from 3pm to 4pm", // title, duration
  "meeting from 15:00 to 16:30", // title, duration
  "meeting 15:00-16:30", // title, duration
  "meeting between 2 and 3pm tomorrow", // title, time, duration
  "workshop 9am to 12pm saturday", // title, time, duration
  "workshop 9-12 saturday", // title, time, duration
  "shift 10pm-6am", // duration
  "shift from 11pm to 1am friday", // title, duration
  "class 10:30am-11:15am tuesday", // title, time, duration
  "class 1:30-2pm tomorrow", // duration
  "lunch 12-1 tomorrow", // title, time, duration
  "office hours 2–4pm thursday", // title, time, duration
  "trip Dec 13-15", // title
  // range (pt)
  "reunião de 15h a 16h", // title, time, duration
  "reunião 15h às 16h", // title, duration
  "reunião 15-16h", // title, time, duration
  "aula de 14h a 15h30 amanhã", // title, time, duration
  "workshop 14:00-15:30 amanhã", // title, duration
  "workshop 14:00 - 15:30 amanhã", // title, duration
  "reunião de 10 a 11 amanhã", // title, time, duration
  "show sexta das 21h à 0h", // title, duration
  "show sexta das 21h à meia-noite", // title, time, duration
  "turno das 22h às 6h", // title, duration
  "festa das 23h à 1h sábado", // title, duration
  "reunião entre 14h e 15h amanhã", // title, duration
  "almoço amanhã 12h às 13h", // title, duration
  "almoço amanhã do meio-dia às 13h", // title, duration
  "aula das 2 às 4 da tarde", // time
  "aula das 10 da manhã às 2 da tarde amanhã", // title, time, duration
  "reunião amanhã 9h às 10h30", // title, time, duration
  "consulta 15h às 15h45", // title, time, duration
  "reunião das 3 às 4", // time
  "reunião quinta 9:30-11:00", // title, duration
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
  "every morning journal", // title, day, repeat
  "take meds every night", // title, day, time, repeat
  "gym mondays and wednesdays", // title, day, repeat
  "gym mon wed fri", // title, repeat
  "gym every tue/thu 6pm", // title, day, repeat
  "team sync weekdays 9:30am", // title, day, time, repeat
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
  "mom's birthday every year on March 3", // title
  "file taxes every April 15", // title, day, repeat
  "class every wednesday 7-9pm", // title, time, duration
  "study every day except sunday", // title, day, repeat
  // recurrence (mix)
  "standup weekdays às 9h", // title, day, time, repeat
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
  "academia seg qua sex 7h", // title, repeat
  "academia segunda, quarta e sexta", // title, repeat
  "standup de segunda a sexta às 9h", // title, repeat
  "standup de seg a sex 9h", // title, repeat
  "bater ponto todo dia útil às 8h", // title, repeat
  "bater ponto durante a semana às 8h", // title, day, time, repeat
  "academia de segunda a sábado", // title, repeat
  "estudar todo dia exceto domingo", // title, day, repeat
  "estudar todo dia menos domingo", // title, day, repeat
  "passear com o cachorro todo fim de semana", // title, day, repeat
  "passear com o cachorro nos fins de semana", // title, day, repeat
  "passear com o cachorro sábado e domingo de manhã", // title, repeat
  "trabalho voluntário aos sábados", // title, day, repeat
  "às segundas reunião de equipe 9h", // title, day, time, repeat
  "nas terças-feiras aula de dança", // title, day, repeat
  "pagar cartão todo dia 5 de cada mês", // title
  "pagar fatura todo dia 31", // title, day
  "pagar condomínio todo dia 1º", // title
  "backup uma vez por mês", // title, time, repeat
  "backup cada mês", // title, day, repeat
  "pagar escola todo começo de mês", // title, day, repeat
  "declarar IR todo ano dia 10 de março", // title
  "montar a árvore todo 1º de dezembro", // title, day, repeat
  "aniversário do Léo todo 20/11", // title, repeat
  // relative-day (en)
  "take Max to the vet tmrw", // title, day
  "tmrw send the quote", // title, day
  "pay the invoice the day after tomorrow", // title
  "the day after tomorrow renew the license", // title
  "buy milk on monday", // title
  "on monday call John", // title
  "pay the invoice on friday", // title
  "on friday renew the license", // title
  "take Max to the vet on Saturday", // title
  "on Saturday send the quote", // title
  "buy milk this friday", // title
  "this friday call John", // title
  "pay the invoice this wednesday", // title
  "this wednesday renew the license", // title
  "take Max to the vet a week from wednesday", // title, day
  "a week from wednesday send the quote", // title, day
  "pay the invoice next month", // title, day
  "next month renew the license", // title, day
  "take Max to the vet next year", // title, day
  "next year send the quote", // title, day
  "pay the invoice in two days", // title, day, time
  "in two days renew the license", // title, day, time
  "pay the invoice in a week", // title, day
  "in a week renew the license", // title, day
  "take Max to the vet in one week", // title, day, time
  "in one week send the quote", // title, day, time
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
  "comprar pão essa sexta", // title
  "essa sexta ligar pro João", // title
  "pagar a fatura esta quarta", // title
  "esta quarta renovar a CNH", // title
  "levar o Thor no veterinário nesta quinta", // title
  "nesta quinta mandar o orçamento", // title
  "comprar pão nessa terça", // title
  "nessa terça ligar pro João", // title
  "comprar pão terça da semana que vem", // title
  "terça da semana que vem ligar pro João", // title
  "pagar a fatura quarta da próxima semana", // title
  "quarta da próxima semana renovar a CNH", // title
  "comprar pão daqui 2 dias", // title, day
  "daqui 2 dias ligar pro João", // title, day
  "comprar pão daqui a uma semana", // title, day, time
  "daqui a uma semana ligar pro João", // title, day, time
  "pagar a fatura em uma semana", // title, day, time
  "em uma semana renovar a CNH", // title, day, time
  "comprar pão em duas semanas", // title, day, time
  "em duas semanas ligar pro João", // title, day, time
  "pagar a fatura daqui a um mês", // title, day, time
  "daqui a um mês renovar a CNH", // title, day, time
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
  "devolver livro essa sexta", // title
  "prova nesta quinta", // title
  "pagar fatura daqui a uma semana", // title, day, time
  "marcar médico daqui a 2 meses", // title, day
  "renovar seguro mês que vem", // title, day
  "lavar o carro daqui 2 dias", // title, day
  "limpar a casa no fim de semana", // title, day
  "fechar as contas no fim do mês", // title, day
  "terça dessa semana arrumar o armário", // title
  "pagar escola dia seguinte", // title, day
  "daqui a quinze dias consulta de retorno", // title, day, time
  "em três dias ligar pro seguro", // title, day, time
  // relative-time (en)
  "standup in 30 mins", // title, day, time
  "yoga in two hours", // title, time
  "yoga in 2 hrs", // title, day, time
  "call back in an hour", // title, day, time
  "call back in half an hour", // title, day, time
  "call back in an hour and a half", // title, day, time
  "turn off the oven in 3 hours", // day
  "check the laundry in a bit", // title, day
  // relative-time (pt)
  "ligar pro João daqui 3 horas", // title, time
  "tirar roupa da máquina daqui 40 min", // title, day, time
  "pausa daqui a meia hora", // title, day, time
  "pausa em meia hora", // title, day, time
  "responder email daqui a uma hora", // title, time
  "reunião daqui a 1h30", // title, time
  "reunião daqui a uma hora e meia", // title, time
  "reunião daqui a 2 horas e 15 minutos", // title, time
  "reunião dentro de três horas", // title, time
  "ligar daqui a pouco", // title, day
  "desligar o forno daqui a 3 horas", // day
  "tomar o remédio em 24 horas", // day
  // time (en)
  "pick up the kids tomorrow at 3 p.m.", // title
  "at 3 p.m. tomorrow meeting", // title
  "meeting tomorrow at 3:30pm", // title, time
  "at 3:30pm tomorrow call with the client", // title, time
  "gym tomorrow at 10 a.m.", // title
  "at 10 a.m. tomorrow dentist", // title
  "pick up the kids tomorrow at 9:45am", // title, time
  "at 9:45am tomorrow meeting", // title, time
  "pick up the kids tomorrow at 10 in the morning", // title
  "at 10 in the morning tomorrow meeting", // title
  "gym tomorrow at 3 in the afternoon", // title
  "at 3 in the afternoon tomorrow dentist", // title
  "meeting tomorrow at 8 in the evening", // title, time
  "at 8 in the evening tomorrow call with the client", // title, time
  "pick up the kids tomorrow around 10am", // title
  "around 10am tomorrow meeting", // title
  "dentist tomorrow at 6:30am", // title, time
  "at 6:30am tomorrow pick up the kids", // title, time
  "pick up the kids tomorrow @ 3pm", // title
  "@ 3pm tomorrow meeting", // title
  "standup monday 9:30am", // title, time
  // time (mix)
  "lunch com a Bia tomorrow ao meio-dia", // title
  // time (pt)
  "dentista amanhã 9h45min", // title, time
  "9h45min amanhã pegar as crianças", // title, time
  "reunião amanhã às 6 pela manhã", // time
  "às 6 pela manhã amanhã call com o cliente", // time
  "call com o cliente amanhã ao meio-dia", // title
  "ao meio-dia amanhã academia", // title
  "pegar as crianças amanhã ao meio dia", // title
  "ao meio dia amanhã reunião", // title
  "reunião amanhã ao meio-dia e quinze", // title
  "ao meio-dia e quinze amanhã call com o cliente", // title
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
  "tomar remédio à meia-noite", // title, day
  "tomar remédio meia-noite e meia", // day
  "entrevista dia 20 de novembro às 18:15", // title
  // trap (en)
  "check out 15 new recipes", // title, day
  "watch Friday the 13th", // title, day
  "read Robinson Crusoe and Friday", // title, day
  "watch Sunday Night Football", // title, day
  "listen to Manic Monday", // title, day
  "watch Black Friday deals", // title, day
  "prepare Cyber Monday campaign", // title, day
  "watch The Morning Show", // title, day, time
  "watch Good Morning America", // title, day, time
  "watch Tonight Show", // title, day, time
  "buy one ticket", // title, day, time
  "buy two tickets", // title, day, time
  "do ten pushups", // title, day, time
  "read five chapters", // title, day, time
  "watch Ocean's Eleven", // title, day, time
  "watch Twelve Monkeys", // title, day, time
  "read The Two Towers", // title, day, time
  "24/7 support rotation", // title, day
  "watch Midnight in Paris", // title, day, time
  "watch The Day After Tomorrow", // title, day
  "read Tomorrow and Tomorrow and Tomorrow", // title, day
  "pay $12.50 fee", // title, day, time
  "sun cream", // title, day
  "buy wed dress", // title, day
  "study 2h", // day, time, duration
  // trap (mix)
  "assistir Wednesday na Netflix", // title, day
  "ler o Four Hour Work Week", // title, day, time
  "ver o Black Friday da Amazon", // title, day
  "estudar o Sunday Times", // title, day
  "comprar um Apple Watch", // title, day, time
  "ver o Good Morning Brasil", // title, day, time
  // trap (pt)
  "assistir Sexta-Feira 13", // title, day
  "estudar 2h", // day, time, duration
  "comprar uma pizza", // title, day, time
  "comprar uma blusa", // title, day, time
  "ler um livro", // title, day, time
  "fazer uma ligação pro banco", // title, day, time
  "pedir duas pizzas", // title, day, time
  "comprar quatro pneus", // title, day, time
  "cozinhar seis ovos", // title, day, time
  "plantar oito mudas", // title, day, time
  "ter uma conversa com o chefe", // title, day, time
  "ter aula de inglês", // title, day
  "ter paciência com o estagiário", // title, day
  "comprar dois litros de leite", // title, day, time
  "ler cinco capítulos", // title, day, time
  "fazer dez flexões", // title, day, time
  "fazer três orçamentos", // title, day, time
  "tirar dez na prova", // title, day, time
  "ler Dom Casmurro", // title, day
  "ler Dom Quixote", // title, day
  "estudar Dom Pedro II", // title, day
  "assistir Sex Education", // title, day
  "assistir Sex and the City", // title, day
  "estudar Segunda Guerra Mundial", // title, day
  "estudar a Segunda Lei de Newton", // title, day
  "ler sobre a Quarta Revolução Industrial", // title, day
  "pedir segunda via do boleto", // title, day
  "tirar segunda via da conta de luz", // title, day
  "fazer a segunda chamada da prova", // title, day
  "assistir Sessão da Tarde", // title, day, time
  "assistir Domingo Legal", // title, day
  "ver Terça Insana", // title, day
  "café da manhã com a Bia", // title, day, time
  "levar o carro na oficina da Rua 7 de Setembro", // title, day
  "comprar tecido na 25 de Março", // title, day
  "ir na Rua 15 de Novembro", // title, day
  "passar na Avenida 9 de Julho", // title, day
  "assistir Onze Homens e um Segredo", // title, day, time
  "assistir Doze Homens e uma Sentença", // title, day, time
  "ler O Quinze", // title, day, time
  "ler As Duas Torres", // title, day, time
  "ler Os Sete Maridos de Evelyn Hugo", // title, day, time
  "assistir Meia-Noite em Paris", // title, day, time
  "ver a Noite Estrelada no museu", // title, day, time
  "marcar uma reunião", // title, day, time
  "pagar R$ 12,50 de taxa", // title, day, time
  "atualizar app pra versão 2.10", // title, day, time
  "ligar pro Marco 15 horas", // title, day
  "comprar um presente pra Ana", // title, day, time
  "comprar cabo de 2m", // title, duration
  "suporte 24/7 do provedor", // title, day
  "comprar o Dom Pérignon", // title, day
  "estudar 4 horas de cálculo", // day, time, duration
  "plantão 24 horas", // day, time, duration
];
