import { describe, expect, it } from "vitest";
import { normalize, parseDuration, parseTaskText, parseWhen } from "./parse-task";

// Quarta-feira, 12 de agosto de 2026, 09:00.
const NOW = new Date(2026, 7, 12, 9, 0);

const at = (input: string) => {
  const parsed = parseWhen(input, NOW);
  if (!parsed) return null;
  const { date } = parsed;
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
};
const day = (input: string) => at(input)?.slice(0, 3);
const time = (input: string) => at(input)?.slice(3);

describe("dia — pt-BR", () => {
  it.each([
    ["hoje", [2026, 8, 12]],
    ["hj", [2026, 8, 12]],
    ["amanhã", [2026, 8, 13]],
    ["amanha", [2026, 8, 13]],
    ["depois de amanhã", [2026, 8, 14]],
    ["ontem", [2026, 8, 11]],
    ["anteontem", [2026, 8, 10]],
    ["esta noite", [2026, 8, 12]],
    ["15/08", [2026, 8, 15]],
    ["15/8/2027", [2027, 8, 15]],
    ["15 de agosto", [2026, 8, 15]],
    ["15 ago", [2026, 8, 15]],
    ["dia 15", [2026, 8, 15]],
    ["dia 3", [2026, 9, 3]], // já passou neste mês → mês que vem
    ["sexta", [2026, 8, 14]],
    ["sexta-feira", [2026, 8, 14]],
    ["quarta", [2026, 8, 12]], // hoje é quarta: conta como ela mesma
    ["próxima quarta", [2026, 8, 19]],
    ["sexta que vem", [2026, 8, 21]],
    ["semana que vem", [2026, 8, 19]],
    ["daqui a 3 dias", [2026, 8, 15]],
    ["em 2 semanas", [2026, 8, 26]],
  ])("%s", (input, expected) => {
    expect(day(input)).toEqual(expected);
  });
});

describe("dia — inglês", () => {
  it.each([
    ["today", [2026, 8, 12]],
    ["tomorrow", [2026, 8, 13]],
    ["tmr", [2026, 8, 13]],
    ["day after tomorrow", [2026, 8, 14]],
    ["yesterday", [2026, 8, 11]],
    ["tonight", [2026, 8, 12]],
    ["friday", [2026, 8, 14]],
    ["fri", [2026, 8, 14]],
    ["next friday", [2026, 8, 21]],
    ["next week", [2026, 8, 19]],
    ["august 15", [2026, 8, 15]],
    ["15 august", [2026, 8, 15]],
    ["aug 15", [2026, 8, 15]],
    ["in 3 days", [2026, 8, 15]],
    ["in 2 weeks", [2026, 8, 26]],
  ])("%s", (input, expected) => {
    expect(day(input)).toEqual(expected);
  });
});

describe("horário — pt-BR", () => {
  it.each([
    ["hoje às 14 horas", [14, 0]],
    ["hoje 14h", [14, 0]],
    ["hoje 14hs", [14, 0]],
    ["hoje às 14", [14, 0]],
    ["hoje 14:30", [14, 30]],
    ["hoje 14h30", [14, 30]],
    ["hoje 14.30", [14, 30]],
    ["hoje 14,30", [14, 30]],
    ["hoje 14 e 30", [14, 30]],
    ["hoje 2 e meia", [14, 30]],
    ["hoje às duas", [14, 0]], // 1h–7h sem período vira tarde
    ["hoje às duas e meia", [14, 30]],
    ["hoje às duas e trinta", [14, 30]],
    ["hoje às dois e quinze", [14, 15]],
    ["hoje às duas da manhã", [2, 0]],
    ["hoje às 2 da manhã", [2, 0]],
    ["hoje às 8", [20, 0]], // 8h já passou (são 9h) → a próxima ocorrência é 20h
    ["hoje às 8 da noite", [20, 0]],
    ["hoje meio-dia", [12, 0]],
    ["hoje meia-noite", [0, 0]],
    ["hoje meio dia e meia", [12, 30]],
    ["hoje meio-dia e quinze", [12, 15]],
    ["hoje meio dia e 40", [12, 40]],
    ["hoje meia noite e meia", [0, 30]],
    ["hoje às onze e quarenta e cinco", [11, 45]],
    ["amanhã de manhã", [9, 0]],
    ["amanhã à tarde", [14, 0]],
    ["amanhã à noite", [20, 0]],
    ["daqui a 2 horas", [11, 0]],
    ["daqui a 90 minutos", [10, 30]],
  ])("%s", (input, expected) => {
    expect(time(input)).toEqual(expected);
  });
});

