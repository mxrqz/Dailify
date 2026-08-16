# Composer de campo único — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar os dois campos do composer por um só, extraindo data, duração e links do próprio texto e recortando do título o que foi consumido.

**Architecture:** `parse-when.ts` vira `parse-task.ts`. Os detectores deixam de devolver só o valor e passam a devolver também os spans do texto que casaram; um passo final recorta todos de uma vez e o que sobra é o título. Links viram uma coluna nova no D1, no mesmo formato JSON que `tags` já usa, validados na rota antes de virarem `<a href>`.

**Tech Stack:** TypeScript, React 18, vitest (sem jsdom — tudo que tem lógica é função pura), Hono + D1 no servidor, bun como package manager.

**Spec:** `docs/superpowers/specs/2026-08-14-composer-extraction-design.md`

## Global Constraints

- **Sem `as`.** Type guard ou tipo de verdade. `as const` é permitido. (ESLint warning, root `CLAUDE.md`)
- **Sem hex nem cor arbitrária** em componente — só token de `global.css`.
- **Nenhuma string literal no JSX** — tudo em `components/dashboard/copy.ts`, em pt-BR.
- **Datas são epoch-ms `number`** na fronteira com o servidor; `Date` só dentro do web.
- **Prettier `printWidth: 100`** — rode `bun run format` antes de commitar.
- **Gate completo:** `bun run check` (format + lint + typecheck + test) na raiz roda os dois workspaces.
- **Comentário só pro não-óbvio** — uma linha explicando *por quê*, nunca docblock narrando o que o código já diz.
- **Todo comando roda da raiz do worktree**, `/mnt/LinuxData/home/mxrqz/projects/Dailify/.claude/worktrees/task-edit-sidebar`.

---

### Task 1: Normalização que preserva comprimento

O `normalize()` de hoje encurta a string (NFD + remoção de diacríticos, `\s+ → " "`, `trim()`), então nenhum índice medido nele mapeia de volta pro texto original. Sem isso resolvido, todo span das tarefas seguintes aponta pro lugar errado. É a fundação.

**Files:**
- Modify: `apps/web/src/functions/parse-when.ts:167-176`
- Test: `apps/web/src/functions/parse-when.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `normalize(input: string): string` — mesma assinatura de hoje, agora com a garantia `normalize(s).length === s.length`

- [ ] **Step 1: Escreva o teste que falha**

Adicione ao fim de `apps/web/src/functions/parse-when.test.ts`:

```ts
describe("normalize — preserva comprimento", () => {
  it.each([
    "reunião com o time hoje às 16:30",
    "café da manhã amanhã",
    "ação urgentíssima",
    "reunião  com   espaço  duplo",
    "  espaço nas pontas  ",
    "hífen-no-meio e apóstrofo'aqui",
  ])("mantém o comprimento de %j", (input) => {
    expect(normalize(input)).toHaveLength(input.length);
  });

  it("continua tirando acento, caixa e hífen", () => {
    expect(normalize("Reunião-Geral")).toBe("reuniao geral");
  });

  it("o índice de um match no normalizado vale no original", () => {
    const original = "reunião hoje às 16:30";
    const index = normalize(original).indexOf("hoje");
    expect(original.slice(index, index + 4)).toBe("hoje");
  });
});
```

E acrescente `normalize` ao import do topo do arquivo:

```ts
import { normalize, parseWhen } from "./parse-when";
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: FAIL. `"reunião com o time hoje às 16:30"` tem 32 chars e o `normalize` atual devolve 31 — o `ã` vira `a` depois do NFD, perdendo o combining char.

- [ ] **Step 3: Implemente**

Substitua `apps/web/src/functions/parse-when.ts:167-176` por:

```ts
/**
 * minúsculas, sem acento, hífens e apóstrofos viram espaço — **1 char entra, 1 char sai**.
 * O comprimento é contrato: os detectores medem spans no texto normalizado e o recorte acontece
 * no original. Colapsar espaço ou dar trim aqui desalinharia os dois.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => {
      const stripped = char.normalize("NFD").replace(/[̀-ͯ]/g, "");
      // "ﬁ" e afins expandem em NFD; só aceita a troca quando continua sendo um char.
      const base = stripped.length === 1 ? stripped : char;
      return /[-–—'’]/.test(base) ? " " : base;
    })
    .join("");
}
```

