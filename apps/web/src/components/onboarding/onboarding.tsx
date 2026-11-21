import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDownIcon, CalendarIcon, ClockIcon, MicIcon } from "lucide-react";

import { Brand } from "@/components/brand";
import { MetaChip } from "@/components/dashboard/composer-views";
import { Chip } from "@/components/kit/chip";
import { ListGroup, ListRow } from "@/components/kit/list";
import { TaskRow } from "@/components/kit/task-row";
import { Mine } from "@/components/mew-chat/bubbles";
import { MessageBox } from "@/components/mew/message-box";
import { Mew } from "@/components/mew/mew";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { DESKTOP } from "@/consts/media";
import { fill } from "@/functions/functions";
import { enablePush, pushState, type PushState } from "@/functions/push";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { nativeReminders, openAssistantSettings } from "@/lib/reminders";
import { cn } from "@/lib/utils";

import { copy } from "./copy";
import { onboardingSteps, type OnboardingStep } from "./steps";

/** Device-wide: permissions are per device, so a second account here doesn't see it again. */
export const ONBOARDING_KEY = "dailify:onboarding";

const bubble = "rounded-lg bg-surface-raised px-4.5 py-3 text-body font-semibold shadow-raised";
const underline = "bg-transparent text-ink underline decoration-2 underline-offset-4";

function Notice({
  title,
  meta,
  at,
  back,
}: {
  title: string;
  meta?: string;
  at: string;
  back?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-3.5",
        back ? "mx-3 bg-surface" : "bg-surface-raised shadow-raised",
      )}
    >
      <span className="grid size-9.5 flex-none place-items-center rounded-sm bg-brand">
        <MewStatic tone="onBrand" className="w-7" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-subhead">
        <span className="flex justify-between text-footnote text-ink-secondary">
          <span>{copy.demo.app}</span>
          <span>{at}</span>
        </span>
        <span className="font-semibold">{title}</span>
        {meta && <span className="text-ink-secondary">{meta}</span>}
      </span>
    </div>
  );
}