describe("horário — inglês", () => {
  it.each([
    ["today at 2pm", [14, 0]],
    ["today at 9 pm", [21, 0]],
    ["today at 9am", [9, 0]],
    ["today at 14", [14, 0]],
    ["today 2 o'clock", [14, 0]],
    ["today at noon", [12, 0]],
    ["today at midnight", [0, 0]],
    ["today half past two", [14, 30]],
    ["today quarter past two", [14, 15]],
    ["today quarter to three", [14, 45]],
    ["tomorrow morning", [9, 0]],
    ["tomorrow afternoon", [14, 0]],
    ["tomorrow evening", [20, 0]],
    ["tonight", [20, 0]],
    ["in 2 hours", [11, 0]],
  ])("%s", (input, expected) => {
    expect(time(input)).toEqual(expected);
  });
});

describe("misturas pt/en na mesma frase", () => {
  it.each([
    ["tomorrow às 14h", [2026, 8, 13, 14, 0]],
    ["amanhã at 2pm", [2026, 8, 13, 14, 0]],
    ["next friday às 10 da manhã", [2026, 8, 21, 10, 0]],
    ["15 august às duas e meia", [2026, 8, 15, 14, 30]],
    ["sexta at noon", [2026, 8, 14, 12, 0]],
  ])("%s", (input, expected) => {
    expect(at(input)).toEqual(expected);
  });
});

// A regra do período: entre H e H+12 vale a próxima ocorrência — mas só quando o dia é hoje.
describe("período pela próxima ocorrência", () => {
  const twoPM = new Date(2026, 7, 12, 14, 0);
  const hhmm = (input: string, now: Date) => {
    const parsed = parseWhen(input, now);
    return parsed && [parsed.date.getDate(), parsed.date.getHours(), parsed.date.getMinutes()];
  };

  it.each([
    ["hoje às 3", [12, 15, 0]],
    ["hoje às 5", [12, 17, 0]],
    ["hoje às 9", [12, 21, 0]],
    ["hoje às 11", [12, 23, 0]],
    ["hoje às 15", [12, 15, 0]],
    ["amanhã às 9", [13, 9, 0]], // outro dia: leitura literal
    ["amanhã às 9 da noite", [13, 21, 0]],
    ["amanhã às 3", [13, 15, 0]], // 1h–7h em outro dia ainda vira tarde
  ])("às 14h: %s", (input, expected) => {
    expect(hhmm(input, twoPM)).toEqual(expected);
  });

  it("às 11h, 'hoje às 2' é 14h", () => {
    expect(hhmm("hoje às 2", new Date(2026, 7, 12, 11, 0))).toEqual([12, 14, 0]);
  });

  it("à 1h da manhã, 'às duas' é 2h — a próxima ocorrência", () => {
    expect(hhmm("às duas", new Date(2026, 7, 12, 1, 0))).toEqual([12, 2, 0]);
  });

  it("às 23h30, com as duas leituras no passado, fica a mais recente", () => {
    expect(hhmm("hoje às 11", new Date(2026, 7, 12, 23, 30))).toEqual([12, 23, 0]);
  });
});

describe("limites", () => {
  it("dia sozinho não inventa horário", () => {
    const parsed = parseWhen("amanhã", NOW);
    expect(parsed).toMatchObject({ hasDay: true, hasTime: false });
    expect(parsed?.date.getHours()).toBe(0);
  });

  it("horário sozinho assume hoje", () => {
    expect(at("às 16 horas")).toEqual([2026, 8, 12, 16, 0]);
    expect(parseWhen("às 16 horas", NOW)).toMatchObject({ hasDay: false, hasTime: true });
  });

  it("devolve null pro que não entende", () => {
    expect(parseWhen("", NOW)).toBeNull();
    expect(parseWhen("blablabla", NOW)).toBeNull();
  });

  it("ignora data impossível", () => {
    expect(parseWhen("32/08", NOW)).toBeNull();
    expect(parseWhen("dia 45", NOW)).toBeNull();
  });
});