> O colapso de espaço e o `trim()` que saíram eram redundantes: `alternation()` (`parse-when.ts:186`) já troca todo espaço literal dos padrões por `\s+`, então os regexes toleram espaço múltiplo sozinhos.

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: PASS — os novos e **todos os 199 antigos**. Se algum antigo quebrar, é um regex que dependia do `trim()`; conserte o regex, não a normalização.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/parse-when.ts apps/web/src/functions/parse-when.test.ts
git commit -m "refactor(web): normalize preserva comprimento, pra span mapear no original"
```

---

### Task 2: Spans no detector de tempo e dia

`parseDay`/`parseTime` sabem *o que* casaram, mas jogam fora *onde*. Cada `return` passa a carregar o span do match que o produziu.

**Files:**
- Modify: `apps/web/src/functions/parse-when.ts` (todo o corpo de `parseTime`, `parseDay`, `applyMeridiem`, `periodHour`, `parseWhen`)
- Test: `apps/web/src/functions/parse-when.test.ts`

**Interfaces:**
- Consumes: `normalize` da Task 1
- Produces:
  ```ts
  export type Span = [number, number];
  export interface ParsedWhen {
    date: Date;
    hasDay: boolean;
    hasTime: boolean;
    spans: Span[];   // NOVO — trechos do input consumidos, em ordem de descoberta
  }
  ```

- [ ] **Step 1: Escreva o teste que falha**

Adicione a `apps/web/src/functions/parse-when.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: FAIL com `Property 'spans' does not exist on type 'ParsedWhen'`.

- [ ] **Step 3: Implemente**

Três mudanças em `apps/web/src/functions/parse-when.ts`.

**3a.** Logo depois da interface `ParsedWhen` (topo do arquivo), acrescente o tipo e o helper:

```ts
export type Span = [number, number];

/** Valor + os trechos do texto que o produziram. `spans` vazio = veio de lugar nenhum. */
interface Hit<T> {
  value: T;
  spans: Span[];
}

/** O span de um `String.match`. */
function spanOf(match: RegExpMatchArray): Span {
  const start = match.index ?? 0;
  return [start, start + match[0].length];
}

/** Embrulha o resultado de um `String.match` com o span dele. */
function hit<T>(match: RegExpMatchArray, value: T, extra: Span[] = []): Hit<T> {
  return { value, spans: [spanOf(match), ...extra] };
}
```

E some `spans: Span[]` a `ParsedWhen`.

**3b.** `applyMeridiem` e `periodHour` passam a devolver o span do que casaram, porque o meridiano é um trecho separado do horário:

```ts
function periodHour(text: string): Hit<number> | null {
  const patterns: [RegExp, number][] = [
    [/\b(tonight|esta\s+noite|a\s+noite|da\s+noite|de\s+noite|evening|at\s+night)\b/, PERIOD_HOURS.evening],
    [/\b(de\s+manha|da\s+manha|pela\s+manha|morning)\b/, PERIOD_HOURS.morning],
    [/\b(a\s+tarde|de\s+tarde|da\s+tarde|afternoon)\b/, PERIOD_HOURS.afternoon],
    [/\b(de\s+madrugada|da\s+madrugada|dawn)\b/, PERIOD_HOURS.dawn],
  ];
  for (const [re, hour] of patterns) {
    const match = text.match(re);
    if (match) return hit(match, hour);
  }
  return null;
}
```

`applyMeridiem` muda do mesmo jeito. Hoje ele testa os padrões de meridiano direto sobre `text` e devolve só o `Time`; passa a guardar qual casou e devolver o span junto:

```ts
function applyMeridiem(
  time: Time,
  text: string,
  now: Date,
  baseIsToday: boolean,
): Hit<Time> {
  const pm = text.match(/\bpm\b/);
  const am = text.match(/\bam\b/);
  const period = periodHour(text);

  // A regra de conversão em si não muda — só passa a carregar de onde a pista veio.
  const spans: Span[] = [];
  if (pm) spans.push(spanOf(pm));
  if (am) spans.push(spanOf(am));
  if (period) spans.push(...period.spans);

  return { value: /* … a mesma Time que ele já calculava … */ time, spans };
}
```

O corpo que decide 9 → 21 continua idêntico; o que entra é o `spans` no retorno. Todos os `return applyMeridiem(…)` de `parseTime` viram `hit(match, m.value, m.spans)`, como no exemplo abaixo.

**3c.** Cada `return` de `parseTime`/`parseDay` vira `hit(match, valor)`. O padrão é sempre o mesmo:

```ts
// antes
const withMinutes = text.match(/\b(\d{1,2})\s*[:h.,]\s*(\d{2})\b/);
if (withMinutes) {
  const hour = Number(withMinutes[1]);
  const minute = Number(withMinutes[2]);
  if (hour <= 24 && minute < 60) return applyMeridiem({ hour, minute }, text, now, baseIsToday);
}

// depois
const withMinutes = text.match(/\b(\d{1,2})\s*[:h.,]\s*(\d{2})\b/);
if (withMinutes) {
  const hour = Number(withMinutes[1]);
  const minute = Number(withMinutes[2]);
  if (hour <= 24 && minute < 60) {
    const meridiem = applyMeridiem({ hour, minute }, text, now, baseIsToday);
    return hit(withMinutes, meridiem.value, meridiem.spans);
  }
}
```

E `parseWhen` junta os dois:

