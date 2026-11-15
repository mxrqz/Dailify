import { FRI, MF, MON, MON2, SAT, THU, TODAY, TUE, W, WED, section } from "./kit";

export default [
  ...section("mix", "time", [
    ["call com cliente tomorrow 15h", "call com cliente", MON, "15:00"],
    ["review do PR amanhã at 4pm", "review do PR", MON, "16:00"],
    ["deploy friday às 18h", "deploy", FRI, "18:00"],
    ["happy hour sexta 6pm", "happy hour", FRI, "18:00"],
    ["daily amanhã 9am", "daily", MON, "09:00"],
    ["meeting com o board amanhã 10h", "meeting com o board", MON, "10:00"],
    ["lunch com a Bia tomorrow ao meio-dia", "lunch com a Bia", MON, "12:00"],
    ["call com investor quinta 3pm", "call com investor", THU, "15:00"],
    ["one-on-one terça at 10am", "one-on-one", TUE, "10:00"],
    ["sync com design wednesday 14h", "sync com design", WED, "14:00"],
    ["kickoff do projeto monday 9h30", "kickoff do projeto", MON, "09:30"],
    ["demo pro cliente sábado at noon", "demo pro cliente", SAT, "12:00"],
    ["standup hoje at 4pm", "standup", TODAY, "16:00"],
    ["call amanhã às 3pm", "call", MON, "15:00"],
    [
      "reunião tomorrow morning",
      "reunião",
      MON,
      "09:00",
      { alt: [{ time: "07:00" }, { time: "08:00" }] },
    ],
    ["jantar tonight", "jantar", TODAY, "20:00", { alt: [{ time: "19:00" }] }],
    [
      "meeting amanhã de manhã",
      "meeting",
      MON,
      "09:00",
      { alt: [{ time: "07:00" }, { time: "08:00" }] },
    ],
  ]),

  ...section("mix", "relative-day", [
    ["reunião next monday 10h", "reunião", MON, "10:00", { alt: [{ day: MON2 }] }],
    ["deploy next week", "deploy", MON2, null, { alt: [{ day: "2026-11-22" }] }],
    ["entregar o report friday", "entregar o report", FRI],
    ["code review amanhã", "code review", MON],
    ["retro na sexta", "retro", FRI],
    ["meeting in 3 dias", "meeting", WED],
    ["follow-up daqui a 2 days", "follow-up", TUE],
    ["call em 30 minutes", "call", TODAY, "14:30"],
    ["release dia 23", "release", "2026-11-23"],
    [
      "release on the 23rd do mês",
      "release",
      "2026-11-23",
      null,
      {
        alt: [{ title: "release do mês" }],
      },
    ],
  ]),

  ...section("mix", "duration", [
    [
      "meeting com time de vendas amanhã 10h por 1 hour",
      "meeting com time de vendas",
      MON,
      "10:00",
      {
        duration: "1h",
      },
    ],
    ["call de 30min tomorrow 9am", "call", MON, "09:00", { duration: "30m" }],
    ["workshop de 2 hours sexta 14h", "workshop", FRI, "14:00", { duration: "2h" }],
    ["focus time for 2 horas amanhã", "focus time", MON, null, { duration: "2h" }],
    ["sync from 3 to 4pm amanhã", "sync", MON, "15:00", { duration: "1h" }],
    ["planning das 10 às 12 tomorrow", "planning", MON, "10:00", { duration: "2h" }],
    ["onboarding 9am-12pm segunda", "onboarding", MON, "09:00", { duration: "3h" }],
  ]),

  ...section("mix", "recurrence", [
    [
      "daily standup todo dia 9h30 meet.google.com/xyz-abcd-efg",
      "daily standup",
      MON,
      "09:30",
      {
        repeat: "Daily",
        links: ["https://meet.google.com/xyz-abcd-efg"],
      },
    ],
    ["sprint planning toda segunda 10am", "sprint planning", MON, "10:00", { repeat: W("Monday") }],
    [
      "1:1 com o gestor every friday 14h",
      "1:1 com o gestor",
      FRI,
      "14:00",
      { repeat: W("Friday") },
    ],
    [
      "weekly sync toda quinta 11h no meet",
      "weekly sync no meet",
      THU,
      "11:00",
      {
        repeat: W("Thursday"),
        alt: [{ title: "weekly sync" }],
      },
    ],
    ["gym every segunda e quarta", "gym", MON, null, { repeat: W("Monday", "Wednesday") }],
    ["standup weekdays às 9h", "standup", MON, "09:00", { repeat: MF }],
    ["standup dias úteis at 9am", "standup", MON, "09:00", { repeat: MF }],
    ["pagar o rent todo dia 5", "pagar o rent", "2026-12-05", null, { repeat: "Monthly" }],
    ["backup every month", "backup", TODAY, null, { repeat: "Monthly" }],
    ["review mensal monthly", "review mensal", TODAY, null, { repeat: "Monthly" }],
    ["retro every other friday", "retro", FRI, null, { outOfScope: "recurrence" }],
    ["one-on-one a cada 2 weeks", "one-on-one", TODAY, null, { outOfScope: "recurrence" }],
  ]),

  ...section("mix", "deadline", [
    ["entregar o deck by friday", "entregar o deck", FRI],
    ["send the report até sexta", "send the report", FRI],
    ["fechar o budget until monday", "fechar o budget", MON],
    ["deadline do sprint quinta", "deadline do sprint", THU],
  ]),

  ...section("mix", "link", [
    [
      "daily no zoom us02web.zoom.us/j/123 amanhã 9am",
      "daily no zoom",
      MON,
      "09:00",
      {
        links: ["https://us02web.zoom.us/j/123"],
      },
    ],
    [
      "review figma.com/file/abc tomorrow",
      "review",
      MON,
      null,
      {
        links: ["https://figma.com/file/abc"],
      },
    ],
    [
      "call https://meet.google.com/abc-defg-hij sexta 4pm",
      "call",
      FRI,
      "16:00",
      {
        links: ["https://meet.google.com/abc-defg-hij"],
      },
    ],
  ]),

  ...section("mix", "trap", [
    ["revisar o PR #12 do frontend", "revisar o PR #12 do frontend"],
    [
      "fazer o deploy do Monday.com",
      "fazer o deploy do Monday.com",
      null,
      null,
      {
        alt: [{ title: "fazer o deploy", links: ["https://Monday.com"] }],
      },
    ],
    ["assistir Wednesday na Netflix", "assistir Wednesday na Netflix"],
    ["ler o Four Hour Work Week", "ler o Four Hour Work Week"],
    ["ver o Black Friday da Amazon", "ver o Black Friday da Amazon"],
    ["estudar o Sunday Times", "estudar o Sunday Times"],
    ["comprar um Apple Watch", "comprar um Apple Watch"],
    ["configurar o cron job", "configurar o cron job"],
    ["daily report do time", "daily report do time"],
    ["subir a v2.3.1 pro staging", "subir a v2.3.1 pro staging"],
    ["testar o endpoint /api/v1/tasks", "testar o endpoint /api/v1/tasks"],
    ["ver o Good Morning Brasil", "ver o Good Morning Brasil"],
  ]),

  ...section("mix", "out-of-scope", [
    [
      "move a call pra next friday",
      "move a call pra next friday",
      null,
      null,
      { outOfScope: "command" },
    ],
    ["what tenho amanhã?", "what tenho amanhã?", null, null, { outOfScope: "question" }],
    ["deploy amanhã and retro sexta", "deploy and retro", MON, null, { outOfScope: "multi-task" }],
  ]),
];