describe("normalize — preserva comprimento", () => {
  it.each([
    "reunião com o time hoje às 16:30",
    "café da manhã amanhã",
    "ação urgentíssima",
    "reunião  com   espaço  duplo",
    "  espaço nas pontas  ",
    "hífen-no-meio e apóstrofo'aqui",
    "İ",
    "İstanbul amanhã",
    "café 😀 depois de amanhã",
    "ﬁnal de semana",
  ])("mantém o comprimento de %j", (input) => {
    expect(normalize(input)).toHaveLength(input.length);
  });

  it("continua tirando acento, caixa e hífen", () => {
    expect(normalize("Reunião-Geral")).toBe("reuniao geral");
  });

  it("İ (I maiusculo turco com ponto) vira i sem expandir pra 2 chars", () => {
    expect(normalize("İstanbul")).toBe("istanbul");
  });

  it("o índice de um match no normalizado vale no original", () => {
    const original = "reunião hoje às 16:30";
    const index = normalize(original).indexOf("hoje");
    expect(original.slice(index, index + 4)).toBe("hoje");
  });
});

/** O que sobra do input depois de tirar os spans — é o que o título vai virar. */
const rest = (input: string) => {
  const parsed = parseWhen(input, NOW);
  if (!parsed) return input;
  let out = input;
  for (const [start, end] of [...parsed.spans].sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, start) + out.slice(end);
  }
  return out.replace(/\s+/g, " ").trim();
};

describe("spans — o que sobra depois do recorte", () => {
  it.each([
    ["reunião hoje", "reunião"],
    ["reunião hoje às 16:30", "reunião"],
    ["dentista amanhã de manhã", "dentista"],
    ["call amanhã às 9 da noite", "call"],
    ["comprar pão dia 15", "comprar pão"],
    ["retro sexta que vem", "retro"],
  ])("%j → %j", (input, expected) => {
    expect(rest(input)).toBe(expected);
  });

  it("span aponta pro trecho certo do input original, com acento antes", () => {
    const parsed = parseWhen("reunião hoje", NOW);
    const [start, end] = parsed!.spans[0];
    expect("reunião hoje".slice(start, end)).toBe("hoje");
  });

  // pm/tonight batendo em applyMeridiem E em periodHour (ou em parseDay e parseTime) duplicava o
  // mesmo span; sem dedupe, o rest() consumia esse trecho duas vezes e comia texto real depois dele.
  it.each([
    ["call at 9 tonight then buy milk", "call then buy milk"],
    ["reuniao as 9 da noite depois trazer cafe", "reuniao depois trazer cafe"],
  ])("nao duplica span sobreposto: %j → %j", (input, expected) => {
    expect(rest(input)).toBe(expected);
  });

  // withMinutes já tinha teste de conector; os formatos irmãos (mesmo CONNECTOR_RE) não tinham.
  it.each([
    ["reuniao as 14 e 30", "reuniao"],
    ["call at half past two", "call"],
    ["reuniao as duas", "reuniao"],
    ["call at noon", "call"],
    ["call at midnight", "call"],
  ])("conector consumido junto no formato: %j → %j", (input, expected) => {
    expect(rest(input)).toBe(expected);
  });
});

describe("duração explícita", () => {
  it.each([
    ["call de 1h", "1h"],
    ["call de 30min", "30m"],
    ["call de 45 minutos", "45m"],
    ["call de 1h30", "1h30m"],
    ["call de meia hora", "30m"],
    ["call de 2 horas", "2h"],
  ])("%j → %s", (input, expected) => {
    expect(parseDuration(normalize(input))?.duration).toBe(expected);
  });

  it("não inventa duração onde não tem", () => {
    expect(parseDuration(normalize("reunião com o time"))).toBeNull();
  });
});

describe("intervalo — início e duração no mesmo achado", () => {
  it.each([
    ["reunião das 15 às 16", "1h", 15, 0],
    ["reunião das 9 às 10:30", "1h30m", 9, 0],
    ["reunião 15h-16h", "1h", 15, 0],
    ["reunião das 14:15 às 14:45", "30m", 14, 15],
  ])("%j → %s começando %d:%d", (input, duration, hour, minute) => {
    const parsed = parseDuration(normalize(input));
    expect(parsed?.duration).toBe(duration);
    expect(parsed?.start).toEqual({ hour, minute });
  });

  it("intervalo que vira o dia seguinte não é intervalo", () => {
    expect(parseDuration(normalize("plantão das 22 às 6"))).toBeNull();
  });
});