```ts
export function parseWhen(input: string, now: Date = new Date()): ParsedWhen | null {
  const text = normalize(input);
  if (!text.trim()) return null;

  const day = parseDay(text, now);
  const base = day?.value ?? startOfDay(now);
  const baseIsToday = base.getTime() === startOfDay(now).getTime();

  const time = parseTime(text, now, baseIsToday);
  if (!day && !time) return null;

  const date = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    time?.value.hour ?? 0,
    time?.value.minute ?? 0,
  );

  return {
    date,
    hasDay: day !== null,
    hasTime: time !== null,
    spans: [...(day?.spans ?? []), ...(time?.spans ?? [])],
  };
}
```

> Note o `!text.trim()` no lugar do `!text`: sem o `trim()` da normalização, uma string de espaços não vira `""` sozinha.

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: PASS, os novos e os 199 antigos — eles só leem `date`, então continuam válidos sem tocar em nada.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/parse-when.ts apps/web/src/functions/parse-when.test.ts
git commit -m "feat(web): parseWhen devolve os spans do que consumiu"
```

---

### Task 3: Detector de duração e intervalo

**Files:**
- Modify: `apps/web/src/functions/parse-when.ts`
- Test: `apps/web/src/functions/parse-when.test.ts`

**Interfaces:**
- Consumes: `Hit`, `Span`, `hit()` da Task 2
- Produces:
  ```ts
  export interface ParsedDuration {
    duration: string;          // "1h30m", formato do model
    start: { hour: number; minute: number } | null;  // só o intervalo tem início
  }
  export function parseDuration(input: string): (ParsedDuration & { spans: Span[] }) | null;
  ```

- [ ] **Step 1: Escreva o teste que falha**

Crie `describe` novo em `apps/web/src/functions/parse-when.test.ts`:

```ts
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
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: FAIL — `parseDuration is not exported`.

- [ ] **Step 3: Implemente**

Acrescente a `apps/web/src/functions/parse-when.ts`:

```ts
export interface ParsedDuration {
  duration: string;
  start: { hour: number; minute: number } | null;
}

/** minutos → "1h30m" / "45m" / "2h", o formato que `Task.duration` já usa. */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours ? `${hours}h` : ""}${minutes ? `${minutes}m` : ""}` || "0m";
}

const CLOCK = String.raw`(\d{1,2})(?:\s*[:h.,]\s*(\d{2}))?`;

/**
 * Intervalo primeiro, duração explícita depois. A ordem é a regra de precedência do spec: em
 * "das 15 às 16" o detector de horário simples também casaria o "15", e os dois spans brigariam.
 */
export function parseDuration(text: string): (ParsedDuration & { spans: Span[] }) | null {
  const range = text.match(
    new RegExp(String.raw`\b(?:das?\s+)?${CLOCK}\s*(?:as?|ate|-|—|a)\s*${CLOCK}\b`),
  );
  if (range) {
    const startMinutes = Number(range[1]) * 60 + Number(range[2] ?? 0);
    const endMinutes = Number(range[3]) * 60 + Number(range[4] ?? 0);
    // Intervalo que "volta no tempo" é outra coisa (data numérica, placar, o que for) — não é nosso.
    if (endMinutes > startMinutes && Number(range[1]) <= 24 && Number(range[3]) <= 24) {
      return {
        spans: [spanOf(range)],
        duration: formatDuration(endMinutes - startMinutes),
        start: { hour: Number(range[1]), minute: Number(range[2] ?? 0) },
      };
    }
  }

  const half = text.match(/\b(?:de\s+)?meia\s+hora\b/);
  if (half) return { spans: [spanOf(half)], duration: "30m", start: null };

  const explicit = text.match(
    /\b(?:de\s+|por\s+)?(\d{1,3})\s*(h|hs|horas?|hours?)\s*(\d{1,2})?\b|\b(?:de\s+|por\s+)?(\d{1,3})\s*(min|minutos?|minutes?|m)\b/,
  );
  if (explicit) {
    const minutes = explicit[1]
      ? Number(explicit[1]) * 60 + Number(explicit[3] ?? 0)
      : Number(explicit[4]);
    if (minutes > 0) {
      return { spans: [spanOf(explicit)], duration: formatDuration(minutes), start: null };
    }
  }

  return null;
}
```

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: PASS. Se "call de 1h30" voltar `"1h"`, o grupo `(\d{1,2})?` depois de `h` não está casando — confira que não tem `\b` entre o `h` e os minutos.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/parse-when.ts apps/web/src/functions/parse-when.test.ts
git commit -m "feat(web): parser de duracao explicita e de intervalo"
```

---

### Task 4: Detector de links

**Files:**
- Create: `apps/web/src/functions/parse-links.ts`
- Test: `apps/web/src/functions/parse-links.test.ts`

**Interfaces:**
- Consumes: `Span` (importado de `./parse-when`)
- Produces: `export function parseLinks(input: string): { urls: string[]; spans: Span[] }`

> Este detector trabalha no **texto original**, não no normalizado: URL tem caixa significativa em path e query (`youtu.be/AbC` ≠ `youtu.be/abc`). Como a normalização é 1:1, os spans continuam compatíveis com os dos outros detectores.

