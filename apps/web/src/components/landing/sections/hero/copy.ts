// Cenas do hero: `say` é a fala do usuário (pode "pra"); `reply` é a Mewki ("para"), com
// *trechos* em destaque. `rows[].at` é o trecho da fala que faz a linha aparecer no balão.
export const copy = {
  // \n = quebra pedida no layout (a tradução escolhe onde quebrar)
  title: "Como posso\nte ajudar hoje?",
  sub: "Fale do seu jeito. A Mewki entende, anota, pesquisa, responde e salva na sua agenda.",
  cta: "Começar",
  ctaNote: "Crie sua conta e deixe a Mew cuidar das tarefas chatas por você.",
  placeholder: "Escreva ou fale o que precisa",
  thinking: "Pensando",
  noting: "Anotando",
  understood: "Entendi",
  calendar: { month: "NOV", day: "14" },
  scenes: [
    {
      say: "Anota pra mim que tenho uma reunião de feedback no dia 23 às 13:30 com o Lucas",
      cal: "23",
      reply:
        "Pronto! Reunião de feedback com o Lucas na *segunda, 23, às 13:30*. Já tá na sua agenda.",
      rows: [
        { at: "feedback", kind: "title", text: "Reunião de feedback" },
        { at: "23", kind: "date", text: "Seg, 23 nov" },
        { at: "13:30", kind: "time", text: "13:30 · 1h" },
        { at: "Lucas", kind: "user", text: "Com Lucas" },
      ],
    },
    {
      say: "Me lembra de tomar o remédio todo dia às 22h",
      cal: "14",
      reply: "Feito! Vou te lembrar do remédio *todo dia às 22h*.",
      rows: [
        { at: "remédio", kind: "title", text: "Tomar o remédio" },
        { at: "todo dia", kind: "repeat", text: "Todo dia" },
        { at: "22h", kind: "time", text: "22:00" },
      ],
    },
    {
      say: "Marca dentista sexta às 10h e me avisa um dia antes",
      cal: "20",
      reply: "Dentista marcado para *sexta às 10h*. Na quinta eu te dou um toque.",
      rows: [
        { at: "dentista", kind: "title", text: "Dentista" },
        { at: "sexta", kind: "date", text: "Sex, 20 nov" },
        { at: "10h", kind: "time", text: "10:00 · 30 min" },
        { at: "antes", kind: "bell", text: "Aviso na quinta, 10:00" },
      ],
    },
    {
      say: "Treino de perna toda segunda, quarta e sexta às 7h",
      cal: "16",
      reply: "Treino de perna na agenda: *seg, qua e sex às 7h*. Bora!",
      rows: [
        { at: "perna", kind: "title", text: "Treino de perna" },
        { at: "sexta", kind: "repeat", text: "Seg, qua e sex" },
        { at: "7h", kind: "time", text: "07:00 · 1h" },
      ],
    },
  ],
} as const;

export type Scene = (typeof copy.scenes)[number];
export type RowKind = Scene["rows"][number]["kind"];
