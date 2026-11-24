import { Fragment, useState, type ReactNode } from "react";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
  PlusIcon,
} from "lucide-react";
import { INTEGRATIONS, TASK_LIMITS, fromWire, type MewCardItem } from "@dailify/shared";

import { GitHubLogo, SlackLogo } from "@/components/logos";
import { Button } from "@/components/ui/button";
import { fill } from "@/functions/functions";
import { appTimeZone } from "@/functions/zone";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

import { copy as t } from "./copy";
import type { ItemsBlock } from "./thread";

const rtf = new Intl.RelativeTimeFormat(t.items.locale, { numeric: "always" });
const UNITS = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
] as const;

/** "há 2 dias": the largest whole unit, a minute at least. */
export function ago(at: number, now: number): string {
  const s = Math.max(60, (now - at) / 1000);
  const [unit, size] = UNITS.find(([, size]) => s >= size) ?? UNITS[4];
  return rtf.format(-Math.floor(s / size), unit);
}

const PILL = "rounded-full bg-fill px-2 py-0.5 text-2xs font-medium text-ink-secondary";
const META = "flex flex-wrap items-center gap-x-1 text-footnote text-ink-secondary tabular-nums";
const AVATAR =
  "flex size-7 flex-none items-center justify-center rounded-sm bg-fill text-footnote font-semibold text-ink-secondary";