- [ ] **Step 1: Escreva o teste que falha**

Crie `apps/web/src/functions/parse-links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLinks } from "./parse-links";

const urls = (input: string) => parseLinks(input).urls;

describe("aceita", () => {
  it.each([
    ["reunião https://meet.google.com/abc-defg", "https://meet.google.com/abc-defg"],
    ["ver http://exemplo.com", "http://exemplo.com"],
    ["ver www.youtube.com", "https://www.youtube.com"],
    ["assistir youtube.com/watch?v=aBc123", "https://youtube.com/watch?v=aBc123"],
    ["abrir dailify.mxrqz.com", "https://dailify.mxrqz.com"],
  ])("%j", (input, expected) => {
    expect(urls(input)).toEqual([expected]);
  });

  it("acha mais de um", () => {
    expect(urls("call meet.google.com/abc pauta em notion.so/xyz")).toEqual([
      "https://meet.google.com/abc",
      "https://notion.so/xyz",
    ]);
  });

  it("preserva a caixa do path", () => {
    expect(urls("ver youtu.be/AbC123")).toEqual(["https://youtu.be/AbC123"]);
  });
});

describe("ignora", () => {
  it.each([
    "editar o main.ts",
    "rodar o deploy.sh",
    "abrir index.html",
    "comprar 2.5kg de arroz",
    "reunião com o time",
    "custou R$ 19.90",
  ])("%j", (input) => {
    expect(urls(input)).toEqual([]);
  });
});

describe("pontuação", () => {
  it.each([
    ["veja youtube.com/abc.", "https://youtube.com/abc"],
    ["veja youtube.com/abc,", "https://youtube.com/abc"],
    ["veja (youtube.com/abc)", "https://youtube.com/abc"],
  ])("%j apara o final", (input, expected) => {
    expect(urls(input)).toEqual([expected]);
  });
});

describe("spans", () => {
  it("aponta pro trecho exato do original", () => {
    const input = "reunião meet.google.com/abc hoje";
    const [start, end] = parseLinks(input).spans[0];
    expect(input.slice(start, end)).toBe("meet.google.com/abc");
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-links
```

Esperado: FAIL — `Cannot find module './parse-links'`.

- [ ] **Step 3: Implemente**

Crie `apps/web/src/functions/parse-links.ts`:

```ts
import type { Span } from "./parse-when";

// Curta de propósito: `ts`, `sh`, `py`, `rs`, `go` e `md` são TLDs reais E extensões de arquivo.
// Num app usado por quem escreve "main.ts" numa tarefa, a lista completa da IANA transformaria
// nome de arquivo em link. Errar pro lado de "não é link" é o certo aqui — não troque pela IANA.
const TLDS = ["com", "br", "org", "net", "io", "dev", "app", "me", "gg", "co", "ai", "xyz"];

const SCHEME_RE = /^https?:\/\//i;
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

function toAbsolute(candidate: string): string | null {
  const withScheme = SCHEME_RE.test(candidate) ? candidate : `https://${candidate}`;
  if (!URL.canParse(withScheme)) return null;

  const { protocol, hostname } = new URL(withScheme);
  if (protocol !== "http:" && protocol !== "https:") return null;

  // Sem esquema e sem "www.", só passa com TLD da allowlist — é o que separa "youtube.com/x"
  // (link) de "main.ts" (nome de arquivo).
  if (!SCHEME_RE.test(candidate) && !/^www\./i.test(candidate)) {
    const tld = hostname.split(".").pop()?.toLowerCase();
    if (!tld || !TLDS.includes(tld)) return null;
  }

  return withScheme;
}

/**
 * Varre por token (separado por espaço) em vez de um regex de URL gigante: a decisão de "isso é
 * link?" fica em `toAbsolute`, testável e legível, e não num padrão de 200 caracteres.
 */
