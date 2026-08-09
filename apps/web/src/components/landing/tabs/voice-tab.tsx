import { motion } from "framer-motion";

import { copy } from "../copy";

/** Decorative waveform → structured-task mock. Fake transcript, not wired to the real voice flow. */
const WAVE_HEIGHTS = [8, 14, 22, 30, 20, 26, 14, 10, 18, 12] as const;
const VOICE_TASKS = [
  { title: "Ligar pro dentista", time: "14:00" },
  { title: "Comprar leite", time: "18:30" },
] as const;

function VoiceMock({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="flex h-16 shrink-0 items-end gap-1" aria-hidden="true">
        {WAVE_HEIGHTS.map((height, index) => (
          <motion.span
            key={index}
            className="w-1.5 rounded-full bg-accent-primary"
            style={{ height, transformOrigin: "bottom" }}
            animate={reduce ? undefined : { scaleY: [1, 1.6, 1] }}
            transition={
              reduce
                ? undefined
                : { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.06 }
            }
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {VOICE_TASKS.map((task) => (
          <div
            key={task.title}
            className="flex items-center justify-between gap-3 rounded-xl border bg-surface-card px-3 py-2"
          >
            <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">{task.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** VOICE tab — top copy + the waveform → task visual. (Legacy layout, pending scene migration.) */
export function VoiceTab({ reduce }: { reduce: boolean }): JSX.Element {
  const tabCopy = copy.features.tabs.voice;
  return (
    <>
      <div className="mb-6 flex flex-col gap-1.5">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          {tabCopy.title}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">{tabCopy.blurb}</p>
      </div>

      <VoiceMock reduce={reduce} />
    </>
  );
}
