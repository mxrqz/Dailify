import { describe, it, expect } from "vitest";
import { expandRecurringTask } from "./recurrence";
import { fromRrule, toRrule } from "./rrule";
import { zonedEpoch, zonedParts } from "./timezone";
import type { Task } from "./types";

const SP = "America/Sao_Paulo";
const NY = "America/New_York";
const at = (tz: string, year: number, month: number, day: number, hour = 9, minute = 0) =>
  zonedEpoch({ year, month, day, hour, minute, second: 0 }, tz);

const task = (over: Partial<Task>): Task => ({
  id: "t",
  title: "x",
  date: at(SP, 2026, 0, 14),
  duration: "30m",
  priority: 0,
  repeat: "Daily",
  completed: [],
  ...over,
});

const series = ({ repeat, repeatEvery, repeatUntil, exdates }: Task) => ({
  repeat,
  repeatEvery,
  repeatUntil,
  exdates,
});

const roundTrip = (t: Task, tz: string) =>
  fromRrule(toRrule(t, zonedParts(t.date, tz), tz) ?? [], t.date, tz);

describe("toRrule/fromRrule", () => {
  const cases: [string, string, Task][] = [
    ["diária", SP, task({})],
    ["a cada 3 dias com fim", SP, task({ repeatEvery: 3, repeatUntil: at(SP, 2026, 5, 1) })],
    [
      "seg e qua com exceção",
      SP,
      task({
        repeat: { Weekly: ["Monday", "Wednesday"] },
        date: at(SP, 2026, 0, 12),
        exdates: [at(SP, 2026, 0, 19)],
      }),
    ],
    [
      "a cada 2 semanas, qua e sex",
      NY,
      task({
        repeat: { Weekly: ["Wednesday", "Friday"] },
        repeatEvery: 2,
        date: at(NY, 2026, 0, 14),
      }),
    ],
    ["mensal no 15", NY, task({ repeat: "Monthly", date: at(NY, 2026, 0, 15, 20, 30) })],
    ["mensal no 31 (corte)", SP, task({ repeat: "Monthly", date: at(SP, 2026, 0, 31) })],
    ["anual em 29/02", NY, task({ repeat: "Yearly", date: at(NY, 2028, 1, 29) })],
    ["anual a cada 2", SP, task({ repeat: "Yearly", repeatEvery: 2 })],
    // Exceção do outro lado do horário de verão: a hora de parede é a mesma, o offset não.
    [
      "diária atravessando o DST",
      NY,
      task({
        date: at(NY, 2026, 2, 1),
        exdates: [at(NY, 2026, 2, 10)],
        repeatUntil: at(NY, 2026, 3, 1),
      }),
    ],
  ];
  for (const [name, tz, t] of cases)
    it(`ida e volta: ${name}`, () => expect(roundTrip(t, tz)).toEqual(series(t)));

  it("UNTIL em UTC com horário; só a data e EXDATE;VALUE=DATE no dia inteiro", () => {
    const until = Date.UTC(2026, 11, 31, 12);
    expect(toRrule(task({ repeatUntil: until }), zonedParts(at(SP, 2026, 0, 14), SP), SP)).toEqual([
      "RRULE:FREQ=DAILY;UNTIL=20261231T120000Z",
    ]);
    const allDay = task({ undated: true, repeatUntil: until, exdates: [at(SP, 2026, 0, 20)] });
    expect(toRrule(allDay, zonedParts(allDay.date, SP), SP)).toEqual([
      "RRULE:FREQ=DAILY;UNTIL=20261231",
      "EXDATE;VALUE=DATE:20260120",
    ]);
  });

  it("lê o que o Google escreve", () => {
    const start = at(NY, 2026, 10, 2); // segunda
    expect(fromRrule(["RRULE:FREQ=WEEKLY;WKST=SU;BYDAY=MO,TU,WE,TH,FR"], start, NY)).toEqual({
      repeat: { Weekly: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
    });
    expect(
      fromRrule(
        ["EXDATE;TZID=America/Sao_Paulo:20261110T110000", "RRULE:FREQ=DAILY;UNTIL=20261130"],
        start,
        NY,
      ),
    ).toEqual({
      repeat: "Daily",
      repeatUntil: zonedEpoch(
        { year: 2026, month: 10, day: 30, hour: 23, minute: 59, second: 59, ms: 999 },
        NY,
      ),
      exdates: [at(SP, 2026, 10, 10, 11)],
    });
    expect(fromRrule(["RRULE:FREQ=DAILY", "EXDATE:20261103T140000Z"], start, NY)?.exdates).toEqual([
      Date.UTC(2026, 10, 3, 14),
    ]);
  });

  it("COUNT vira UNTIL na última ocorrência, que a expansão respeita", () => {
    const start = at(NY, 2026, 9, 30); // sexta, antes do fim do horário de verão
    const parsed = fromRrule(["RRULE:FREQ=WEEKLY;BYDAY=MO,FR;COUNT=4"], start, NY);
    expect(parsed?.repeatUntil).toBe(at(NY, 2026, 10, 9));
    const t = task({ ...parsed, date: start });
    expect(expandRecurringTask(t, new Date(2026, 10, 1), NY).map((i) => i.date)).toEqual([
      at(NY, 2026, 10, 2),
      at(NY, 2026, 10, 6),
      at(NY, 2026, 10, 9),
    ]);
    expect(fromRrule(["RRULE:FREQ=DAILY;COUNT=1"], start, NY)?.repeatUntil).toBe(start);
  });

  it("o que não cabe no modelo vira null", () => {
    const thu = at(SP, 2026, 0, 15);
    for (const rule of [
      ["RRULE:FREQ=MONTHLY;BYDAY=2TU"],
      ["RRULE:FREQ=HOURLY"],
      ["RRULE:FREQ=DAILY", "RDATE:20260120T090000"],
      ["RRULE:FREQ=DAILY;BYHOUR=9"],
      ["RRULE:FREQ=DAILY;COUNT=2;UNTIL=20260130"],
      ["EXDATE:20260120T090000"],
      // Segunda vem antes de quinta numa semana que começa no domingo: bloco de 7 dias errado.
      ["RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=MO,TH"],
      ["RRULE:FREQ=DAILY", "EXDATE;TZID=Nowhere/City:20260120T090000"],
    ])
      expect(fromRrule(rule, thu, SP)).toBeNull();
    // Mensal no 31 sem o corte pula os meses curtos; a Mewki não.
    expect(fromRrule(["RRULE:FREQ=MONTHLY"], at(SP, 2026, 0, 31), SP)).toBeNull();
    expect(fromRrule(["RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TH,FR"], thu, SP)).toEqual({
      repeat: { Weekly: ["Thursday", "Friday"] },
      repeatEvery: 2,
    });
  });
});