export function parseLinks(input: string): { urls: string[]; spans: Span[] } {
  const urls: string[] = [];
  const spans: Span[] = [];

  for (const match of input.matchAll(/\S+/g)) {
    const raw = match[0];
    const start = match.index ?? 0;

    const trimmed = raw.replace(TRAILING_RE, "").replace(/^[([{'"]+/, "");
    if (!trimmed.includes(".")) continue;

    const url = toAbsolute(trimmed);
    if (!url) continue;

    const offset = raw.indexOf(trimmed);
    urls.push(url);
    spans.push([start + offset, start + offset + trimmed.length]);
  }

  return { urls, spans };
}
```

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- parse-links
```

Esperado: PASS. Se "custou R$ 19.90" virar link, o `URL.canParse` aceitou `https://19.90` — acrescente ao `toAbsolute` a exigência de que o TLD não seja numérico.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/parse-links.ts apps/web/src/functions/parse-links.test.ts
git commit -m "feat(web): detector de links com allowlist curta de TLDs"
```

---

### Task 5: `parseTaskText` — composição e recorte

Junta os três detectores, resolve span sobreposto e devolve o texto limpo. É aqui que o arquivo é renomeado.

**Files:**
- Rename: `apps/web/src/functions/parse-when.ts` → `apps/web/src/functions/parse-task.ts`
- Rename: `apps/web/src/functions/parse-when.test.ts` → `apps/web/src/functions/parse-task.test.ts`
- Modify: `apps/web/src/functions/parse-links.ts` (import do `Span`)

**Interfaces:**
- Consumes: `parseWhen`, `parseDuration` (Tasks 2 e 3), `parseLinks` (Task 4)
- Produces:
  ```ts
  export interface ParsedTask {
    text: string;
    date: Date | null;
    duration: string | null;
    links: string[];
  }
  export function parseTaskText(input: string, now?: Date): ParsedTask;
  ```

- [ ] **Step 1: Escreva o teste que falha**

Acrescente a `apps/web/src/functions/parse-when.test.ts` (ainda com o nome antigo — o rename é o Step 3):

```ts
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
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-when
```

Esperado: FAIL — `parseTaskText is not defined`.

- [ ] **Step 3: Implemente e renomeie**

Primeiro o rename, preservando o histórico:

```bash
git mv apps/web/src/functions/parse-when.ts apps/web/src/functions/parse-task.ts
git mv apps/web/src/functions/parse-when.test.ts apps/web/src/functions/parse-task.test.ts
```

Corrija os imports que apontavam pro nome antigo:

```bash
grep -rln "parse-when" apps/web/src | xargs sed -i 's|parse-when|parse-task|g'
```

Acrescente ao fim de `apps/web/src/functions/parse-task.ts`:

```ts
import { parseLinks } from "./parse-links";

export interface ParsedTask {
  text: string;
  date: Date | null;
  duration: string | null;
  links: string[];
}

/** Tira os spans do texto, do fim pro começo — cortar de frente invalidaria os índices seguintes. */
function cut(input: string, spans: Span[]): string {
  const ordered = [...spans].sort((a, b) => b[0] - a[0]);
  let out = input;
  for (const [start, end] of ordered) out = out.slice(0, start) + out.slice(end);
  return out.replace(/\s+/g, " ").trim();
}

/** Descarta spans engolidos por outro: em "das 15 às 16" o intervalo cobre o horário simples. */
function dropOverlapping(spans: Span[]): Span[] {
  const byLength = [...spans].sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  const kept: Span[] = [];
  for (const span of byLength) {
    const overlaps = kept.some(([start, end]) => span[0] < end && span[1] > start);
    if (!overlaps) kept.push(span);
  }
  return kept;
}

export function parseTaskText(input: string, now: Date = new Date()): ParsedTask {
  const normalized = normalize(input);
  const links = parseLinks(input);

  // O link é **mascarado** com espaço, não removido: "youtu.be/15h30" não pode virar horário, mas
  // apagar o trecho deslocaria todos os índices seguintes.
  const forTime = normalized
    .split("")
    .map((char, i) => (links.spans.some(([s, e]) => i >= s && i < e) ? " " : char))
    .join("");

  const duration = parseDuration(forTime);
  const when = parseWhen(forTime, now);

  const spans = dropOverlapping([
    ...links.spans,
    ...(duration?.spans ?? []),
    ...(when?.spans ?? []),
  ]);

  // O intervalo manda no horário: "das 15 às 16" começa 15:00 mesmo que o parseWhen ache outra coisa.
  const date =
    when && duration?.start
      ? new Date(
          when.date.getFullYear(),
          when.date.getMonth(),
          when.date.getDate(),
          duration.start.hour,
          duration.start.minute,
        )
      : (when?.date ?? null);

  return {
    text: cut(input, spans),
    date,
    duration: duration?.duration ?? null,
    links: links.urls,
  };
}
```

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test
bun --filter @dailify/web typecheck
```

Esperado: PASS nos dois — inclusive os 199 antigos, agora em `parse-task.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/functions
git commit -m "feat(web): parseTaskText compoe os tres detectores e recorta o texto"
```

---

### Task 6: `links` no model e no banco

**Files:**
- Modify: `packages/shared/src/types.ts:3-14`
- Create: `apps/server/migrations/0002_links.sql`
- Modify: `apps/server/src/db/tasks.ts:4-17,30-43,45-68,134-162`
- Test: `apps/server/test/db-tasks.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `Task.links?: string[]`, persistido na coluna `links TEXT` como JSON

- [ ] **Step 1: Escreva o teste que falha**

Acrescente a `apps/server/test/db-tasks.test.ts`:

```ts
describe("links", () => {
  it("sobrevive a insert → read", async () => {
    const task: Task = {
      id: "lk1",
      title: "Reunião",
      description: "",
      date: new Date(2026, 7, 14, 15).getTime(),
      duration: "1h",
      priority: 0,
      repeat: "Off",
      links: ["https://meet.google.com/abc"],
      completed: [],
    };
    await insertTask(env.DB, "u1", task);
    expect((await getTask(env.DB, "u1", "lk1"))?.links).toEqual([
      "https://meet.google.com/abc",
    ]);
  });

  it("sem links volta undefined, não array vazio", async () => {
    await insertTask(env.DB, "u1", {
      id: "lk2",
      title: "Sem link",
      description: "",
      date: Date.now(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    expect((await getTask(env.DB, "u1", "lk2"))?.links).toBeUndefined();
  });

  it("update troca a lista", async () => {
    await updateTask(env.DB, "u1", "lk1", { links: ["https://youtu.be/xyz"] });
    expect((await getTask(env.DB, "u1", "lk1"))?.links).toEqual(["https://youtu.be/xyz"]);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/server test -- db-tasks
```

Esperado: FAIL com `Object literal may only specify known properties` em `links`.

- [ ] **Step 3: Implemente**

**3a.** `packages/shared/src/types.ts`, dentro de `interface Task`, logo depois de `tags`:

```ts
  links?: string[]; // URLs absolutas http(s), validadas na rota
```

**3b.** Crie `apps/server/migrations/0002_links.sql`:

```sql
ALTER TABLE tasks ADD COLUMN links TEXT;
```

**3c.** `apps/server/src/db/tasks.ts` — quatro pontos, todos copiando o que `tags` faz:

```ts
// interface Row, depois de `tags: string | null;`
  links: string | null;

// rowToTask, depois da linha de tags
    links: r.links ? JSON.parse(r.links) : undefined,

// insertTask — a lista de colunas e o VALUES ganham mais um `?`
`INSERT INTO tasks (id,user_id,title,description,date,alert,duration,priority,repeat_kind,repeat_days,tags,links,completed)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
// e no .bind(), entre tags e completed:
      task.links ? JSON.stringify(task.links) : null,

// updateTask — o SET ganha `links=?`
`UPDATE tasks SET title=?,description=?,date=?,alert=?,duration=?,priority=?,repeat_kind=?,repeat_days=?,tags=?,links=? WHERE user_id=? AND id=?`
// e no .bind(), depois de tags:
      next.links ? JSON.stringify(next.links) : null,
```

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/server test
```

Esperado: PASS. A suite aplica as migrations em `beforeAll` (`applyD1Migrations`), então a `0002` entra sozinha.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts apps/server/migrations/0002_links.sql apps/server/src/db/tasks.ts apps/server/test/db-tasks.test.ts
git commit -m "feat(server): coluna links no D1, no mesmo formato JSON do tags"
```

---

### Task 7: Validação de links na rota

O painel vai renderizar esses links como `<a href>`. O servidor é a fronteira de confiança: um POST direto com `javascript:` viraria link clicável na tela do próprio usuário.

**Files:**
- Modify: `apps/server/src/routes/tasks.ts:39-58` (POST) e `:60-68` (PATCH)
- Test: `apps/server/test/tasks-create.test.ts`

**Interfaces:**
- Consumes: `Task.links` da Task 6
- Produces: `sanitizeLinks(value: unknown): string[] | undefined | "invalid"`

- [ ] **Step 1: Escreva o teste que falha**

Acrescente a `apps/server/test/tasks-create.test.ts`:

```ts
describe("POST /tasks — links", () => {
  const post = (body: unknown) =>
    app.request(
      "/tasks",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      env,
    );

  it("aceita http e https", async () => {
    role = "pro";
    const res = await post(taskInput({ links: ["https://meet.google.com/a", "http://x.com"] }));
    expect(res.status).toBe(200);
    const { task } = await res.json<{ task: Task }>();
    expect(task.links).toEqual(["https://meet.google.com/a", "http://x.com"]);
  });

  it.each([
    ["javascript:", ["javascript:alert(1)"]],
    ["data:", ["data:text/html,<script>alert(1)</script>"]],
    ["string solta", ["não é url"]],
    ["não-array", "https://x.com"],
    ["item não-string", [42]],
  ])("rejeita %s", async (_label, links) => {
    role = "pro";
    const res = await post(taskInput({ links }));
    expect(res.status).toBe(400);
  });

  it("rejeita mais de 10 links", async () => {
    role = "pro";
    const links = Array.from({ length: 11 }, (_, i) => `https://x.com/${i}`);
    expect((await post(taskInput({ links }))).status).toBe(400);
  });

  it("sem links continua criando", async () => {
    role = "pro";
    expect((await post(taskInput())).status).toBe(200);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/server test -- tasks-create
```

Esperado: FAIL — os casos de rejeição voltam 200, porque hoje nada valida.

- [ ] **Step 3: Implemente**

Em `apps/server/src/routes/tasks.ts`, depois do `const MONTH_RE`:

```ts
const MAX_LINKS = 10;

/**
 * `undefined` = não veio nada; `"invalid"` = veio e presta pra nada. O painel renderiza esses
 * links como <a href>, então protocolo fora de http(s) aqui é XSS refletido na própria tela.
 */
function sanitizeLinks(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_LINKS) return "invalid";

  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !URL.canParse(item)) return "invalid";
    const { protocol } = new URL(item);
    if (protocol !== "http:" && protocol !== "https:") return "invalid";
    urls.push(item);
  }
  return urls.length ? urls : undefined;
}
```

No `POST`, entre o `body` e o `const task`:

```ts
  const links = sanitizeLinks(body.links);
  if (links === "invalid") return fail(c, 400, "invalid links");
```

e no objeto `task`, depois de `tags`:

```ts
    links,
```

No `PATCH`, depois do `normalizeRepeat`:

```ts
  if (patch.links !== undefined) {
    const links = sanitizeLinks(patch.links);
    if (links === "invalid") return fail(c, 400, "invalid links");
    patch.links = links;
  }
```

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/server test
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/tasks.ts apps/server/test/tasks-create.test.ts
git commit -m "feat(server): valida links (so http/https, teto de 10) antes de persistir"
```

---

### Task 8: Composer de campo único

**Files:**
- Modify: `apps/web/src/components/dashboard/task-composer.tsx` (arquivo inteiro)
- Modify: `apps/web/src/components/dashboard/copy.ts:111-118`

**Interfaces:**
- Consumes: `parseTaskText`, `ParsedTask` (Task 5)
- Produces:
  ```ts
  export interface ComposerValues { parsed: ParsedTask }   // `when`/`text` saem
  ```

- [ ] **Step 1: Copy primeiro**

Substitua o bloco `composer` de `apps/web/src/components/dashboard/copy.ts:111-118`:

```ts
  composer: {
    text: "Tarefa",
    textPlaceholder: "Reunião com o time hoje às 16:30",
    submit: "Criar tarefa",
    missingWhen: "quando?",
    missingText: "o que é a tarefa?",
  },
```

`when`, `whenPlaceholder` e `notUnderstood` saem: não existe mais campo separado, e o aviso virou chip ao vivo em vez de toast pós-envio.

- [ ] **Step 2: Reescreva o componente**

`apps/web/src/components/dashboard/task-composer.tsx`:

```tsx
import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpIcon, LinkIcon, Loader2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Label } from "@/components/ui/label";
import { parseTaskText, type ParsedTask } from "@/functions/parse-task";
import { linkLabel } from "@/functions/link-label";
import { cn } from "@/lib/utils";

export interface ComposerValues {
  parsed: ParsedTask;
}

interface TaskComposerProps {
  submitting?: boolean;
  className?: string;
  onSubmit: (values: ComposerValues) => void;
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-md border border-surface-line px-2 py-1 " +
  "font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground";

/**
 * Barra de captura rápida: uma frase só. O que o parser tirou dela aparece em chips embaixo — sem
 * esse eco o usuário digita no escuro e só descobre no envio que a data não foi entendida.
 */
export function TaskComposer({ submitting, className, onSubmit }: TaskComposerProps): JSX.Element {
  const [input, setInput] = useState("");

  const parsed = useMemo(() => parseTaskText(input), [input]);
  const canSubmit = Boolean(parsed.text && parsed.date) && !submitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ parsed });
    setInput("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-[21px] border border-surface-line bg-surface-page p-[5px] transition-colors focus-within:border-accent-primary",
        className,
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl bg-surface-card p-3">
        <div className="flex items-center gap-2 rounded-2xl bg-surface-page px-3 py-2">
          <Label htmlFor="composer-text" className="sr-only">
            {copy.composer.text}
          </Label>
          {/* Enter envia, Shift+Enter quebra linha — senão duas linhas custariam o atalho. */}
          <textarea
            id="composer-text"
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            placeholder={copy.composer.textPlaceholder}
            autoComplete="off"
            className="min-w-0 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />

          <button
            type="submit"
            aria-label={copy.composer.submit}
            disabled={!canSubmit}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-primary text-primary-foreground transition-colors hover:bg-accent-hover disabled:bg-surface-hover disabled:text-muted-foreground"
          >
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon className="size-4" />
            )}
          </button>
        </div>

        {input.trim() && (
          <div aria-live="polite" className="flex flex-wrap items-center gap-1.5 px-1">
            <span className={cn(chipClass, !parsed.date && "text-accent-primary")}>
              {parsed.date
                ? format(parsed.date, "EEE · d MMM · HH:mm", { locale: ptBR })
                : copy.composer.missingWhen}
            </span>

            {parsed.duration && <span className={chipClass}>{parsed.duration}</span>}

            {!parsed.text && (
              <span className={cn(chipClass, "text-accent-primary")}>
                {copy.composer.missingText}
              </span>
            )}

            {parsed.links.map((url) => (
              <span key={url} className={chipClass}>
                <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
                {linkLabel(url)}
              </span>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Crie o rótulo de link**

`apps/web/src/functions/link-label.ts`:

```ts
const NAMES: Record<string, string> = {
  "meet.google.com": "Google Meet",
  "youtube.com": "YouTube",
  "www.youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "github.com": "GitHub",
  "notion.so": "Notion",
  "www.notion.so": "Notion",
  "calendar.google.com": "Google Agenda",
  "docs.google.com": "Google Docs",
  "zoom.us": "Zoom",
};

/** Nome do serviço quando conhecido, senão o próprio host sem "www." — nunca faz rede. */
export function linkLabel(url: string): string {
  if (!URL.canParse(url)) return url;
  const { hostname } = new URL(url);
  return NAMES[hostname] ?? hostname.replace(/^www\./, "");
}
```

Com teste em `apps/web/src/functions/link-label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { linkLabel } from "./link-label";

describe("linkLabel", () => {
  it.each([
    ["https://meet.google.com/abc", "Google Meet"],
    ["https://youtu.be/xyz", "YouTube"],
    ["https://www.youtube.com/watch?v=1", "YouTube"],
    ["https://dailify.mxrqz.com/x", "dailify.mxrqz.com"],
    ["https://www.exemplo.com", "exemplo.com"],
  ])("%s → %s", (url, expected) => {
    expect(linkLabel(url)).toBe(expected);
  });

  it("url quebrada volta ela mesma em vez de estourar", () => {
    expect(linkLabel("não é url")).toBe("não é url");
  });
});
```

- [ ] **Step 4: Rode o gate**

```bash
bun --filter @dailify/web test
bun --filter @dailify/web typecheck
```

Esperado: os testes passam; o typecheck **falha** em `home.tsx`, que ainda passa `when`/`text` — é a Task 9.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/task-composer.tsx apps/web/src/components/dashboard/copy.ts apps/web/src/functions/link-label.ts apps/web/src/functions/link-label.test.ts
git commit -m "feat(web): composer de campo unico com chips do que o parser entendeu"
```

---

### Task 9: Ligar o composer ao create

**Files:**
- Modify: `apps/web/src/pages/home.tsx:39-56` e `:81-116`

**Interfaces:**
- Consumes: `ComposerValues { parsed: ParsedTask }` (Task 8), `Task.links` (Task 6)
- Produces: nada — é a ponta

- [ ] **Step 1: Substitua `composerTaskInput`**

`apps/web/src/pages/home.tsx:39-56`:

```tsx
const DEFAULT_DURATION = "10m";

/** O composer entrega tudo já extraído; aqui só viram os campos que o `TaskInput` exige. */
function composerTaskInput(parsed: ParsedTask): TaskInput {
  return {
    title: parsed.text,
    description: "",
    date: (parsed.date ?? new Date()).getTime(),
    duration: parsed.duration ?? DEFAULT_DURATION,
    priority: 0,
    repeat: "Off",
    links: parsed.links.length ? parsed.links : undefined,
  };
}
```

`DEFAULT_HOUR` sai: quem não tem data não chega aqui — o composer não deixa enviar.

- [ ] **Step 2: Simplifique o `handleCompose`**

Em `home.tsx:81-116`, a assinatura vira `({ parsed }: ComposerValues)` e o bloco do `notUnderstood` some inteiro (o chip já avisa antes do envio):

```tsx
  const handleCompose = async ({ parsed }: ComposerValues) => {
    if (!canCreateTask) {
      toast(copy.form.limitReached, {
        description: copy.form.limitReachedHint,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      return;
    }

    const { task, error } = await createTask(token, composerTaskInput(parsed));
    if (error || !task) {
      toast(copy.form.createError, {
        description: error,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
    } else {
      setTasks(upsertTaskById(tasks ?? [], task));
      toast.message(copy.form.created, { description: task.title });
    }

    setSubmitting(false);
  };
```

E o import no topo: `import type { ParsedTask } from "@/functions/parse-task";` no lugar do `ParsedWhen`.

- [ ] **Step 3: Rode o gate inteiro**

```bash
bun run check
```

Esperado: PASS nos dois workspaces — format, lint, typecheck e os testes de web + server.

- [ ] **Step 4: Verifique no app de verdade**

```bash
bun run dev
```

Abra o dashboard e digite `Reunião com o time das 15 às 16 meet.google.com/abc`. Confirme, nesta ordem:

1. os chips mostram data 15:00, duração `1h` e `Google Meet` enquanto você digita
2. o botão só habilita quando há data **e** texto — apague "das 15 às 16" e ele desabilita com o chip `quando?`
3. enviar cria a tarefa com o título `Reunião com o time`, sem o horário nem a URL grudados
4. o campo esvazia depois do envio

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/home.tsx
git commit -m "feat(web): home monta a tarefa a partir do ParsedTask do composer"
```

---

## Verificação final

- [ ] `bun run check` verde na raiz
- [ ] `bd close Dailify-0do`
- [ ] `git push -u origin worktree-task-edit-sidebar`

## Fora deste plano

O painel de edição (abrir direto em edição, prioridade fora, título/descrição fundidos, chips de link editáveis, passe visual da sheet) é o próximo spec — ele depende deste pra ter link o que exibir. `Dailify-yok` (tags via `#`), `Dailify-p84` (recorrência) e `Dailify-1xr` (tarefa sem data) seguem abertas.