describe("duração — rejeita falso positivo", () => {
  it.each([
    // Critical 1: "Nh"/"NhNNm" solto é horário em pt-BR, não duração — precisa de "de/por/durante".
    "reunião 14h",
    "reunião 9h30",
    // Critical 2: sem conector textual, "22h-6h" cai no fallback de duração explícita sem guarda.
    "plantão 22h-6h",
    // Important 4: conector "a" pelado entre dois números não é intervalo de horário.
    "15/08 a 16/08",
    "partida 1 a 7",
    // Important 5 + 6: sem prefixo obrigatório, número seguido de unidade em outro contexto.
    "comprar 5m de cabo",
    "reunião sala 3h andar",
    "comprar 2 metros de corda",
    "pagar conta de 100 reais",
    "ligar 3 vezes",
    "reunião sala 3 andar",
  ])("%j → null", (input) => {
    expect(parseDuration(normalize(input))).toBeNull();
  });

  // Limitação conhecida e aceita (ver relatório): "das X as Y" é a forma completa e correta de um
  // intervalo — o parser não tem como saber que aqui "Y" conta pessoas, não horas, sem semântica.
  it("'das N as M <substantivo>' ainda é lido como intervalo — limitação documentada", () => {
    expect(parseDuration(normalize("das 3 as 5 pessoas"))?.duration).toBe("2h");
  });
});

describe("parseTaskText — o pacote inteiro", () => {
  const parse = (input: string) => parseTaskText(input, NOW);

  it("frase completa: texto limpo e três campos", () => {
    const r = parse("Reunião com o time das 15 às 16 meet.google.com/abc-defg");
    expect(r.text).toBe("Reunião com o time");
    expect(r.duration).toBe("1h");
    expect(r.date?.getHours()).toBe(15);
    expect(r.links).toEqual(["https://meet.google.com/abc-defg"]);
  });

  it("intervalo ganha do horário simples", () => {
    const r = parse("call das 15 às 16");
    expect(r.text).toBe("call");
    expect(r.date?.getHours()).toBe(15);
    expect(r.duration).toBe("1h");
  });

  it("sem duração no texto, duration é null", () => {
    const r = parse("dentista hoje às 14h");
    expect(r.text).toBe("dentista");
    expect(r.duration).toBeNull();
  });

  it("frase sem tempo nenhum", () => {
    const r = parse("comprar leite");
    expect(r.text).toBe("comprar leite");
    expect(r.date).toBeNull();
  });

  it("frase que é só tempo deixa o texto vazio", () => {
    expect(parse("hoje às 16h").text).toBe("");
  });

  it("não deixa espaço duplo onde recortou", () => {
    expect(parse("reunião hoje às 16:30 com o time").text).toBe("reunião com o time");
  });

  it.each([
    ["reunião, hoje às 16h, com o time", "reunião, com o time"],
    ["reunião (hoje às 16h) com o time", "reunião com o time"],
    ["call de 30min. hoje às 14h com cliente", "call. com cliente"],
    ["reunião hoje às 16h.", "reunião."],
    ["reunião hoje às 16h!", "reunião!"],
  ])("não deixa pontuação órfã: %j → %j", (input, expected) => {
    expect(parse(input).text).toBe(expected);
  });

  it.each([
    ["comprar leite, pão e ovos", "comprar leite, pão e ovos"],
    ["reunião (sala 3) amanhã", "reunião (sala 3)"],
    ["uau!! preciso comprar leite hoje", "uau!! preciso comprar leite"],
    ["socorro?! preciso de ajuda hoje", "socorro?! preciso de ajuda"],
    ["tarefa!!! hoje", "tarefa!!!"],
  ])("não mexe em pontuação legítima: %j → %j", (input, expected) => {
    expect(parse(input).text).toBe(expected);
  });

  it("separador de lista pendurado no fim, sem nada depois pra separar", () => {
    expect(parse("ligar pro cliente: urgente, hoje às 14h").text).toBe(
      "ligar pro cliente: urgente",
    );
  });

  it("hora explícita: hasTime true", () => {
    expect(parse("dentista hoje às 14h").hasTime).toBe(true);
  });

  it("só o dia, sem hora: hasTime false — não pode virar meia-noite no chip", () => {
    expect(parse("comprar leite amanhã").hasTime).toBe(false);
  });

  it("intervalo: hasTime true, o início veio do próprio intervalo", () => {
    expect(parse("reunião das 15 às 16").hasTime).toBe(true);
  });
});