/** Parts joined by a dot; empty ones drop out. */
function Meta({ parts, className }: { parts: ReactNode[]; className?: string }) {
  return (
    <p className={cn(META, className)}>
      {parts.filter(Boolean).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span className="inline-flex items-center gap-1">{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

const initial = (name = "") => name.trim().charAt(0).toUpperCase() || "?";

function Lead({ item }: { item: MewCardItem }) {
  if (item.icon === "message")
    return (
      <span aria-hidden="true" className={AVATAR}>
        {initial(item.author)}
      </span>
    );
  const Icon = item.icon === "pr" ? GitPullRequestIcon : CircleDotIcon;
  return <Icon aria-hidden="true" className="mt-0.5 size-4.5 flex-none text-success" />;
}

function Chips({ item }: { item: MewCardItem }) {
  const chips = [
    ...(item.labels ?? []).map((l) => <span className={PILL}>{l}</span>),
    item.review && <span className={PILL}>{t.items.review}</span>,
    item.mention && (
      <span className={cn(PILL, "font-semibold text-meta-date")}>{t.items.mention}</span>
    ),
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <Fragment key={i}>{c}</Fragment>
      ))}
    </div>
  );
}

function Linked() {
  return <CheckIcon role="img" aria-label={t.items.linked} className="size-4.5 text-success" />;
}

function Row({
  item,
  now,
  linked,
  onAdd,
}: {
  item: MewCardItem;
  now: number;
  linked: boolean;
  onAdd: (item: MewCardItem) => void;
}) {
  const when = item.at !== undefined && ago(item.at, now);
  return (
    <li className="flex items-center border-t border-separator">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-start gap-2.5 py-2.5 pl-3 focus-ring"
      >
        <Lead item={item} />
        <div className="min-w-0 flex-1">
          {item.icon === "message" ? (
            <>
              <Meta parts={[<b className="font-semibold text-ink">{item.author}</b>, when]} />
              <p className="line-clamp-2 text-subhead">{item.title}</p>
              {!!item.replies && (
                <Meta
                  className="mt-1"
                  parts={[
                    <>
                      <MessageSquareIcon aria-hidden="true" className="size-3.5" />
                      {fill(t.items.replies, { n: item.replies })}
                    </>,
                  ]}
                />
              )}
            </>
          ) : (
            <>
              <p className="truncate text-subhead font-semibold">{item.title}</p>
              <Meta parts={[item.where, when]} />
            </>
          )}
          <Chips item={item} />
        </div>
      </a>
      <span className="flex size-11 flex-none items-center justify-center">
        {linked ? (
          <Linked />
        ) : (
          <button
            type="button"
            aria-label={t.items.add}
            onClick={() => onAdd(item)}
            className="flex size-11 items-center justify-center rounded-full focus-ring"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-fill">
              <PlusIcon aria-hidden="true" className="size-4" />
            </span>
          </button>
        )}
      </span>
    </li>
  );
}

function OpenLink({ block }: { block: ItemsBlock }) {
  return (
    <a
      href={block.url}
      target="_blank"
      rel="noreferrer"
      className="relative hit-target inline-flex items-center gap-1 text-footnote text-ink-secondary focus-ring"
    >
      {fill(t.items.open, { app: INTEGRATIONS[block.provider].name })}
      <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
    </a>
  );
}

/** A connected app's read, as the server built it: a list, or one GitHub item in detail. */
export function ItemsView({
  block,
  now,
  added,
  onAdd,
}: {
  block: ItemsBlock;
  now: number;
  /** Urls turned into tasks from this card. */
  added: string[];
  onAdd: (item: MewCardItem) => void;
}) {
  const Logo = block.provider === "slack" ? SlackLogo : GitHubLogo;
  const linked = (item: MewCardItem) => Boolean(item.linked) || added.includes(item.url);
  const { detail } = block;
  const first = block.items.at(0);
  const more = block.total - block.items.length;
  return (
    <div className="overflow-hidden rounded-md bg-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Logo aria-hidden="true" className="size-4 flex-none" />
        <b className="min-w-0 flex-1 truncate text-subhead font-semibold">{block.source}</b>
        {detail ? (
          <span
            className={cn(
              "text-footnote font-semibold",
              detail.state === "open" ? "text-success" : "text-ink-secondary",
            )}
          >
            {detail.state === "open" ? t.items.stateOpen : t.items.stateClosed}
          </span>
        ) : (
          <span className="text-footnote text-ink-secondary tabular-nums">
            {fill(block.provider === "slack" ? t.items.messages : t.items.openIssues, {
              n: block.total,
            })}
          </span>
        )}
      </div>
      {detail && first ? (
        <div className="border-t border-separator px-3 py-2.5">
          <a
            href={first.url}
            target="_blank"
            rel="noreferrer"
            className="block text-body font-semibold focus-ring"
          >
            {first.title}
          </a>
          <Meta
            className="mt-0.5"
            parts={[
              first.at === undefined
                ? detail.author
                : fill(t.items.opened, { author: detail.author, when: ago(first.at, now) }),
              fill(t.items.comments, { n: detail.comments }),
            ]}
          />
          <Chips item={first} />
          {detail.body && (
            <p className="mt-2 line-clamp-3 text-subhead text-ink-secondary">{detail.body}</p>
          )}
          {detail.recent.length > 0 && (
            <>
              <p className="mt-3 text-footnote font-semibold text-ink-secondary">
                {t.items.recent}
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {detail.recent.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden="true" className={AVATAR}>
                      {initial(c.author)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Meta parts={[c.author, ago(c.at, now)]} />
                      <p className="line-clamp-2 text-subhead">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <ul>
          {block.items.map((item) => (
            <Row key={item.url} item={item} now={now} linked={linked(item)} onAdd={onAdd} />
          ))}
        </ul>
      )}
      <div className="flex min-h-11 items-center justify-between gap-2 border-t border-separator px-3 py-1.5">
        <OpenLink block={block} />
        {detail && first ? (
          linked(first) ? (
            <Linked />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onAdd(first)}>
              <PlusIcon aria-hidden="true" />
              {t.items.add}
            </Button>
          )
        ) : (
          more > 0 && (
            <span className="text-footnote text-ink-secondary tabular-nums">
              {fill(t.items.more, { n: more })}
            </span>
          )
        )}
      </div>
    </div>
  );
}

/** Wires "Virar tarefa" to the undated create (optimistic, queued offline). */
export function ItemsBox({ block }: { block: ItemsBlock }) {
  const { create } = useCreateTask();
  const now = +useNow(60_000);
  // ponytail: local only, so a reload shows "+" again until the next read marks it linked.
  const [added, setAdded] = useState<string[]>([]);
  const add = async (item: MewCardItem) => {
    const text = item.title.trim().slice(0, TASK_LIMITS.titleMax);
    const parsed = fromWire(
      {
        text,
        date: null,
        hasTime: false,
        hasDay: false,
        duration: null,
        links: [item.url],
        repeat: "Off",
      },
      appTimeZone(),
    );
    if (await create(parsed, { undatedOnly: true })) setAdded((cur) => [...cur, item.url]);
  };
  return <ItemsView block={block} now={now} added={added} onAdd={(item) => void add(item)} />;
}