/** Each step's picture: real primitives with demo data, decorative and not interactive. */
function Art({ step, desktop }: { step: OnboardingStep; desktop: boolean }) {
  switch (step) {
    case "welcome":
    case "done":
      return (
        <div className="flex flex-col items-center gap-5">
          <p className={bubble}>{step === "welcome" ? copy.hello : copy.ready}</p>
          <Mew mood="happy" className="w-50" />
        </div>
      );
    case "create":
      return (
        <div className="flex w-full flex-col gap-4">
          <div className="card flex flex-col gap-3.5 rounded-lg p-4">
            <p className="text-body">
              {copy.demo.sentence.title}{" "}
              <mark className={cn(underline, "decoration-meta-date")}>
                {copy.demo.sentence.day}
              </mark>{" "}
              <mark className={cn(underline, "decoration-meta-time")}>
                {copy.demo.sentence.time}
              </mark>
            </p>
            <div className="flex items-center gap-2">
              <MetaChip icon={<CalendarIcon className="text-meta-date" />}>
                {copy.demo.dayChip}
              </MetaChip>
              <MetaChip icon={<ClockIcon className="text-meta-time" />}>{copy.demo.clock}</MetaChip>
              {!desktop && (
                <span className="ml-auto grid size-11 place-items-center rounded-full bg-fill">
                  <MicIcon className="size-5" />
                </span>
              )}
            </div>
          </div>
          {!desktop && <ArrowDownIcon className="size-5 self-center text-ink-tertiary" />}
          <TaskRow
            time={copy.demo.clock}
            title={copy.demo.sentence.title}
            meta={copy.demo.rowMeta}
            trailing={<span className="m-2.5 size-6 rounded-full border-2 border-ink-secondary" />}
          />
        </div>
      );
    case "mew":
      return (
        <div className="flex w-full flex-col gap-3">
          <Mine message={{ id: "demo", from: "me", text: copy.demo.ask }} />
          <div className="flex items-end gap-2">
            <MewStatic className="mb-0.5 w-11 flex-none" />
            <MessageBox type="text" className="flex-1">
              <p className="text-subhead">{copy.demo.reply}</p>
              <ul className="mt-3 divide-y divide-separator rounded-md bg-fill">
                {copy.demo.rows.map((row) => (
                  <li key={row.title} className="flex gap-2.5 px-3 py-2.5 text-subhead">
                    <span className="w-10 text-ink-secondary tabular-nums">{row.time}</span>
                    {row.title}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="default" className="flex-1">
                  <span>{copy.demo.move}</span>
                </Button>
                <Button asChild variant="secondary">
                  <span>{copy.demo.change}</span>
                </Button>
              </div>
            </MessageBox>
          </div>
        </div>
      );
    case "notifications":
      return (
        <div className="flex w-full flex-col gap-2.5">
          <Notice title={copy.demo.reminder} meta={copy.demo.reminderMeta} at={copy.demo.now} />
          <Notice title={copy.demo.morning} at={copy.demo.morningAt} back />
        </div>
      );
    case "assistant":
      return (
        <div className="flex w-full flex-col items-center gap-5">
          <Mew mood="listening" className="w-38" />
          <ListGroup className="self-stretch">
            {[copy.demo.holdPower, copy.demo.listening].map((label, i) => (
              <ListRow
                key={label}
                icon={
                  <span className="grid size-7 place-items-center rounded-full bg-fill text-subhead font-semibold text-ink">
                    {i + 1}
                  </span>
                }
                label={label}
              />
            ))}
          </ListGroup>
        </div>
      );
  }
}

export interface OnboardingViewProps {
  step: OnboardingStep;
  /** Position among the steps this device shows (0-based) and their count. */
  index: number;
  total: number;
  desktop: boolean;
  /** The step's primary action is running (enabling reminders). */
  busy?: boolean;
  onPrimary: () => void;
  onNotNow: () => void;
  onBack: () => void;
  onSkip: () => void;
  onTry: (text: string) => void;
}

/** The full-screen steps (props only). Desktop lays the picture and the text side by side. */
export function OnboardingView({
  step,
  index,
  total,
  desktop,
  busy,
  onPrimary,
  onNotNow,
  onBack,
  onSkip,
  onTry,
}: OnboardingViewProps) {
  const last = step === "done";
  const asks = step === "notifications" || step === "assistant";
  const primary = {
    welcome: copy.start,
    create: copy.next,
    mew: copy.next,
    notifications: copy.enableNotifications,
    assistant: copy.useAssistant,
    done: copy.finish,
  } satisfies Record<OnboardingStep, string>;
  const body = step === "create" && desktop ? copy.createBodyDesktop : copy.steps[step].body;

  const dots = (
    <div
      role="img"
      aria-label={fill(copy.progress, { step: index + 1, total })}
      className="flex items-center gap-1.5"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-colors duration-base",
            i === index
              ? "w-5 bg-ink"
              : i < index
                ? "w-1.5 bg-ink-tertiary"
                : "w-1.5 bg-fill-pressed",
          )}
        />
      ))}
    </div>
  );
  const skip = !last && (
    <Button variant="ghost" className="-mr-2 px-2 font-medium text-ink-secondary" onClick={onSkip}>
      {copy.skip}
    </Button>
  );

  const text = (
    <div className="flex flex-col gap-2.5">
      <DialogPrimitive.Title className="text-title-1 text-balance">
        {copy.steps[step].title}
      </DialogPrimitive.Title>
      <DialogPrimitive.Description className="text-body text-ink-secondary">
        {body}
      </DialogPrimitive.Description>
    </div>
  );
  const suggestions = last && (
    <div className="flex flex-wrap gap-2">
      {copy.suggestions.map((s) => (
        <Chip key={s} variant="select" onClick={() => onTry(s)}>
          {s}
        </Chip>
      ))}
    </div>
  );
  const main = (
    <Button
      size={desktop ? "default" : "lg"}
      loading={busy}
      onClick={onPrimary}
      className={cn(desktop && "px-6")}
    >
      {primary[step]}
    </Button>
  );
  const notNow = asks && (
    <Button variant="ghost" className="font-medium text-ink-secondary" onClick={onNotNow}>
      {copy.notNow}
    </Button>
  );
  const hint = step === "assistant" && (
    <p className="text-center text-footnote text-ink-secondary md:text-left">
      {copy.assistantHint}
    </p>
  );
  // Re-keyed per step: @starting-style plays the short enter on every change.
  const enter =
    "transition-[opacity,translate] duration-base ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none";
  const art = (
    <div aria-hidden="true" className="pointer-events-none flex w-full justify-center select-none">
      <Art step={step} desktop={desktop} />
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      {desktop ? (
        <>
          <div className="mx-auto grid h-11 w-full max-w-280 grid-cols-[1fr_auto_1fr] items-center">
            <Brand to="/dashboard" className="justify-self-start" />
            {dots}
            <span className="justify-self-end">{skip}</span>
          </div>
          <div
            key={step}
            className={cn(
              "mx-auto flex w-full max-w-280 flex-1 flex-wrap items-center justify-center gap-16 pt-12",
              enter,
            )}
          >
            <div className="flex max-w-115 grow basis-95 justify-center">{art}</div>
            <div className="flex max-w-110 grow basis-90 flex-col gap-7">
              {text}
              {suggestions}
              {hint}
              <div className="flex flex-wrap gap-2">
                {main}
                {asks
                  ? notNow
                  : index > 0 &&
                    !last && (
                      <Button variant="secondary" className="font-medium" onClick={onBack}>
                        {copy.back}
                      </Button>
                    )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-11 items-center justify-between">
            {dots}
            {skip}
          </div>
          <div key={step} className={cn("flex flex-1 flex-col", enter)}>
            <div className="flex flex-1 flex-col items-center justify-center py-6">{art}</div>
            <div className={cn(asks || last ? "mb-5" : "mb-8")}>{text}</div>
            {suggestions && <div className="mb-6">{suggestions}</div>}
            <div className="flex flex-col gap-2">
              {main}
              {hint}
              {notNow}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The first-run introduction, once per device, over /dashboard (mounted by `pages/home.tsx`, so it
 * comes after the splash). `hold` skips it on this load without spending it (a deep-link intent).
 */
export function Onboarding({
  onTry,
  hold = false,
}: {
  onTry: (text: string) => void;
  hold?: boolean;
}) {
  const [seen, setSeen] = useStoredFlag(ONBOARDING_KEY);
  const [open, setOpen] = useState(() => !seen && !hold);
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const desktop = useMediaQuery(DESKTOP);

  // Spent on open, not on finish: the system screens of steps 4 and 5 may kill the app.
  const markSeen = useEffectEvent(() => setSeen(true));
  useEffect(() => {
    if (!open) return;
    markSeen();
    void pushState().then(setPush, () => setPush("unsupported"));
  }, [open]);

  const steps = onboardingSteps({ android: nativeReminders(), notifications: push });
  const index = steps.indexOf(step);
  const next = () => {
    const to = steps[index + 1];
    if (to) setStep(to);
    else setOpen(false);
  };
  const back = () => {
    const to = steps[index - 1];
    if (to) setStep(to);
  };

  const primary = async () => {
    if (step === "done") return setOpen(false);
    if (step === "notifications") {
      setBusy(true);
      await enablePush().catch(() => undefined);
      setBusy(false);
    }
    if (step === "assistant") void openAssistantSettings().catch(() => undefined);
    next();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogPrimitive.Content
          data-slot="onboarding"
          // The Android back button sends Escape: it steps back instead of closing.
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            back();
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-0 z-overlay overflow-y-auto bg-canvas px-5 pt-safe pb-safe text-ink outline-none transition-opacity duration-slow ease-out starting:opacity-0 motion-reduce:transition-none md:px-12 md:pb-12"
        >
          <OnboardingView
            step={step}
            index={index}
            total={steps.length}
            desktop={desktop}
            busy={busy}
            onPrimary={() => void primary()}
            onNotNow={next}
            onBack={back}
            onSkip={() => setOpen(false)}
            onTry={(text) => {
              setOpen(false);
              onTry(text);
            }}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
