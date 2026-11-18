# packages/shared/src/parse-task — rule-based pt/en task parser

`parseTaskText(input, now, { ignore })` reads a composer sentence into title, date, duration, repeat
and links with tables and regex, no LLM. The web composer calls it on every keystroke (the undated
quick add in `anytime-block.tsx` on submit), and `POST /voice` on the server calls it on the
transcript. Repo-wide rules: [/RULES.md](../../../../RULES.md)
([Shared model](../../../../RULES.md#shared-model), [Testing](../../../../RULES.md#testing)).

## Layout

- `index.ts`: the pipeline (`parseTaskText`), `ParsedTask`, `Field`, `quotedSpans`.
- One module per detector: `times` (clock), `dates` (day), `when` (day + time), `durations`
  (duration and `das 15 às 16` ranges), `repeat` (series, `a cada N`, both gates), `title` (`cut`,
  `properNouns`), `unsure` (why the reading may be wrong).
- Shared plumbing: `vocab.ts` (word tables, `normalize`, `alternation`, `dateIn`/`zoneOf`, day math)
  and `spans.ts` (`mask`, `mergeSpans`, `remapSpans`).
- Still at the `src/` root: `parse-links.ts`, `parse-task.test.ts`, `parse-task.corpus.ts`,
  `parse-task.corpus/`, `parse-task.known-failures.ts` and its `.gen.ts` generator.

## Pipeline order

Each step masks what it consumed before the next one looks, so reordering changes results.

1. Mask `ignore` and quoted spans, parse links, cut a leading `lembrete:`/`reminder:`/`todo:` label.
2. `parseInterval`, then the `UNSUPPORTED_REPEAT_RE` gate: a series `Repeat` can't hold returns
   title + links only.
3. Mask proper nouns (`Sessão da Tarde`), then `parseDuration`. Ranges run first, so `das 15 às 16`
   is 60 minutes starting at 15:00, not two times.
4. Mask the duration from `parseWhen`, or the `1h` of `call de 1h hoje às 16h` wins as the time.
5. `parseRepeat`, merged with the interval when same kind, then the `BOUNDED_REPEAT_RE` gate
   (`por 3 semanas`, `até dezembro`).
6. `parseWhen`, re-run with the series hour when only the series gave one (`todas as manhãs`).
7. The `N minute X` title rescue, the weekday rewrite for `biweekly` without cited days, then
   `nextOccurrence`.
8. If a lone `daily`/`weekly`/`monthly` ate the whole title, re-parse with it in `ignore`: it is the
   meeting's name.

## Invariants

- `normalize()` maps 1 char in to 1 char out. Detectors measure spans on normalized text and `cut()`
  applies them to the original, so every returned span (`fields` too) indexes `input`. Never trim,
  collapse or expand inside it.
- Detectors hide consumed text with `mask` (spaces) and never delete it, which would shift indexes.
- `mergeSpans` returns disjoint, sorted spans; `cut()` walks forward only and relies on that.
- `now` is a `TZDate`, and every date is built with `dateIn(ref, …)` or the `vocab.ts` day helpers.
  `zoneOf` throws on a plain `Date` on purpose. No module state: Worker requests run concurrently.
- `unsure` codes are deterministic triggers, not scores. The composer shows the first one as a hint
  on the "Melhorar com a Mew" card and never calls the AI by itself. `POST /voice` keeps the local
  parse only when `unsure` is empty and the title is not (`readLocally` in
  `apps/server/src/routes/voice.ts`); otherwise it asks OpenAI.

## Adding

- Vocabulary: add keys to the `vocab.ts` tables, normalized (lowercase, no accents; a space matches
  `\s+`). `alternation()` sorts longest-first so `vinte e uma` beats `vinte`. Add a pt and an en row.
- An unsure code: extend `UnsureCode` in `unsure.ts`; the compiler then asks for its label in
  `copy.mew.unsure` (`apps/web/src/components/dashboard/copy.ts`). Add rows with `unsure: [code]`
  to `parse-task.corpus/unsure.ts`. A code firing on a clean row fails the ratchet as a false alarm.
- Exports: `index.ts` also re-exports test-only detectors (`parseDuration`, `parseInterval`,
  `parseRepeat`, `parseWhen`, `cut`, `normalize`), which reach the package root. Add no more; the
  apps use `parseTaskText`, `ParsedTask`, `Field`, `Span`, `remapSpans`, `quotedSpans` and
  `UnsureCode`. New tests import a detector from its module (`./parse-task/when`).

## Golden corpus

- Rows come from `section(lang, category, rows)` in `parse-task.corpus/kit.ts`:
  `[input, title, day?, time?, more?]`. An omitted field means "nothing" and is checked. `now`
  defaults to Sunday 2026-11-15 14:00 in `CORPUS_ZONE` (America/Sao_Paulo); write days as `TODAY`,
  `MON`, `plus(n)`. Give ambiguous phrases `alt` readings. Titles compare normalized and trimmed.
- With `unsure` (or `outOfScope`) set, only the codes count. Without, the fields count and any code
  is a false alarm.
- Each input appears once, since known failures are keyed by input. Import a new file in
  `parse-task.corpus.ts`.
- `holdout*.ts` are blind sentences written without looking at the parser: never edit their
  expectations to match output. Elsewhere, change a row only when the golden itself is wrong.
- The ratchet (`parse-task.corpus.test.ts`) is red on a new failure, and also when a known failure
  passes or no longer exists in the corpus.

## Verify (from `packages/shared`)

- `bun run test src/parse-task.test.ts src/parse-task.corpus.test.ts`
- `bun run parser:failures` regenerates `parse-task.known-failures.ts` (never edit it by hand) and
  prints `REGRESSÃO` for each new failure; add none. `--dump` prints got vs want for every failure.
