/**
 * Conversão entre epoch-ms e hora-de-parede num fuso EXPLÍCITO.
 *
 * O `new Date(y, m, d, h)` do JS usa o fuso do runtime — que no browser é o do usuário e no Worker
 * é sempre UTC. A mesma tarefa recorrente expandida nos dois lados dava horas diferentes, e uma
 * tarefa perto da meia-noite caía no mês vizinho para quem mora longe de UTC.
 *
 * Sem dependência: `Intl` já carrega o banco de fusos, e o algoritmo é o mesmo que as bibliotecas
 * usam — formatar no fuso alvo para descobrir o offset e descontá-lo.
 */
export interface ZonedParts {
  year: number;
  /** 0-11, como em `Date` */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms?: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  // Criar um DateTimeFormat custa ~1ms; a expansão de um mês chama isto dezenas de vezes.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(timeZone, dtf);
  return dtf;
}

export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const values: Record<string, string> = {};
  for (const { type, value } of formatter(timeZone).formatToParts(new Date(epochMs))) {
    values[type] = value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month) - 1,
    day: Number(values.day),
    // Alguns runtimes ainda devolvem "24" para a meia-noite mesmo com hourCycle h23.
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
    ms: epochMs - Math.floor(epochMs / 1000) * 1000,
  };
}

/** Quanto o fuso está à frente do UTC naquele instante, em ms. */
function offsetAt(epochMs: number, timeZone: string): number {
  const p = zonedParts(epochMs, timeZone);
  const asIfUTC = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asIfUTC - (epochMs - (p.ms ?? 0));
}

/** Instante em que aquela hora-de-parede acontece no fuso dado. */
export function zonedEpoch(parts: ZonedParts, timeZone: string): number {
  const naive = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.ms ?? 0,
  );
  // Duas passadas: perto de uma virada de horário de verão o offset do primeiro chute pode ser o
  // do outro lado da virada, e a segunda leitura já cai no lado certo.
  const guess = naive - offsetAt(naive, timeZone);
  return naive - offsetAt(guess, timeZone);
}

/** Dias do mês — calendário gregoriano, não depende de fuso. */
export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
